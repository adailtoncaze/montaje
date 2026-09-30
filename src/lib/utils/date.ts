import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Locale } from "date-fns";

/**
 * Detecta se um timestamp vem com fuso horário explícito.
 * Ex: "2026-10-02T11:00:00.000Z" ou "2026-10-02T08:00:00-03:00" → true
 *     "2026-10-02T08:00:00"                                          → false
 */
export function hasTimezone(timestamp: string): boolean {
  return /[zZ]|[+-]\d{2}:\d{2}$/.test(timestamp);
}

/**
 * Parseia string "YYYY-MM-DD" como Date local (meia-noite no fuso do navegador).
 * Evita problemas de timezone ao exibir datas do banco.
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Formata string "YYYY-MM-DD" para exibição local.
 * Evita problemas de timezone.
 */
export function formatLocalDate(
  dateStr: string,
  formatStr: string = "d 'de' MMMM",
  locale: Locale = ptBR
): string {
  const date = parseLocalDate(dateStr);
  return format(date, formatStr, { locale });
}

/**
 * Fuso de referência do app: as atividades e as datas da eleição são
 * cadastradas no horário de São Paulo (UTC-3 fixo desde 2019, sem horário
 * de verão). Usar o fuso do navegador/desempenho do servidor produzia
 * divergência de um dia entre o servidor e o cliente.
 */
export const TZ_APP = "America/Sao_Paulo";

/** Data de hoje (YYYY-MM-DD) no fuso do app — fonte única de "hoje". */
export function hojeSaoPaulo(agora: Date = new Date()): string {
  return agora.toLocaleDateString("en-CA", { timeZone: TZ_APP });
}

/** Soma (ou subtrai) dias a uma data "YYYY-MM-DD" sem passar por Date. */
export function addDias(dateStr: string, dias: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d) + dias * 86_400_000;
  const dt = new Date(base);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Diferença em dias inteiros entre duas datas "YYYY-MM-DD" (b - a). */
export function diffDias(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ta = Date.UTC(ay, am - 1, ad);
  const tb = Date.UTC(by, bm - 1, bd);
  return Math.round((tb - ta) / 86_400_000);
}

/**
 * Calcula a diferença em dias entre hoje (fuso do app) e uma data
 * "YYYY-MM-DD". Negativo = a data já passou.
 */
export function daysUntil(dateStr: string, hoje: string = hojeSaoPaulo()): number {
  return diffDias(hoje, dateStr);
}

/** Verifica se uma data "YYYY-MM-DD" é hoje (no fuso do app). */
export function isToday(dateStr: string, hoje: string = hojeSaoPaulo()): boolean {
  return dateStr === hoje;
}

/** Verifica se uma data "YYYY-MM-DD" já passou (no fuso do app). */
export function isPast(dateStr: string, hoje: string = hojeSaoPaulo()): boolean {
  return diffDias(hoje, dateStr) < 0;
}

/**
 * Extrai a data local (YYYY-MM-DD) de um timestamp.
 * - Sem fuso (horário de parede): a data é literal — extraída direto da string.
 * - Com fuso (timestamptz): converte para o fuso local do navegador.
 * Ex: "2026-10-02T00:00:00"           -> "2026-10-02" (sem conversão)
 *     "2026-10-02T11:00:00.000Z"      -> "2026-10-02" (em UTC-3)
 * Evita o problema de off-by-one ao usar toISOString() que retorna data UTC.
 */
export function getLocalDateFromTimestamp(timestamp: string): string {
  if (!hasTimezone(timestamp)) {
    return timestamp.slice(0, 10);
  }
  const date = new Date(timestamp);
  // Usa getFullYear, getMonth, getDate do objeto Date que já está no fuso local do navegador
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Formata a hora (HH:mm) de um timestamp para exibição.
 * - Sem fuso (horário de parede): exibe o valor literal (o que foi digitado).
 * - Com fuso (timestamptz): converte para America/Sao_Paulo.
 */
export function formatTimeBr(timestamp: string): string {
  if (!hasTimezone(timestamp)) {
    return timestamp.slice(11, 16);
  }
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

/**
 * Interpreta "YYYY-MM-DDTHH:mm[:ss]" (sem fuso — horário de parede em
 * America/Sao_Paulo) como um instante absoluto (Date). O Brasil usa UTC-3 fixo
 * (sem horário de verão desde 2019). Útil para comparações no servidor, onde o
 * fuso padrão da máquina não é o do usuário.
 */
export function parseSaoPauloDate(dateStr: string): Date {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?/);
  if (!m) return new Date(dateStr);
  const [, y, mo, d, h, mi, s = "0"] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h + 3, +mi, +s));
}

/**
 * Formata timestamp com timezone (timestamptz) para exibição local.
 * Ex: "2026-10-02T15:30:00.000Z" -> "02/10/2026 12:30" (em UTC-3)
 */
export function formatTimestamp(timestamp: string, formatStr: string = "d/M/yyyy HH:mm"): string {
  return format(new Date(timestamp), formatStr, { locale: ptBR });
}