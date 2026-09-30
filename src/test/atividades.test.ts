import { describe, expect, it } from "vitest";
import {
  agrupaCronogramaPorData,
  calculaDuracaoMinutos,
  filtraCronograma,
  filtrosIniciais,
  formatarDuracao,
  getStatusEfetivo,
  isProximo,
  minutosAte,
  minutosDoDia,
  montaAgenda,
  montaPayloadAtividade,
  normalizaDataHoraPlano,
  normalizaHora,
  rotuloAgenda,
  temFiltrosAtivos,
  validaFormAtividade,
  type FormAtividade,
} from "@/lib/utils/atividades";
import { makeAtividade, makeEquipe, makeLocal } from "@/test/fixtures";
import type { AtividadeCompleta } from "@/lib/actions/atividades";

/* "Agora" fixo: 02/10/2026 10:00 em São Paulo = 13:00Z. */
const AGORA = new Date("2026-10-02T13:00:00.000Z");

describe("getStatusEfetivo", () => {
  it("mantém pendente quando o horário planejado ainda vai acontecer", () => {
    const a = makeAtividade({
      status: "pendente",
      data_hora_planejada: "2026-10-02T12:00:00",
    });
    expect(getStatusEfetivo(a, AGORA)).toBe("pendente");
  });

  it("marca como atrasado quando o horário planejado já passou", () => {
    const a = makeAtividade({
      status: "pendente",
      data_hora_planejada: "2026-10-02T09:00:00",
    });
    expect(getStatusEfetivo(a, AGORA)).toBe("atrasado");
  });

  it("marca em andamento no passado como atrasado", () => {
    const a = makeAtividade({
      status: "em_andamento",
      data_hora_planejada: "2026-10-02T08:00:00",
    });
    expect(getStatusEfetivo(a, AGORA)).toBe("atrasado");
  });

  it("não mexe em atividade concluída, mesmo no passado", () => {
    const a = makeAtividade({
      status: "concluido",
      data_hora_planejada: "2026-01-01T08:00:00",
    });
    expect(getStatusEfetivo(a, AGORA)).toBe("concluido");
  });

  it("não atrasa o que é exatamente agora", () => {
    const a = makeAtividade({
      status: "pendente",
      data_hora_planejada: "2026-10-02T10:00:00", // == AGORA em São Paulo
    });
    expect(getStatusEfetivo(a, AGORA)).toBe("pendente");
  });

  it("usa o fuso de São Paulo, não o da máquina", () => {
    // 00:30 em São Paulo ainda é 00:30 do próprio dia: não é do dia anterior.
    const a = makeAtividade({
      status: "pendente",
      data_hora_planejada: "2026-10-03T00:30:00",
    });
    expect(getStatusEfetivo(a, AGORA)).toBe("pendente");
  });

  it("não deixa o horário de parede virar 'atrasado' por causa do fuso", () => {
    // 23:00 de 02/10 (SP) é 02:00Z de 03/10: quem interpretasse como UTC
    // compararia com 13:00Z de 02/10 e marcaria como atrasado indevidamente.
    const a = makeAtividade({
      status: "pendente",
      data_hora_planejada: "2026-10-02T23:00:00",
    });
    expect(getStatusEfetivo(a, AGORA)).toBe("pendente");
  });
});

describe("minutosAte / isProximo", () => {
  it("calcula a diferença em minutos a partir do fuso do app", () => {
    const a = makeAtividade({ data_hora_planejada: "2026-10-02T10:20:00" });
    expect(minutosAte(a.data_hora_planejada, AGORA)).toBe(20);
  });

  it("destaca pendente a 20 minutos", () => {
    expect(
      isProximo(
        makeAtividade({ status: "pendente", data_hora_planejada: "2026-10-02T10:20:00" }),
        AGORA
      )
    ).toBe(true);
  });

  it("não destaca a mais de 30 minutos", () => {
    expect(
      isProximo(
        makeAtividade({ status: "pendente", data_hora_planejada: "2026-10-02T10:31:00" }),
        AGORA
      )
    ).toBe(false);
  });

  it("não destaca atividade já iniciada ou concluída", () => {
    expect(
      isProximo(
        makeAtividade({ status: "em_andamento", data_hora_planejada: "2026-10-02T10:20:00" }),
        AGORA
      )
    ).toBe(false);
    expect(
      isProximo(
        makeAtividade({ status: "concluido", data_hora_planejada: "2026-10-02T10:20:00" }),
        AGORA
      )
    ).toBe(false);
  });

  it("não destaca horário já passado", () => {
    expect(
      isProximo(
        makeAtividade({ status: "pendente", data_hora_planejada: "2026-10-02T09:50:00" }),
        AGORA
      )
    ).toBe(false);
  });
});

describe("minutosDoDia / normalizaHora", () => {
  it.each([
    ["08:00", 480],
    ["08:30:00", 510],
    ["8:05", 485],
    ["23:59:59", 1439],
    ["00:00", 0],
  ])("%s -> %i", (hora, esperado) => {
    expect(minutosDoDia(hora)).toBe(esperado);
  });

  it.each([null, undefined, "", "abc", "25:00", "10:75"])(
    "rejeita %s",
    (hora) => {
      expect(minutosDoDia(hora as string)).toBeNull();
    }
  );

  it("normaliza para HH:mm:ss", () => {
    expect(normalizaHora("8:05")).toBe("08:05:00");
    expect(normalizaHora("08:00:00")).toBe("08:00:00");
    expect(normalizaHora("")).toBeNull();
    expect(normalizaHora("30:00")).toBeNull();
  });
});

describe("calculaDuracaoMinutos", () => {
  it.each([
    ["08:00", "10:00", 120],
    ["08:00:00", "08:30:00", 30],
    ["09:00", "12:00", 180],
    ["13:15", "13:45", 30],
    ["00:00", "00:01", 1],
  ])("%s – %s -> %i min", (inicio, fim, esperado) => {
    expect(calculaDuracaoMinutos(inicio, fim)).toBe(esperado);
  });

  it("trata virada de meia-noite", () => {
    expect(calculaDuracaoMinutos("23:00", "01:00")).toBe(120);
    expect(calculaDuracaoMinutos("22:00", "02:00")).toBe(240);
  });

  it("devolve 0 quando início e fim são iguais", () => {
    expect(calculaDuracaoMinutos("08:00", "08:00")).toBe(0);
  });

  it("devolve null sem os dois horários", () => {
    expect(calculaDuracaoMinutos("08:00", null)).toBeNull();
    expect(calculaDuracaoMinutos(null, "10:00")).toBeNull();
    expect(calculaDuracaoMinutos(null, null)).toBeNull();
  });

  it("devolve null com horário inválido", () => {
    expect(calculaDuracaoMinutos("08:00", "abc")).toBeNull();
    expect(calculaDuracaoMinutos("25:00", "26:00")).toBeNull();
  });
});

describe("formatarDuracao", () => {
  it.each([
    [0, "0 min"],
    [45, "45 min"],
    [59, "59 min"],
    [60, "1h"],
    [90, "1h 30min"],
    [120, "2h"],
    [181, "3h 1min"],
    [1440, "24h"],
  ])("%i min -> %s", (min, esperado) => {
    expect(formatarDuracao(min)).toBe(esperado);
  });

  it("devolve vazio para null/inválido", () => {
    expect(formatarDuracao(null)).toBe("");
    expect(formatarDuracao(Number.NaN)).toBe("");
    expect(formatarDuracao(undefined)).toBe("");
  });
});

describe("normalizaDataHoraPlano", () => {
  it("mantém data e hora de horário de parede", () => {
    expect(normalizaDataHoraPlano("2026-10-02T08:30")).toBe("2026-10-02T08:30:00");
  });

  it("não duplica os segundos se já vierem", () => {
    expect(normalizaDataHoraPlano("2026-10-02T08:30:45")).toBe("2026-10-02T08:30:00");
  });

  it("usa 00:00 quando só há a data", () => {
    expect(normalizaDataHoraPlano("2026-10-02")).toBe("2026-10-02T00:00:00");
  });

  it("rejeita data inválida ou vazia", () => {
    expect(normalizaDataHoraPlano("")).toBeNull();
    expect(normalizaDataHoraPlano("02/10/2026")).toBeNull();
    expect(normalizaDataHoraPlano("ontem")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  Payload do formulário (bug da duração)                             */
/* ------------------------------------------------------------------ */

const FORM_VALIDO: FormAtividade = {
  local_id: "local-1",
  equipe_id: "equipe-1",
  tipo: "instalacao",
  data_hora_planejada: "2026-10-02T08:00",
  sequencia: "1",
  inicio_planejado: "08:00",
  fim_planejado: "10:00",
  observacoes: "",
};

describe("montaPayloadAtividade", () => {
  it("envia duracao_minutos calculada a partir de Início/Fim", () => {
    expect(montaPayloadAtividade(FORM_VALIDO).duracao_minutos).toBe(120);
  });

  it("recalcula a duração quando o horário de fim muda (bug do relatório)", () => {
    const antes = montaPayloadAtividade(FORM_VALIDO);
    const depois = montaPayloadAtividade({ ...FORM_VALIDO, fim_planejado: "12:30" });
    expect(antes.duracao_minutos).toBe(120);
    expect(depois.duracao_minutos).toBe(270);
  });

  it("recalcula a duração quando o horário de início muda", () => {
    expect(
      montaPayloadAtividade({ ...FORM_VALIDO, inicio_planejado: "09:00" })
        .duracao_minutos
    ).toBe(60);
  });

  it("SEMPRE inclui a chave duracao_minutos, mesmo quando null", () => {
    // Sem a chave, o UPDATE do PostgREST mantém o valor antigo no banco e o
    // trigger (que só recalcula quando é NULL) não corrige a duração.
    const payload = montaPayloadAtividade({ ...FORM_VALIDO, fim_planejado: "" });
    expect("duracao_minutos" in payload).toBe(true);
    expect(payload.duracao_minutos).toBeNull();
  });

  it("limpa a duração quando o fim é apagado", () => {
    const payload = montaPayloadAtividade({
      ...FORM_VALIDO,
      inicio_planejado: "",
      fim_planejado: "",
    });
    expect(payload.inicio_planejado).toBeNull();
    expect(payload.fim_planejado).toBeNull();
    expect(payload.duracao_minutos).toBeNull();
  });

  it("normaliza os horários para HH:mm:ss", () => {
    const payload = montaPayloadAtividade(FORM_VALIDO);
    expect(payload.inicio_planejado).toBe("08:00:00");
    expect(payload.fim_planejado).toBe("10:00:00");
  });

  it("formata a data_hora_planejada sem offset (timestamp sem fuso)", () => {
    expect(montaPayloadAtividade(FORM_VALIDO).data_hora_planejada).toBe(
      "2026-10-02T08:00:00"
    );
  });

  it("converte a sequência em número", () => {
    expect(montaPayloadAtividade({ ...FORM_VALIDO, sequencia: "7" }).sequencia).toBe(7);
    expect(montaPayloadAtividade({ ...FORM_VALIDO, sequencia: "" }).sequencia).toBeNull();
  });

  it("transforma observação vazia em null", () => {
    expect(montaPayloadAtividade(FORM_VALIDO).observacoes).toBeNull();
    expect(
      montaPayloadAtividade({ ...FORM_VALIDO, observacoes: "ok" }).observacoes
    ).toBe("ok");
  });
});

describe("validaFormAtividade", () => {
  it("aceita o formulário completo", () => {
    expect(validaFormAtividade(FORM_VALIDO)).toBeNull();
  });

  it.each([
    ["local_id", "Selecione o local de votação."],
    ["equipe_id", "Selecione a equipe."],
  ])("exige %s", (campo, mensagem) => {
    expect(validaFormAtividade({ ...FORM_VALIDO, [campo]: "" })).toBe(mensagem);
  });

  it("exige a data", () => {
    expect(
      validaFormAtividade({ ...FORM_VALIDO, data_hora_planejada: "" })
    ).toBe("Informe a data da atividade.");
  });

  it("exige o fim quando há início (senão não dá para calcular a duração)", () => {
    expect(
      validaFormAtividade({ ...FORM_VALIDO, fim_planejado: "" })
    ).toBe("Informe o horário de fim para calcular a duração.");
  });

  it("aceita não informar nenhum horário", () => {
    expect(
      validaFormAtividade({
        ...FORM_VALIDO,
        inicio_planejado: "",
        fim_planejado: "",
      })
    ).toBeNull();
  });

  it("rejeita sequência inválida", () => {
    expect(validaFormAtividade({ ...FORM_VALIDO, sequencia: "0" })).toMatch(
      /sequência/i
    );
    expect(validaFormAtividade({ ...FORM_VALIDO, sequencia: "-2" })).toMatch(
      /sequência/i
    );
    expect(validaFormAtividade({ ...FORM_VALIDO, sequencia: "abc" })).toMatch(
      /sequência/i
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Filtros e agrupamento do cronograma                                */
/* ------------------------------------------------------------------ */

const LISTA: AtividadeCompleta[] = [
  makeAtividade({
    id: "a1",
    local_id: "l1",
    equipe_id: "e1",
    data_hora_planejada: "2026-10-02T08:00:00",
    inicio_planejado: "08:00:00",
    fim_planejado: "10:00:00",
    status: "pendente",
    local: makeLocal({ id: "l1", nome: "Escola A", municipio: "João Pessoa" }),
    equipe: makeEquipe({ id: "e1", nome: "Equipe A" }),
  }),
  makeAtividade({
    id: "a2",
    local_id: "l2",
    equipe_id: "e2",
    data_hora_planejada: "2026-10-02T14:00:00",
    inicio_planejado: "14:00:00",
    fim_planejado: "16:00:00",
    status: "pendente",
    tipo: "verificacao",
    local: makeLocal({ id: "l2", nome: "Escola B", municipio: "Campina Grande" }),
    equipe: makeEquipe({ id: "e2", nome: "Equipe B" }),
  }),
  makeAtividade({
    id: "a3",
    local_id: "l1",
    equipe_id: "e1",
    data_hora_planejada: "2026-10-03T09:00:00",
    inicio_planejado: "09:00:00",
    fim_planejado: "11:00:00",
    status: "concluido",
    tipo: "recolhimento_midia",
    local: makeLocal({ id: "l1", nome: "Escola A", municipio: "João Pessoa" }),
    equipe: makeEquipe({ id: "e1", nome: "Equipe A" }),
  }),
];

describe("filtrosIniciais", () => {
  it("começa sem filtros, com o período padrão da tela", () => {
    expect(filtrosIniciais("2026-10-02", "2026-10-04")).toEqual({
      busca: "",
      status: "todos",
      tipo: "todos",
      equipeId: "todos",
      localId: "todos",
      dataInicio: "2026-10-02",
      dataFim: "2026-10-04",
    });
  });
});

describe("temFiltrosAtivos", () => {
  const padrao = { dataInicio: "2026-10-01", dataFim: "2026-10-31" };

  it("false com o período padrão e sem filtros", () => {
    expect(temFiltrosAtivos(filtrosIniciais("2026-10-01", "2026-10-31"), padrao)).toBe(
      false
    );
  });

  it.each([
    { busca: "escola" },
    { status: "pendente" as const },
    { tipo: "instalacao" as const },
    { equipeId: "e1" },
    { localId: "l1" },
    { dataInicio: "2026-10-05" },
    { dataFim: "2026-10-20" },
  ])("true quando muda %o", (mudanca) => {
    const filtros = { ...filtrosIniciais(padrao.dataInicio, padrao.dataFim), ...mudanca };
    expect(temFiltrosAtivos(filtros, padrao)).toBe(true);
  });
});

describe("filtraCronograma", () => {
  const base = filtrosIniciais("2026-10-01", "2026-10-31");

  it("sem filtros devolve tudo", () => {
    expect(filtraCronograma(LISTA, base, AGORA)).toHaveLength(3);
  });

  it("filtra por período (início e fim inclusivos)", () => {
    const f = { ...base, dataInicio: "2026-10-03", dataFim: "2026-10-03" };
    expect(filtraCronograma(LISTA, f, AGORA).map((a) => a.id)).toEqual(["a3"]);
  });

  it("filtra por tipo", () => {
    const f = { ...base, tipo: "verificacao" as const };
    expect(filtraCronograma(LISTA, f, AGORA).map((a) => a.id)).toEqual(["a2"]);
  });

  it("filtra por equipe", () => {
    const f = { ...base, equipeId: "e1" };
    expect(filtraCronograma(LISTA, f, AGORA).map((a) => a.id)).toEqual(["a1", "a3"]);
  });

  it("filtra por local", () => {
    const f = { ...base, localId: "l2" };
    expect(filtraCronograma(LISTA, f, AGORA).map((a) => a.id)).toEqual(["a2"]);
  });

  it("filtra por status efetivo (atrasado entra em 'pendente'? não)", () => {
    const atrasada = makeAtividade({
      id: "atrasada",
      status: "pendente",
      data_hora_planejada: "2026-10-01T08:00:00",
    });
    const lista = [atrasada];
    expect(
      filtraCronograma(lista, { ...base, status: "atrasado" }, AGORA)
    ).toHaveLength(1);
    expect(
      filtraCronograma(lista, { ...base, status: "pendente" }, AGORA)
    ).toHaveLength(0);
  });

  it("busca no nome do local, município, equipe e observações", () => {
    expect(filtraCronograma(LISTA, { ...base, busca: "Escola B" }, AGORA)).toHaveLength(1);
    expect(filtraCronograma(LISTA, { ...base, busca: "campina" }, AGORA)).toHaveLength(1);
    expect(filtraCronograma(LISTA, { ...base, busca: "equipe a" }, AGORA)).toHaveLength(2);
    expect(filtraCronograma(LISTA, { ...base, busca: "  JOÃO  " }, AGORA)).toHaveLength(2);
  });

  it("busca sem resultado devolve lista vazia", () => {
    expect(filtraCronograma(LISTA, { ...base, busca: "inexistente" }, AGORA)).toHaveLength(0);
  });

  it("não muta a lista original", () => {
    const antes = [...LISTA];
    filtraCronograma(LISTA, { ...base, busca: "Escola" }, AGORA);
    expect(LISTA).toEqual(antes);
  });

  it("período vazio (sem limites) não filtra nada", () => {
    const f = { ...base, dataInicio: "", dataFim: "" };
    expect(filtraCronograma(LISTA, f, AGORA)).toHaveLength(3);
  });
});

describe("agrupaCronogramaPorData", () => {
  it("agrupa por dia e ordena por sequência", () => {
    const lista = [
      makeAtividade({ id: "b", data_hora_planejada: "2026-10-02T10:00:00", sequencia: 2 }),
      makeAtividade({ id: "a", data_hora_planejada: "2026-10-02T08:00:00", sequencia: 1 }),
      makeAtividade({ id: "c", data_hora_planejada: "2026-10-03T08:00:00", sequencia: 1 }),
    ];
    const grupos = agrupaCronogramaPorData(lista);
    expect(Object.keys(grupos)).toEqual(["2026-10-02", "2026-10-03"]);
    expect(grupos["2026-10-02"].map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("coloca os sem sequência no fim do dia", () => {
    const grupos = agrupaCronogramaPorData([
      makeAtividade({ id: "sem", data_hora_planejada: "2026-10-02T09:00:00", sequencia: null }),
      makeAtividade({ id: "com", data_hora_planejada: "2026-10-02T08:00:00", sequencia: 1 }),
    ]);
    expect(grupos["2026-10-02"].map((a) => a.id)).toEqual(["com", "sem"]);
  });
});

/* ------------------------------------------------------------------ */
/*  Agenda do painel                                                    */
/* ------------------------------------------------------------------ */

describe("rotuloAgenda", () => {
  const hoje = "2026-10-02";
  it.each([
    ["2026-10-02", "Hoje"],
    ["2026-10-03", "Amanhã"],
    ["2026-10-05", "seg, 5 out"],
    ["2026-10-01", "qui, 1 out"],
  ])("%s -> %s", (data, esperado) => {
    expect(rotuloAgenda(data, hoje)).toBe(esperado);
  });
});

describe("montaAgenda", () => {
  const hoje = "2026-10-02";

  it("inclui hoje e os próximos 7 dias (limite inclusivo), agrupados e rotulados", () => {
    const lista = [
      makeAtividade({ id: "hoje", data_hora_planejada: "2026-10-02T15:00:00" }),
      makeAtividade({ id: "amanha", data_hora_planejada: "2026-10-03T09:00:00" }),
      makeAtividade({ id: "limite", data_hora_planejada: "2026-10-09T09:00:00" }),
      makeAtividade({ id: "ontem", data_hora_planejada: "2026-10-01T09:00:00" }),
      makeAtividade({ id: "futuro", data_hora_planejada: "2026-10-10T09:00:00" }),
    ];
    const agenda = montaAgenda(lista, 7, 12, AGORA, hoje);
    expect(agenda.map((g) => g.dataStr)).toEqual([
      "2026-10-02",
      "2026-10-03",
      "2026-10-09",
    ]);
    expect(agenda[0].rotulo).toBe("Hoje");
    expect(agenda[0].atividades.map((a) => a.id)).toEqual(["hoje"]);
  });

  it("ordena por horário planejado dentro do dia", () => {
    const agenda = montaAgenda(
      [
        makeAtividade({ id: "tarde", data_hora_planejada: "2026-10-02T16:00:00" }),
        makeAtividade({ id: "manha", data_hora_planejada: "2026-10-02T07:00:00" }),
      ],
      7,
      12,
      AGORA,
      hoje
    );
    expect(agenda[0].atividades.map((a) => a.id)).toEqual(["manha", "tarde"]);
  });

  it("esconde concluídas e respeita o limite", () => {
    const lista = [
      makeAtividade({ id: "c", status: "concluido", data_hora_planejada: "2026-10-02T08:00:00" }),
      makeAtividade({ id: "a", data_hora_planejada: "2026-10-02T09:00:00" }),
      makeAtividade({ id: "b", data_hora_planejada: "2026-10-02T10:00:00" }),
    ];
    const agenda = montaAgenda(lista, 7, 1, AGORA, hoje);
    expect(agenda).toHaveLength(1);
    expect(agenda[0].atividades.map((a) => a.id)).toEqual(["a"]);
  });

  it("devolve vazio sem atividades", () => {
    expect(montaAgenda([], 7, 12, AGORA, hoje)).toEqual([]);
  });
});
