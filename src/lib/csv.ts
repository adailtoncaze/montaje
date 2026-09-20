/**
 * Utilitário mínimo de parse de CSV.
 * Suporta delimitador `,`, aspas duplas e vírgula dentro de aspas.
 * Não trata quebras de linha dentro de campos entre aspas
 * (aceitável para CSVs gerados por Excel/Google Sheets sem isso).
 */

export interface CsvRow {
  [header: string]: string;
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map((s) => s.trim());
}

export function parseCSV(text: string): CsvRow[] {
  const content = text.replace(/^\uFEFF/, ""); // remove BOM
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const headers = parseLine(lines[0]);
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: CsvRow = {};
    headers.forEach((header, idx) => {
      row[header.trim()] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }

  return rows;
}

/** Normaliza o nome de um cabeçalho para comparação (sem acentos, minúsculo). */
export function normHeader(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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