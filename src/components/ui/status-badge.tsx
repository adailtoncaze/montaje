import { STATUS_ATIVIDADE_LABEL } from "@/lib/constants";
import type { StatusAtividade } from "@/types/database";
import { Badge, type BadgeTone } from "./badge";

const tone: Record<StatusAtividade, BadgeTone> = {
  pendente: "neutral",
  em_andamento: "brand",
  concluido: "success",
  atrasado: "danger",
};

/** Badge de status da atividade. `proximo` = horário planejado dentro da janela de alerta (PRD 4.6). */
export function StatusBadge({
  status,
  proximo,
}: {
  status: StatusAtividade;
  proximo?: boolean;
}) {
  if (proximo && status === "pendente") {
    return <Badge tone="warning">Próximo</Badge>;
  }
  return <Badge tone={tone[status]}>{STATUS_ATIVIDADE_LABEL[status]}</Badge>;
}
