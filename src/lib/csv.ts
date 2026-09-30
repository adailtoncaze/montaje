/**
 * Utilitário de parse de CSV (RFC 4180).
 *
 * - Detecta automaticamente o delimitador: o Excel em pt-BR exporta com `;`
 *   (é o mesmo separador usado por `montaCsv` nos relatórios), enquanto o
 *   padrão CSV internacional usa `,`.
 * - Treat campos com delimitador, aspas duplas ("" = aspas literais) e
 *   quebras de linha dentro de aspas — necessário para reimportar o CSV
 *   gerado pela tela de relatórios, cujas observações podem ter quebras.
 */

export interface CsvRow {
  [header: string]: string;
}

const DELIMITADORES = [";", ",", "\t", "|"] as const;

/** Delimitador da primeira linha de dados (fora de aspas). */
export function detectaDelimitador(text: string): string {
  const linha = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .find((l) => l.trim() !== "");
  if (!linha) return ",";

  let melhor = ",";
  let melhorContagem = -1;
  for (const d of DELIMITADORES) {
    let contagem = 0;
    let dentroDeAspas = false;
    for (const ch of linha) {
      if (ch === '"') dentroDeAspas = !dentroDeAspas;
      else if (ch === d && !dentroDeAspas) contagem++;
    }
    if (contagem > melhorContagem) {
      melhor = d;
      melhorContagem = contagem;
    }
  }
  return melhor;
}

/** Divide o texto em registros, respeitando aspas e quebras internas. */
export function parseRegistros(text: string, delimitador = ","): string[][] {
  const registros: string[][] = [];
  let registro: string[] = [];
  let campo = "";
  let dentroDeAspas = false;
  let sawContent = false;

  const fechaCampo = () => {
    registro.push(campo.trim());
    campo = "";
  };
  const fechaRegistro = () => {
    fechaCampo();
    // Ignora linhas em branco (registros com um único campo vazio).
    if (registro.length > 1 || registro[0] !== "") registros.push(registro);
    registro = [];
    sawContent = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (dentroDeAspas) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          dentroDeAspas = false;
        }
      } else {
        campo += ch;
      }
      continue;
    }
    if (ch === '"') {
      dentroDeAspas = true;
      sawContent = true;
    } else if (ch === delimitador) {
      fechaCampo();
      sawContent = true;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      if (sawContent || campo !== "" || registro.length > 0) fechaRegistro();
    } else {
      campo += ch;
      if (ch.trim() !== "") sawContent = true;
    }
  }
  if (sawContent || campo !== "" || registro.length > 0) fechaRegistro();
  return registros;
}

export function parseCSV(text: string): CsvRow[] {
  const content = text.replace(/^\uFEFF/, ""); // remove BOM
  const registros = parseRegistros(content, detectaDelimitador(content));
  if (registros.length < 2) return [];

  const headers = registros[0].map((h) => h.trim());
  const rows: CsvRow[] = [];

  for (let i = 1; i < registros.length; i++) {
    const values = registros[i];
    const row: CsvRow = {};
    headers.forEach((header, idx) => {
      row[header] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Normaliza o nome de um cabeçalho para comparação: minúsculo, sem acentos e
 * sem diferenciação de separadores — "Qtd_seções", "Qtd. Seções" e "qtd secoes"
 * passam a ser equivalentes, o que evita rejeitar uma planilha só porque o
 * usuário digitou o cabeçalho de um jeito um pouco diferente.
 */
export function normHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Busca o valor de uma coluna tolerando variações de nome:
 * ex: "qtd_secoes", "qtd secoes", "quantidade de seções", "Qtd. Seções".
 */
export function getColumn(
  row: CsvRow,
  acceptedNames: string[],
  keys: string[] = Object.keys(row),
): string {
  const normalized = keys.map(normHeader);
  for (const name of acceptedNames) {
    const target = normHeader(name);
    const idx = normalized.indexOf(target);
    if (idx >= 0) return row[keys[idx]] ?? "";
  }
  return "";
}