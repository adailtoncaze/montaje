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
 * Calcula diferença em dias entre hoje (local) e uma data "YYYY-MM-DD".
 * Útil para contadores regressivos.
 */
export function daysUntil(dateStr: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = parseLocalDate(dateStr);
  const diff = Math.ceil((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

/**
 * Verifica se uma data "YYYY-MM-DD" é hoje (no fuso local).
 */
export function isToday(dateStr: string): boolean {
  const hoje = new Date();
  const alvo = parseLocalDate(dateStr);
  return (
    hoje.getFullYear() === alvo.getFullYear() &&
    hoje.getMonth() === alvo.getMonth() &&
    hoje.getDate() === alvo.getDate()
  );
}

/**
 * Verifica se uma data "YYYY-MM-DD" já passou (no fuso local).
 */
export function isPast(dateStr: string): boolean {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = parseLocalDate(dateStr);
  return alvo < hoje;
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