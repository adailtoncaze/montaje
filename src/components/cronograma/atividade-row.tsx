"use client";

import { MapPin, Users, Clock, AlertTriangle, CheckCircle, Loader2, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TipoAtividadeBadge, StatusAtividadeBadge } from "./filtros";
import type { AtividadeCompleta } from "@/lib/actions/atividades";
import { getStatusEfetivo } from "@/lib/utils/atividades";
import { formatTimeBr } from "@/lib/utils/date";

interface AtividadeRowProps {
  atividade: AtividadeCompleta;
  onClick?: () => void;
  showLocal?: boolean;
  showEquipe?: boolean;
}

export function AtividadeRow({
  atividade,
  onClick,
  showLocal = true,
  showEquipe = true,
}: AtividadeRowProps) {
  const { local, equipe, tipo, data_hora_planejada, data_hora_real, status, observacoes } = atividade;
  const statusEfetivo = getStatusEfetivo(atividade);

  const isProximo = status === "pendente" && isProximoAgora(data_hora_planejada);
  const isAtrasado = statusEfetivo === "atrasado";

  return (
    <tr
      className={cn(
        "border-b border-stroke-subtle transition-colors duration-100",
        "last:border-b-0",
        onClick && "cursor-pointer hover:bg-surface-subtle active:bg-stroke",
      )}
      onClick={onClick}
    >
      {/* Horário */}
      <td className="px-4 py-3 text-fg whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <Clock className="size-4 text-fg-3" />
          <span className="font-medium text-body">{formatTimeBr(data_hora_planejada)}</span>
          {isProximo && (
            <Badge tone="warning" className="text-micro">
              <AlertTriangle className="size-3 mr-1" />
              Próximo
            </Badge>
          )}
        </div>
        {data_hora_real && (
          <div className="mt-0.5 flex items-center gap-1.5 text-caption text-fg-3">
            <CheckCircle className="size-3.5 text-success" />
            <span>Real: {formatTimeBr(data_hora_real)}</span>
          </div>
        )}
      </td>

      {/* Tipo */}
      <td className="px-4 py-3 text-fg">
        <TipoAtividadeBadge tipo={tipo} />
      </td>

      {/* Local */}
      {showLocal && (
        <td className="px-4 py-3 text-fg">
          {local ? (
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-fg-3 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-body truncate">{local.nome}</p>
                <p className="text-caption text-fg-3 truncate">{local.municipio}</p>
              </div>
            </div>
          ) : (
            <span className="text-caption text-fg-3">—</span>
          )}
        </td>
      )}

      {/* Equipe */}
      {showEquipe && (
        <td className="px-4 py-3 text-fg">
          {equipe ? (
            <div className="flex items-center gap-2">
              <Users className="size-4 text-fg-3 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-body truncate">{equipe.nome}</p>
                <p className="text-caption text-fg-3 capitalize">{equipe.tipo}</p>
              </div>
            </div>
          ) : (
            <span className="text-caption text-fg-3">—</span>
          )}
        </td>
      )}

      {/* Status */}
      <td className="px-4 py-3 text-fg">
        <StatusAtividadeBadge status={statusEfetivo} />
        {isAtrasado && (
          <Badge tone="danger" dot className="mt-1.5 text-micro">
            Atrasado
          </Badge>
        )}
      </td>

      {/* Observações */}
      <td className="px-4 py-3 text-fg">
        {observacoes ? (
          <p className="text-body truncate max-w-xs" title={observacoes}>
            {observacoes}
          </p>
        ) : (
          <span className="text-caption text-fg-3">—</span>
        )}
      </td>
    </tr>
  );
}

function isProximoAgora(iso: string): boolean {
  const agora = new Date();
  const planejada = new Date(iso);
  const diffMin = (planejada.getTime() - agora.getTime()) / 60000;
  return diffMin > 0 && diffMin <= 30; // 30 min = ALERTA_PROXIMO_MINUTOS
}