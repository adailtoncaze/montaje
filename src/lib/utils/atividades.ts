import type { AtividadeCompleta } from "@/lib/actions/atividades";
import type {
  StatusAtividade,
  TipoAtividade,
} from "@/types/database";
import { ALERTA_PROXIMO_MINUTOS } from "@/lib/constants";
import {
  addDias,
  diffDias,
  getLocalDateFromTimestamp,
  hojeSaoPaulo,
  parseSaoPauloDate,
} from "@/lib/utils/date";

/**
 * Fonte única da lógica de atividades (usada por painel, cronograma,
 * relatórios e testes).
 *
 * Contexto importante: `data_hora_planejada` é `timestamp without time zone`
 * (horário de parede em São Paulo, ver migração 0004). Instantes portanto
 * precisam passar por `parseSaoPauloDate` — usar `new Date(...)` direto
 * interpreta o valor no fuso da máquina e gera divergência de 3 horas
 * (logo, "atrasado" vs "pendente" errados no servidor/UTC).
 */

/* ------------------------------------------------------------------ */
/*  Status efetivo e destaque                                         */
/* ------------------------------------------------------------------ */

/**
 * Status efetivo considerando atraso (espelha a view `atividades_com_status`).
 * `agora` é injetável para tornar a função determinística nos testes.
 */
export function getStatusEfetivo(
  atividade: Pick<AtividadeCompleta, "status" | "data_hora_planejada">,
  agora: Date = new Date()
): StatusAtividade {
  const { status, data_hora_planejada } = atividade;
  if (status === "pendente" || status === "em_andamento") {
    if (parseSaoPauloDate(data_hora_planejada) < agora) return "atrasado";
  }
  return status;
}

/** Minutos até a atividade começar (negativo = já começou). */
export function minutosAte(
  dataHoraPlanejada: string,
  agora: Date = new Date()
): number {
  return (parseSaoPauloDate(dataHoraPlanejada).getTime() - agora.getTime()) / 60000;
}

/** Atividade pendente e dentro da janela de destaque (≤30 min). */
export function isProximo(
  atividade: Pick<AtividadeCompleta, "status" | "data_hora_planejada">,
  agora: Date = new Date()
): boolean {
  if (atividade.status !== "pendente") return false;
  const diffMin = minutosAte(atividade.data_hora_planejada, agora);
  return diffMin > 0 && diffMin <= ALERTA_PROXIMO_MINUTOS;
}

/* ------------------------------------------------------------------ */
/*  Horários planejados e duração                                     */
/* ------------------------------------------------------------------ */

/** "HH:mm" / "HH:mm:ss" → minutos desde a meia-noite; null se inválido. */
export function minutosDoDia(hora: string | null | undefined): number | null {
  if (!hora) return null;
  const m = String(hora).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Normaliza "HH:mm" / "HH:mm:ss" para o formato `time` do Postgres. */
export function normalizaHora(hora: string | null | undefined): string | null {
  if (minutosDoDia(hora) === null) return null;
  const m = String(hora).match(/^(\d{1,2}):(\d{2})/);
  return `${m![1].padStart(2, "0")}:${m![2]}:00`;
}

/**
 * Duração em minutos entre início e fim.
 * - `fim` anterior a `inicio` é tratado como virada de meia-noite (22h).
 * - Sem os dois valores (ou com valor inválido) → null.
 */
export function calculaDuracaoMinutos(
  inicio: string | null | undefined,
  fim: string | null | undefined
): number | null {
  const i = minutosDoDia(inicio);
  const f = minutosDoDia(fim);
  if (i === null || f === null) return null;
  const bruto = f - i;
  return bruto < 0 ? bruto + 24 * 60 : bruto;
}

/** "180" → "3h"; "90" → "1h 30min"; "45" → "45 min". */
export function formatarDuracao(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min)) return "";
  const total = Math.max(0, Math.round(min));
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

/* ------------------------------------------------------------------ */
/*  Formulário de atividade (criação/edição)                           */
/* ------------------------------------------------------------------ */

export interface FormAtividade {
  local_id: string;
  equipe_id: string;
  tipo: TipoAtividade;
  /** "YYYY-MM-DDTHH:mm" (o `input[type=date]` só edita a parte da data). */
  data_hora_planejada: string;
  /** Texto livre: vazio → null. */
  sequencia: string;
  /** "HH:mm". */
  inicio_planejado: string;
  /** "HH:mm". */
  fim_planejado: string;
  observacoes: string;
}

export const FORM_ATIVIDADE_VAZIO: FormAtividade = {
  local_id: "",
  equipe_id: "",
  tipo: "instalacao",
  data_hora_planejada: "",
  sequencia: "",
  inicio_planejado: "",
  fim_planejado: "",
  observacoes: "",
};

/**
 * Payload de criação/edição de atividade. Satisfaz tanto `TablesInsert`
 * (com os campos obrigatórios garantidos pelo formulário) quanto
 * `TablesUpdate` do Supabase.
 */
export type PayloadAtividade = {
  local_id: string;
  equipe_id: string;
  tipo: TipoAtividade;
  data_hora_planejada: string;
  sequencia: number | null;
  inicio_planejado: string | null;
  fim_planejado: string | null;
  duracao_minutos: number | null;
  observacoes: string | null;
};

/** "YYYY-MM-DDTHH:mm" | "YYYY-MM-DD" → timestamp `without time zone`. */
export function normalizaDataHoraPlano(valor: string): string | null {
  const v = (valor ?? "").trim();
  if (!v) return null;
  const data = v.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const resto = v.length >= 11 ? v.slice(11, 16) : "00:00";
  const hora = /^\d{2}:\d{2}$/.test(resto) ? resto : "00:00";
  return `${data}T${hora}:00`;
}

/**
 * Monta o payload enviado ao Supabase.
 *
 * `duracao_minutos` é sempre enviada (mesmo quando null) para que o banco
 * nunca conserve uma duração obsoleta: sem isso, editar só o Início/Fim
 * deixava a coluna "Tempo" dos relatórios com o valor antigo — o trigger
 * `atividades_calcula_horarios` só recalcula a duração quando ela é NULL.
 */
export function montaPayloadAtividade(
  form: FormAtividade
): PayloadAtividade {
  const inicio = normalizaHora(form.inicio_planejado);
  const fim = normalizaHora(form.fim_planejado);
  const sequencia = form.sequencia.trim();

  return {
    local_id: form.local_id,
    equipe_id: form.equipe_id,
    tipo: form.tipo,
    data_hora_planejada: normalizaDataHoraPlano(form.data_hora_planejada) ?? "",
    sequencia: sequencia ? Number.parseInt(sequencia, 10) : null,
    inicio_planejado: inicio,
    fim_planejado: fim,
    duracao_minutos: calculaDuracaoMinutos(inicio, fim),
    observacoes: form.observacoes.trim() ? form.observacoes : null,
  };
}

/** Mensagem de erro do formulário, ou null se estiver válido. */
export function validaFormAtividade(form: FormAtividade): string | null {
  if (!form.local_id) return "Selecione o local de votação.";
  if (!form.equipe_id) return "Selecione a equipe.";
  if (!form.tipo) return "Selecione o tipo de atividade.";
  if (!normalizaDataHoraPlano(form.data_hora_planejada))
    return "Informe a data da atividade.";

  const seq = form.sequencia.trim();
  if (seq && (!/^\d+$/.test(seq) || Number.parseInt(seq, 10) < 1))
    return "A sequência deve ser um número inteiro maior que zero.";

  if (
    normalizaHora(form.inicio_planejado) === null &&
    form.inicio_planejado.trim() !== ""
  )
    return "Início inválido (use HH:mm).";

  if (
    normalizaHora(form.fim_planejado) === null &&
    form.fim_planejado.trim() !== ""
  )
    return "Fim inválido (use HH:mm).";

  if (normalizaHora(form.inicio_planejado) && !form.fim_planejado.trim())
    return "Informe o horário de fim para calcular a duração.";

  return null;
}

/* ------------------------------------------------------------------ */
/*  Filtros e agrupamento do cronograma                                */
/* ------------------------------------------------------------------ */

export interface FiltrosCronograma {
  busca: string;
  status: StatusAtividade | "todos";
  tipo: TipoAtividade | "todos";
  equipeId: string | "todos";
  localId: string | "todos";
  dataInicio: string; // "YYYY-MM-DD" ("" = sem limite)
  dataFim: string;
}

export const FILTROS_CRONOGRAMA_VAZIO: Omit<
  FiltrosCronograma,
  "dataInicio" | "dataFim"
> = {
  busca: "",
  status: "todos",
  tipo: "todos",
  equipeId: "todos",
  localId: "todos",
};

/** Monta o estado inicial dos filtros, já com o período padrão da tela. */
export function filtrosIniciais(dataInicio: string, dataFim: string): FiltrosCronograma {
  return { ...FILTROS_CRONOGRAMA_VAZIO, dataInicio, dataFim };
}

/** Aplica busca textual + status/tipo/equipe/local/período. */
export function filtraCronograma(
  atividades: AtividadeCompleta[],
  filtros: FiltrosCronograma,
  agora: Date = new Date()
): AtividadeCompleta[] {
  const termo = filtros.busca.trim().toLowerCase();
  return atividades.filter((a) => {
    if (termo) {
      const alvo = [
        a.local?.nome,
        a.local?.municipio,
        a.equipe?.nome,
        a.observacoes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!alvo.includes(termo)) return false;
    }
    if (filtros.status !== "todos" && getStatusEfetivo(a, agora) !== filtros.status)
      return false;
    if (filtros.tipo !== "todos" && a.tipo !== filtros.tipo) return false;
    if (filtros.equipeId !== "todos" && a.equipe_id !== filtros.equipeId) return false;
    if (filtros.localId !== "todos" && a.local_id !== filtros.localId) return false;

    if (filtros.dataInicio || filtros.dataFim) {
      const dia = getLocalDateFromTimestamp(a.data_hora_planejada);
      if (filtros.dataInicio && dia < filtros.dataInicio) return false;
      if (filtros.dataFim && dia > filtros.dataFim) return false;
    }
    return true;
  });
}

/** Agrupa por dia (YYYY-MM-DD), ordenando por sequência dentro de cada dia. */
export function agrupaCronogramaPorData(
  atividades: AtividadeCompleta[]
): Record<string, AtividadeCompleta[]> {
  const grupos: Record<string, AtividadeCompleta[]> = {};
  for (const a of atividades) {
    const chave = getLocalDateFromTimestamp(a.data_hora_planejada);
    (grupos[chave] ??= []).push(a);
  }
  for (const chave of Object.keys(grupos)) {
    grupos[chave].sort(
      (a, b) => (a.sequencia ?? Number.MAX_SAFE_INTEGER) - (b.sequencia ?? Number.MAX_SAFE_INTEGER)
    );
  }
  return grupos;
}

/** Há algum filtro diferente do padrão? */
export function temFiltrosAtivos(
  filtros: FiltrosCronograma,
  padrao: Pick<FiltrosCronograma, "dataInicio" | "dataFim">
): boolean {
  return (
    filtros.busca !== "" ||
    filtros.status !== "todos" ||
    filtros.tipo !== "todos" ||
    filtros.equipeId !== "todos" ||
    filtros.localId !== "todos" ||
    filtros.dataInicio !== padrao.dataInicio ||
    filtros.dataFim !== padrao.dataFim
  );
}

/* ------------------------------------------------------------------ */
/*  Agenda do painel                                                   */
/* ------------------------------------------------------------------ */

export interface GrupoAgenda {
  dataStr: string;
  /** "Hoje", "Amanhã" ou "qui, 2 out" (via `rotuloDataCurto`). */
  rotulo: string;
  atividades: AtividadeCompleta[];
}

/** Rótulo curto da agenda: Hoje / Amanhã / "EEE, d MMM". */
export function rotuloAgenda(dataStr: string, hoje: string = hojeSaoPaulo()): string {
  const diff = diffDias(hoje, dataStr);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  return formatarDataCurta(dataStr);
}

const MESES_CURTOS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];
const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function formatarDataCurta(dataStr: string): string {
  const [y, m, d] = dataStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DIAS_CURTOS[dt.getUTCDay()]}, ${d} ${MESES_CURTOS[m - 1]}`;
}

/**
 * Agenda do painel: atividades não concluídas entre hoje e `dias` à frente,
 * agrupadas por dia e ordenadas por horário planejado.
 */
export function montaAgenda(
  atividades: AtividadeCompleta[],
  dias = 7,
  limite = 12,
  agora: Date = new Date(),
  hoje: string = hojeSaoPaulo(agora)
): GrupoAgenda[] {
  const fim = addDias(hoje, dias);

  const lista = atividades
    .filter((a) => {
      const dia = getLocalDateFromTimestamp(a.data_hora_planejada);
      return (
        dia >= hoje &&
        dia <= fim &&
        getStatusEfetivo(a, agora) !== "concluido"
      );
    })
    .sort(
      (a, b) =>
        parseSaoPauloDate(a.data_hora_planejada).getTime() -
        parseSaoPauloDate(b.data_hora_planejada).getTime()
    )
    .slice(0, limite);

  const grupos: GrupoAgenda[] = [];
  for (const a of lista) {
    const dataStr = getLocalDateFromTimestamp(a.data_hora_planejada);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dataStr === dataStr) ultimo.atividades.push(a);
    else grupos.push({ dataStr, rotulo: rotuloAgenda(dataStr, hoje), atividades: [a] });
  }
  return grupos;
}
