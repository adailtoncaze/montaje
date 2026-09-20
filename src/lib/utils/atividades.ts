import type { AtividadeCompleta } from "@/lib/actions/atividades";

/** Calcula o status efetivo considerando atraso (replica a view atividades_com_status). */
export function getStatusEfetivo(atividade: AtividadeCompleta): "pendente" | "em_andamento" | "concluido" | "atrasado" {
  const { status, data_hora_planejada } = atividade;
  if (status === "pendente" || status === "em_andamento") {
    const agora = new Date();
    const planejada = new Date(data_hora_planejada);
    if (planejada < agora) return "atrasado";
  }
  return status;
}

/** Verifica se a atividade está próxima (≤30 min do horário planejado). */
export function isProximo(atividade: AtividadeCompleta): boolean {
  const agora = new Date();
  const planejada = new Date(atividade.data_hora_planejada);
  const diffMin = (planejada.getTime() - agora.getTime()) / 60000;
  return atividade.status === "pendente" && diffMin > 0 && diffMin <= 30;
}