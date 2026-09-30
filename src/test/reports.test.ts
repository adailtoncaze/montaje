import { describe, expect, it, vi } from "vitest";
import {
  agrupaPorDia,
  agrupaPorEquipe,
  filtraAtividades,
  formatDataBr,
  formatHora,
  formataTimestamp,
  horarioAtividade,
  montaCsv,
  nomeArquivoCsv,
  nomeArquivoPdf,
  slugNome,
  type FiltrosRelatorio,
  type GrupoRelatorio,
} from "@/lib/reports";
import { parseCSV } from "@/lib/csv";
import { makeAtividade, makeEquipe, makeLocal } from "@/test/fixtures";
import type { AtividadeCompleta } from "@/lib/actions/atividades";
import type { MembroResumido } from "@/lib/actions/equipes";

const MEMBROS: Record<string, MembroResumido[]> = {
  e1: [
    { nome: "Bruno Costa", papel: "responsavel" },
    { nome: "Ana Lima", papel: "membro" },
  ],
};

const SEM_FILTRO: FiltrosRelatorio = {
  agruparPor: "equipe",
  tipo: "todas",
  equipeId: "todas",
  municipio: "todos",
  dataInicio: "",
  dataFim: "",
};

/* ------------------------------------------------------------------ */
/*  Formatação                                                         */
/* ------------------------------------------------------------------ */

describe("formatDataBr", () => {
  it.each([
    ["2026-10-02T08:00:00", "02/10/2026"],
    ["2026-10-02", "02/10/2026"],
    ["2026-10-02T08:00:00.123Z", "02/10/2026"],
  ])("%s -> %s", (entrada, esperado) => {
    expect(formatDataBr(entrada)).toBe(esperado);
  });

  it("devolve vazio para entrada inválida", () => {
    expect(formatDataBr("")).toBe("");
    expect(formatDataBr("abc")).toBe("");
  });
});

describe("formatHora", () => {
  it("extrai HH:mm", () => {
    expect(formatHora("2026-10-02T08:30:00")).toBe("08:30");
  });

  it("devolve vazio se a string for curta demais", () => {
    expect(formatHora("2026-10-02")).toBe("");
  });
});

describe("formataTimestamp", () => {
  it("formata dd/MM/yyyy HH:mm com zero à esquerda", () => {
    expect(formataTimestamp(new Date(2026, 9, 2, 8, 5))).toBe("02/10/2026 08:05");
  });
});

/* ------------------------------------------------------------------ */
/*  horárioAtividade — coração do bug da duração                       */
/* ------------------------------------------------------------------ */

describe("horarioAtividade", () => {
  it("monta o intervalo a partir dos horários planejados", () => {
    const a = makeAtividade({
      inicio_planejado: "08:00:00",
      fim_planejado: "10:00:00",
      duracao_minutos: 120,
    });
    expect(horarioAtividade(a)).toMatchObject({
      intervalo: "08:00 – 10:00",
      tempo: "2h",
      duracaoMinutos: 120,
    });
  });

  it("deriva a duração dos horários, ignorando duracao_minutos obsoleta", () => {
    // Cenário do bug: o Início/Fim foram editados na tela, mas a coluna
    // duracao_minutos do banco ficou com o valor antigo.
    const a = makeAtividade({
      inicio_planejado: "09:00:00",
      fim_planejado: "12:30:00",
      duracao_minutos: 120, // obsoleto
    });
    const h = horarioAtividade(a);
    expect(h.intervalo).toBe("09:00 – 12:30");
    expect(h.tempo).toBe("3h 30min");
    expect(h.duracaoMinutos).toBe(210);
  });

  it("formata minutos menores que 60", () => {
    const a = makeAtividade({
      inicio_planejado: "13:15:00",
      fim_planejado: "13:45:00",
      duracao_minutos: 30,
    });
    expect(horarioAtividade(a).tempo).toBe("30 min");
  });

  it("aceita horários sem os segundos", () => {
    const a = makeAtividade({ inicio_planejado: "08:00", fim_planejado: "09:00" });
    expect(horarioAtividade(a).intervalo).toBe("08:00 – 09:00");
  });

  it("cai para o horário da data_hora_planejada quando não há início", () => {
    const a = makeAtividade({
      inicio_planejado: null,
      fim_planejado: null,
      duracao_minutos: 60,
      data_hora_planejada: "2026-10-02T14:00:00",
    });
    const h = horarioAtividade(a);
    expect(h.inicio).toBe("14:00");
    expect(h.fim).toBe("15:00");
    expect(h.tempo).toBe("1h");
  });

  it("usa a duração gravada para derivar o fim quando falta o fim", () => {
    const a = makeAtividade({
      inicio_planejado: "08:00:00",
      fim_planejado: null,
      duracao_minutos: 90,
    });
    expect(horarioAtividade(a).intervalo).toBe("08:00 – 09:30");
  });

  it("usa o padrão de 120 min quando não há fim nem duração", () => {
    const a = makeAtividade({
      inicio_planejado: "08:00:00",
      fim_planejado: null,
      duracao_minutos: null,
    });
    expect(horarioAtividade(a).intervalo).toBe("08:00 – 10:00");
    expect(horarioAtividade(a).tempo).toBe("2h");
  });

  it("trata virada de meia-noite", () => {
    const a = makeAtividade({
      inicio_planejado: "23:00:00",
      fim_planejado: "01:00:00",
      duracao_minutos: null,
    });
    const h = horarioAtividade(a);
    expect(h.intervalo).toBe("23:00 – 01:00");
    expect(h.duracaoMinutos).toBe(120);
  });

  it("devolve vazio quando não há nenhum horário aproveitável", () => {
    const a = makeAtividade({
      inicio_planejado: null,
      fim_planejado: null,
      duracao_minutos: null,
      data_hora_planejada: "",
    });
    expect(horarioAtividade(a)).toMatchObject({
      intervalo: "",
      tempo: "",
      duracaoMinutos: null,
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Filtros                                                            */
/* ------------------------------------------------------------------ */

const LISTA: AtividadeCompleta[] = [
  makeAtividade({
    id: "a1",
    local_id: "l1",
    equipe_id: "e1",
    data_hora_planejada: "2026-10-02T08:00:00",
    sequencia: 2,
    local: makeLocal({ id: "l1", nome: "Escola A", municipio: "João Pessoa" }),
    equipe: makeEquipe({ id: "e1", nome: "Equipe Alfa" }),
  }),
  makeAtividade({
    id: "a2",
    local_id: "l2",
    equipe_id: "e2",
    data_hora_planejada: "2026-10-02T14:00:00",
    sequencia: 1,
    tipo: "verificacao",
    local: makeLocal({ id: "l2", nome: "Escola B", municipio: "Campina Grande" }),
    equipe: makeEquipe({ id: "e2", nome: "Equipe Beta" }),
  }),
  makeAtividade({
    id: "a3",
    local_id: "l1",
    equipe_id: "e1",
    data_hora_planejada: "2026-10-03T09:00:00",
    sequencia: 1,
    local: makeLocal({ id: "l1", nome: "Escola A", municipio: "João Pessoa" }),
    equipe: makeEquipe({ id: "e1", nome: "Equipe Alfa" }),
  }),
];

describe("filtraAtividades", () => {
  it("sem filtros devolve todas, ordenadas por município/data/sequência", () => {
    const r = filtraAtividades(LISTA, SEM_FILTRO);
    // Campina Grande < João Pessoa (ordem alfabética do município)
    expect(r.map((a) => a.id)).toEqual(["a2", "a1", "a3"]);
  });

  it("filtra por tipo", () => {
    const r = filtraAtividades(LISTA, { ...SEM_FILTRO, tipo: "verificacao" });
    expect(r.map((a) => a.id)).toEqual(["a2"]);
  });

  it("filtra por equipe", () => {
    const r = filtraAtividades(LISTA, { ...SEM_FILTRO, equipeId: "e1" });
    expect(r.map((a) => a.id)).toEqual(["a1", "a3"]);
  });

  it("filtra por município", () => {
    const r = filtraAtividades(LISTA, { ...SEM_FILTRO, municipio: "Campina Grande" });
    expect(r.map((a) => a.id)).toEqual(["a2"]);
  });

  it("aceita 'todas' como sentinela do município (bug de filtro vazio)", () => {
    const r = filtraAtividades(LISTA, { ...SEM_FILTRO, municipality: undefined } as never);
    expect(r).toHaveLength(3);
    const r2 = filtraAtividades(LISTA, { ...SEM_FILTRO, municipio: "todas" });
    expect(r2).toHaveLength(3);
  });

  it("aceita 'todos' como sentinela da equipe", () => {
    const r = filtraAtividades(LISTA, { ...SEM_FILTRO, equipeId: "todos" });
    expect(r).toHaveLength(3);
  });

  it("filtra por período (inclusivo)", () => {
    const r = filtraAtividades(LISTA, {
      ...SEM_FILTRO,
      dataInicio: "2026-10-02",
      dataFim: "2026-10-02",
    });
    expect(r.map((a) => a.id)).toEqual(["a2", "a1"]);
  });

  it("ordena municípios sem shift e os não definidos por último", () => {
    const lista = [
      makeAtividade({ id: "x", local: makeLocal({ municipio: "" }) }),
      makeAtividade({ id: "y", local: makeLocal({ municipio: "Zezé" }) }),
      makeAtividade({ id: "z", local: makeLocal({ municipio: "Alfa" }) }),
    ];
    const r = filtraAtividades(lista, SEM_FILTRO);
    expect(r.map((a) => a.id)).toEqual(["z", "y", "x"]);
  });

  it("não muta a lista recebida", () => {
    const antes = LISTA.map((a) => a.id);
    filtraAtividades(LISTA, SEM_FILTRO);
    expect(LISTA.map((a) => a.id)).toEqual(antes);
  });
});

/* ------------------------------------------------------------------ */
/*  Agrupamento                                                        */
/* ------------------------------------------------------------------ */

describe("agrupaPorEquipe", () => {
  it("cria um bloco por equipe, ordenado por título", () => {
    const g = agrupaPorEquipe(filtraAtividades(LISTA, SEM_FILTRO), MEMBROS);
    expect(g.map((x) => x.titulo)).toEqual(["Equipe: Equipe Alfa", "Equipe: Equipe Beta"]);
    expect(g[0].atividades.map((a) => a.id)).toEqual(["a1", "a3"]);
  });

  it("usa o rótulo do tipo de atividade realizado (dinâmico)", () => {
    const lista = [
      makeAtividade({ id: "x", tipo: "instalacao" }),
      makeAtividade({ id: "y", tipo: "recolhimento_urna" }),
    ];
    const g = agrupaPorEquipe(lista);
    expect(g[0].subtitulo).toBe("Instalação de Urna / Recolhimento de Urna");
  });

  it("ordena membros com o responsável primeiro", () => {
    const g = agrupaPorEquipe(filtraAtividades(LISTA, SEM_FILTRO), {
      e1: [
        { nome: "Zeta", papel: "membro" },
        { nome: "Ana", papel: "responsavel" },
        { nome: "Bruno", papel: "membro" },
      ],
    });
    expect(g[0].membros!.map((m) => m.nome)).toEqual(["Ana", "Bruno", "Zeta"]);
  });

  it("anexa os membros da equipe correta", () => {
    const g = agrupaPorEquipe(filtraAtividades(LISTA, SEM_FILTRO), MEMBROS);
    expect(g[0].membros!.map((m) => m.nome)).toEqual(["Bruno Costa", "Ana Lima"]);
    expect(g[1].membros).toEqual([]);
  });

  it("não cria bloco para atividade sem equipe", () => {
    const g = agrupaPorEquipe([makeAtividade({ equipe: null })]);
    expect(g).toEqual([]);
  });

  it("aceita o tipo de equipe legado com fallback", () => {
    const g = agrupaPorEquipe([
      makeAtividade({ equipe: makeEquipe({ tipo: "montagem" as never }) }),
    ]);
    expect(g[0].id).toBe("equipe-1");
  });
});

describe("agrupaPorDia", () => {
  it("cria um bloco por dia, com título em pt-BR", () => {
    const g = agrupaPorDia(filtraAtividades(LISTA, SEM_FILTRO), MEMBROS);
    expect(g.map((x) => x.titulo)).toEqual(["Dia: 02/10/2026", "Dia: 03/10/2026"]);
    expect(g[0].atividades.map((a) => a.id)).toEqual(["a2", "a1"]);
  });

  it("registra as equipes do dia com membros", () => {
    const g = agrupaPorDia(filtraAtividades(LISTA, SEM_FILTRO), MEMBROS);
    expect(g[0].equipes!.map((e) => e.nome)).toEqual(["Equipe Alfa", "Equipe Beta"]);
    expect(g[0].equipes![0].membros).toEqual(MEMBROS.e1);
  });

  it("não duplica a mesma equipe dentro do dia", () => {
    const g = agrupaPorDia(filtraAtividades(LISTA, SEM_FILTRO));
    expect(g[0].equipes).toHaveLength(2);
  });

  it("usa o tipo dinâmico por equipe dentro do dia", () => {
    const lista = [
      makeAtividade({ id: "x", tipo: "instalacao" }),
      makeAtividade({ id: "y", tipo: "recolhimento_urna" }),
    ];
    const g = agrupaPorDia(lista);
    expect(g[0].equipes![0].tipo).toBe("Instalação de Urna / Recolhimento de Urna");
  });

  it("ignora atividade sem data", () => {
    const g = agrupaPorDia([makeAtividade({ data_hora_planejada: "" })]);
    expect(g).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/*  CSV                                                                */
/* ------------------------------------------------------------------ */

describe("montaCsv", () => {
  const grupos: GrupoRelatorio[] = agrupaPorEquipe(
    filtraAtividades(LISTA, SEM_FILTRO),
    MEMBROS
  );

  it("começa com BOM UTF-8 (Excel pt-BR sem acentos quebrados)", () => {
    expect(montaCsv(grupos).charCodeAt(0)).toBe(0xfeff);
  });

  it("usa ; como separador e \\r\\n como quebra de linha", () => {
    const linhas = montaCsv(grupos).replace(/^\uFEFF/, "").split("\r\n");
    expect(linhas[0]).toBe(
      "Seq.;Local de votação;Endereço;Município;Qtd. seções;Tipo de atividade;Data;Horário (início – fim);Tempo;Equipe;LAT Origem;Status;Observações"
    );
    expect(linhas).toHaveLength(4); // cabeçalho + 3 atividades
  });

  it("leva o intervalo e a duração recalculados para o CSV", () => {
    const editado = agrupaPorEquipe([
      makeAtividade({
        inicio_planejado: "09:00:00",
        fim_planejado: "12:30:00",
        duracao_minutos: 120, // valor obsoleto no banco
      }),
    ]);
    const linhas = montaCsv(editado).replace(/^\uFEFF/, "").split("\r\n");
    const campos = linhas[1].split(";");
    expect(campos[7]).toBe("09:00 – 12:30");
    expect(campos[8]).toBe("3h 30min");
  });

  it("é reparseável por parseCSV (round-trip)", () => {
    const linhas = parseCSV(montaCsv(grupos));
    expect(linhas).toHaveLength(3);
    expect(linhas[0]["Local de votação"]).toBe("Escola A");
    expect(linhas[0].Tempo).toBe("2h");
  });

  it("escapa aspas, ponto e vírgula e quebras de linha", () => {
    const comCaractere = agrupaPorEquipe([
      makeAtividade({
        observacoes: 'Trocou a urna; "semBattery", depois\nvoltou',
      }),
    ]);
    const linhas = parseCSV(montaCsv(comCaractere));
    expect(linhas[0].Observações).toBe(
      'Trocou a urna; "semBattery", depois\nvoltou'
    );
  });

  it("mantém a data em formato pt-BR", () => {
    const linhas = parseCSV(montaCsv(grupos));
    // primeiro bloco = "Equipe Alfa" (ordem alfabética dos grupos), 1ª atividade = 02/10
    expect(linhas[0].Data).toBe("02/10/2026");
    expect(linhas[1].Data).toBe("03/10/2026");
  });

  it("usa a sequência cadastrada na atividade (não a posição da linha)", () => {
    const linhas = parseCSV(montaCsv(grupos));
    // Equipe Alfa: a1 (seq. 2) e a3 (seq. 1); Equipe Beta: a2 (seq. 1)
    expect(linhas.map((l) => l["Seq."])).toEqual(["2", "1", "1"]);
  });

  it("deixa a Seq. vazia quando a atividade não tem sequência", () => {
    const semSeq = agrupaPorEquipe([
      makeAtividade({ sequencia: null }),
      makeAtividade({ sequencia: 5 }),
    ]);
    const linhas = parseCSV(montaCsv(semSeq));
    expect(linhas.map((l) => l["Seq."])).toEqual(["", "5"]);
  });

  it("usa o status efetivo (atraso) no CSV, como a tela", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T12:00:00Z")); // 09:00 em São Paulo
    const atrasada = agrupaPorEquipe([
      makeAtividade({
        status: "pendente",
        data_hora_planejada: "2026-10-02T08:00:00", // 08:00 < agora (09:00)
      }),
      makeAtividade({
        status: "concluido",
        data_hora_planejada: "2026-10-02T08:00:00",
      }),
    ]);
    const linhas = parseCSV(montaCsv(atrasada));
    expect(linhas.map((l) => l.Status)).toEqual(["Atrasado", "Concluído"]);
  });

  it("devolve só o cabeçalho para lista vazia", () => {
    expect(montaCsv([]).replace(/^\uFEFF/, "").split("\r\n")).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/*  Nomes de arquivo                                                   */
/* ------------------------------------------------------------------ */

describe("slugNome", () => {
  it.each([
    ["Equipe Alfa", "equipe-alfa"],
    ["Dia: 02/10/2026", "dia-02-10-2026"],
    ["Ação & Reação", "acao-reacao"],
    ["   ", "relatorio"],
    ["çàé", "cae"],
  ])("%s -> %s", (entrada, esperado) => {
    expect(slugNome(entrada)).toBe(esperado);
  });
});

describe("nomeArquivoPdf / nomeArquivoCsv", () => {
  const meta = { ano: 2026, turno: 1, zonaEleitoral: "123ª", tipoLabel: "" };

  it("usa o título do grupo quando há só um", () => {
    const g: GrupoRelatorio[] = [{ id: "e1", titulo: "Equipe: Alfa", atividades: [] }];
    expect(nomeArquivoPdf(g)).toBe("Cronograma-equipe-alfa.pdf");
    expect(nomeArquivoCsv(g)).toBe("Relatorio-equipe-alfa.csv");
  });

  it("inclui ano e timestamp quando há vários grupos", () => {
    const g: GrupoRelatorio[] = [
      { id: "1", titulo: "A", atividades: [] },
      { id: "2", titulo: "B", atividades: [] },
    ];
    expect(nomeArquivoPdf(g, meta)).toMatch(/^CronogramaMontaJE-2026-\d{8}-\d{4}\.pdf$/);
    expect(nomeArquivoCsv(g, meta)).toMatch(
      /^RelatorioAtividades-2026-\d{8}-\d{6}\.csv$/
    );
  });
});
