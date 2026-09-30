import { describe, expect, it } from "vitest";
import {
  detectaDelimitador,
  getColumn,
  normHeader,
  parseCSV,
  parseRegistros,
} from "@/lib/csv";

/* ------------------------------------------------------------------ */
/*  normHeader                                                        */
/* ------------------------------------------------------------------ */

describe("normHeader", () => {
  it("minúscula e sem espaços nas pontas", () => {
    expect(normHeader("  Nome Do Local  ")).toBe("nome do local");
  });

  it("remove acentos", () => {
    expect(normHeader("Município")).toBe("municipio");
    expect(normHeader("Função")).toBe("funcao");
    expect(normHeader("Quantidade de Seções")).toBe("quantidade de secoes");
  });

  it("trata _ . - e espaços como o mesmo separador", () => {
    expect(normHeader("qtd_secoes")).toBe("qtd secoes");
    expect(normHeader("Qtd. Seções")).toBe("qtd secoes");
    expect(normHeader("qtd-secoes")).toBe("qtd secoes");
  });

  it("string vazia continua vazia", () => {
    expect(normHeader("")).toBe("");
  });
});

/* ------------------------------------------------------------------ */
/*  detectaDelimitador                                                */
/* ------------------------------------------------------------------ */

describe("detectaDelimitador", () => {
  it("detecta ; (padrão do Excel pt-BR)", () => {
    expect(detectaDelimitador("a;b;c\n1;2;3")).toBe(";");
  });

  it("detecta , (CSV padrão)", () => {
    expect(detectaDelimitador("a,b,c\n1,2,3")).toBe(",");
  });

  it("detecta tabulação", () => {
    expect(detectaDelimitador("a\tb\tc\n1\t2\t3")).toBe("\t");
  });

  it("detecta pipe", () => {
    expect(detectaDelimitador("nome|municipio\nEscola A|PB")).toBe("|");
  });

  it("ignora o BOM UTF-8", () => {
    expect(detectaDelimitador("\uFEFFa;b;c")).toBe(";");
  });

  it("ignora linhas em branco antes do cabeçalho", () => {
    expect(detectaDelimitador("\n\n  \na;b;c")).toBe(";");
  });

  it("ignora delimitadores dentro de aspas", () => {
    // "Escola; A" contém ; dentro das aspas — o ; do cabeçalho que vale
    expect(detectaDelimitador('nome;obs\n"Escola; A";"1";"2"')).toBe(";");
  });

  it("escolhe o delimitador mais frequente", () => {
    // 1 vírgula e 2 ponto-e-vírgulas → ; vence
    expect(detectaDelimitador('a,b;c;d\n"x","y","z","w"')).toBe(";");
  });

  it("fallback para , em texto vazio", () => {
    expect(detectaDelimitador("")).toBe(",");
    expect(detectaDelimitador("\n\n")).toBe(",");
  });
});

/* ------------------------------------------------------------------ */
/*  parseRegistros                                                    */
/* ------------------------------------------------------------------ */

describe("parseRegistros", () => {
  it("separa campos pelo delimitador informado", () => {
    expect(parseRegistros("a;b;c", ";")).toEqual([["a", "b", "c"]]);
  });

  it("remove o BOM do primeiro campo", () => {
    expect(parseRegistros("\uFEFFa,b", ",")).toEqual([["a", "b"]]);
  });

  it("trata LF, CRLF e CR como quebra de linha", () => {
    const esperado = [
      ["a", "b"],
      ["c", "d"],
    ];
    expect(parseRegistros("a,b\nc,d", ",")).toEqual(esperado);
    expect(parseRegistros("a,b\r\nc,d", ",")).toEqual(esperado);
    expect(parseRegistros("a,b\rc,d", ",")).toEqual(esperado);
  });

  it("ignora linhas em branco", () => {
    expect(parseRegistros("a,b\n\n\nc,d\n\n", ",")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("remove espaços em volta de cada campo", () => {
    expect(parseRegistros("  a ,  b  ,  c ", ",")).toEqual([["a", "b", "c"]]);
  });

  it("remove aspas de um campo quoted simples", () => {
    expect(parseRegistros('"Escola A",PB', ",")).toEqual([["Escola A", "PB"]]);
  });

  it('unescapa aspas duplicadas ("" vira ")', () => {
    expect(parseRegistros('"Ele disse ""oi""",PB', ",")).toEqual([
      ['Ele disse "oi"', "PB"],
    ]);
  });

  it("preserva delimitador dentro de aspas", () => {
    expect(parseRegistros('"Trocou a urna; depois",PB', ",")).toEqual([
      ["Trocou a urna; depois", "PB"],
    ]);
  });

  it("preserva quebra de linha dentro de aspas", () => {
    expect(parseRegistros('"linha 1\nlinha 2",PB', ",")).toEqual([
      ["linha 1\nlinha 2", "PB"],
    ]);
  });

  it("preserva o CR de uma quebra CRLF dentro de aspas", () => {
    // RFC 4180: CRLF dentro de aspas é conteúdo; \r isolado também é conteúdo
    expect(parseRegistros('"linha 1\r\nlinha 2",PB', ",")).toEqual([
      ["linha 1\r\nlinha 2", "PB"],
    ]);
  });

  it("ignora delimitador fora de aspas após campo vazio", () => {
    expect(parseRegistros("a,,c", ",")).toEqual([["a", "", "c"]]);
  });

  it("aceita campo vazio no fim da linha", () => {
    expect(parseRegistros("a,b,", ",")).toEqual([["a", "b", ""]]);
  });

  it("devolve [] para texto vazio", () => {
    expect(parseRegistros("", ",")).toEqual([]);
    expect(parseRegistros("\n", ",")).toEqual([]);
  });

  it("faz round-trip do CSV gerado com aspas, ; e quebra de linha", () => {
    const texto = '"Trocou a urna; ""semBattery"", depois\nvoltou",PB,10';
    expect(parseRegistros(texto, ",")).toEqual([
      ['Trocou a urna; "semBattery", depois\nvoltou', "PB", "10"],
    ]);
  });
});

/* ------------------------------------------------------------------ */
/*  parseCSV                                                          */
/* ------------------------------------------------------------------ */

describe("parseCSV", () => {
  const CSV = [
    "Nome;Município;Qtd. Seções",
    "Escola A;João Pessoa;10",
    "Escola B;Campina Grande;5",
  ].join("\n");

  it("usa a primeira linha como cabeçalho", () => {
    const rows = parseCSV(CSV);
    expect(Object.keys(rows[0])).toEqual(["Nome", "Município", "Qtd. Seções"]);
  });

  it("converte cada linha em objeto", () => {
    const rows = parseCSV(CSV);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      Nome: "Escola A",
      Município: "João Pessoa",
      "Qtd. Seções": "10",
    });
  });

  it("detecta o delimitador automaticamente", () => {
    const rows = parseCSV("nome,municipio\nescola a,PB");
    expect(rows[0]).toEqual({ nome: "escola a", municipio: "PB" });
  });

  it("ignora o BOM UTF-8 do cabeçalho", () => {
    const rows = parseCSV("\uFEFF" + CSV);
    expect(rows[0].Nome).toBe("Escola A");
    expect(Object.keys(rows[0])[0]).toBe("Nome");
  });

  it("preenche com string vazia as colunas ausentes", () => {
    const rows = parseCSV("a;b;c\n1;2");
    expect(rows[0]).toEqual({ a: "1", b: "2", c: "" });
  });

  it("ignora colunas extras da linha (sem header)", () => {
    const rows = parseCSV("a;b\n1;2;3");
    expect(rows[0]).toEqual({ a: "1", b: "2" });
  });

  it("devolve [] quando só há cabeçalho", () => {
    expect(parseCSV("a;b\n")).toEqual([]);
  });

  it("devolve [] para texto vazio", () => {
    expect(parseCSV("")).toEqual([]);
    expect(parseCSV("\uFEFF")).toEqual([]);
  });

  it("não usa a linha em branco como cabeçalho", () => {
    const rows = parseCSV("\n\na;b\n1;2\n");
    expect(rows).toEqual([{ a: "1", b: "2" }]);
  });

  it("lê o CSV de relatório com quebras internas nas observações", () => {
    const csv = [
      "Seq.;Local de votação;Data;Tempo;Observações",
      '1;"Escola Municipal nº 1";02/10/2026;2h;"chegou tarde; ""urna"" ok\nvoltou às 10h"',
    ].join("\n");
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]["Local de votação"]).toBe("Escola Municipal nº 1");
    expect(rows[0].Tempo).toBe("2h");
    expect(rows[0].Observações).toBe(
      'chegou tarde; "urna" ok\nvoltou às 10h'
    );
  });
});

/* ------------------------------------------------------------------ */
/*  getColumn                                                         */
/* ------------------------------------------------------------------ */

describe("getColumn", () => {
  const row = {
    "Nome do Local": "Escola A",
    Municipio: "João Pessoa",
    "qtd_secoes": "10",
  };

  it("encontra a coluna pelo nome exato", () => {
    expect(getColumn(row, ["Nome do Local"])).toBe("Escola A");
  });

  it("ignora diferença de caixa", () => {
    expect(getColumn(row, ["nome do local"])).toBe("Escola A");
  });

  it("ignora acento (Município x Municipio)", () => {
    expect(getColumn(row, ["Município"])).toBe("João Pessoa");
  });

  it("tolerância de variação: _ vs espaço vs pontuação", () => {
    expect(getColumn(row, ["Qtd. Seções"])).toBe("10");
    expect(getColumn(row, ["qtd secoes"])).toBe("10");
  });

  it("percorre as opções na ordem e devolve a primeira que existir", () => {
    expect(getColumn(row, ["Inexistente", "Municipio", "Nome do Local"])).toBe(
      "João Pessoa"
    );
  });

  it('devolve "" quando nenhuma opção existe', () => {
    expect(getColumn(row, ["telefone", "contato"])).toBe("");
  });

  it('devolve "" para coluna presente mas vazia', () => {
    expect(getColumn({ Telefone: "" }, ["telefone"])).toBe("");
  });

  it("restringe a busca às chaves informadas (subconjunto)", () => {
    expect(getColumn(row, ["Nome do Local"], ["Municipio"])).toBe("");
    expect(getColumn(row, ["Municipio"], ["Municipio"])).toBe("João Pessoa");
  });
});
