"use client";

import { useMemo } from "react";
import { Activity, AlertTriangle, CheckCircle, ChevronRight, Clock, MapPin, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getLocalDateFromTimestamp, formatTimeBr, formatLocalDate, daysUntil } from "@/lib/utils/date";
import { TIPO_ATIVIDADE_LABEL } from "@/lib/constants";
import { getStatusEfetivo } from "@/lib/utils/atividades";
import type { AtividadeCompleta } from "@/lib/actions/atividades";
import type { Tables } from "@/types/supabase";

type ConfigEleicao = Tables<"configuracao_eleicao">;

/** Cor do badge por tipo de atividade (4 tipos atuais). */
const TIPO_TONE: Record<string, BadgeTone> = {
  instalacao: "brand",
  verificacao: "success",
  recolhimento_midia: "warning",
  recolhimento_urna: "danger",
};

const STATUS_DOT: Record<string, string> = {
  pendente: "bg-fg-3",
  em_andamento: "bg-brand",
  atrasado: "bg-danger",
};

interface PainelViewProps {
  config: ConfigEleicao | null;
  atividades: AtividadeCompleta[];
  equipes: Tables<"equipes">[];
  locais: Tables<"locais_votacao">[];
  isAdmin: boolean;
}

export function PainelView({
  config,
  atividades,
  equipes,
  locais,
  isAdmin,
}: PainelViewProps) {
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const hojeStr = getLocalDateFromTimestamp(agora.toISOString());

  // KPIs
  const kpis = useMemo(() => {
    const total = atividades.length;
    const concluidas = atividades.filter((a) => getStatusEfetivo(a) === "concluido").length;
    const emAndamento = atividades.filter((a) => getStatusEfetivo(a) === "em_andamento").length;
    const pendentes = atividades.filter((a) => getStatusEfetivo(a) === "pendente").length;
    const atrasadas = atividades.filter((a) => getStatusEfetivo(a) === "atrasado").length;
    const pctConcluidas = total > 0 ? Math.round((concluidas / total) * 100) : 0;

    return { total, concluidas, emAndamento, pendentes, atrasadas, pctConcluidas };
  }, [atividades]);

  // Agenda: atividades pendentes de hoje aos próximos 7 dias, agrupadas por dia
  const agenda = useMemo(() => {
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() + 7);
    const limiteStr = getLocalDateFromTimestamp(limite.toISOString());
    const lista = atividades
      .filter((a) => {
        const dataStr = getLocalDateFromTimestamp(a.data_hora_planejada);
        return dataStr >= hojeStr && dataStr <= limiteStr && getStatusEfetivo(a) !== "concluido";
      })
      .sort((a, b) => new Date(a.data_hora_planejada).getTime() - new Date(b.data_hora_planejada).getTime())
      .slice(0, 12);

    const grupos: { dataStr: string; rotulo: string; atividades: AtividadeCompleta[] }[] = [];
    for (const a of lista) {
      const dataStr = getLocalDateFromTimestamp(a.data_hora_planejada);
      const ultimo = grupos[grupos.length - 1];
      if (!ultimo || ultimo.dataStr !== dataStr) {
        const diff = daysUntil(dataStr);
        const rotulo = diff === 0 ? "Hoje" : diff === 1 ? "Amanhã" : formatLocalDate(dataStr, "EEE, d MMM");
        grupos.push({ dataStr, rotulo, atividades: [a] });
      } else {
        ultimo.atividades.push(a);
      }
    }
    return grupos;
  }, [atividades]);

  // Atividades por tipo
  const porTipo = useMemo(() => {
    const tipos = ["instalacao", "verificacao", "recolhimento_midia", "recolhimento_urna"] as const;
    return tipos.map((tipo) => {
      const total = atividades.filter((a) => a.tipo === tipo).length;
      const concluidas = atividades.filter((a) => a.tipo === tipo && getStatusEfetivo(a) === "concluido").length;
      return { tipo, total, concluidas };
    });
  }, [atividades]);

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Activity className="mx-auto mb-4 size-12 text-fg-2" />
        <h2 className="text-title font-semibold text-fg mb-2">Eleição não configurada</h2>
        <p className="text-body text-fg-3 max-w-xs">
          Configure a eleição ativa em <Button variant="subtle" className="p-0 h-auto" asChild>
          <a href="/ajustes">Ajustes</a>
        </Button> para começar.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Ações */}
      {isAdmin && (
        <div className="flex items-center justify-end">
          <Button variant="primary" asChild>
            <a href="/cronograma">
              <Plus className="size-4 mr-2" />
              Nova Atividade
            </a>
          </Button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          label="Total"
          value={kpis.total}
          icon={<Activity className="size-4" />}
          tone="neutral"
        />
        <KpiCard
          label="Concluídas"
          value={kpis.concluidas}
          sub={`${kpis.pctConcluidas}%`}
          icon={<CheckCircle className="size-4" />}
          tone="success"
        />
        <KpiCard
          label="Em andamento"
          value={kpis.emAndamento}
          icon={<Clock className="size-4" />}
          tone="brand"
        />
        <KpiCard
          label="Pendentes"
          value={kpis.pendentes}
          icon={<Clock className="size-4" />}
          tone="neutral"
        />
        <KpiCard
          label="Atrasadas"
          value={kpis.atrasadas}
          icon={<AlertTriangle className="size-4" />}
          tone="danger"
        />
      </div>

      {/* Agenda + Progresso */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Agenda (hoje + próximos 7 dias) */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Agenda"
            description="Atividades pendentes de hoje aos próximos 7 dias"
            actions={
              <Button variant="subtle" size="sm" asChild>
                <a href="/cronograma">Ver todas <ChevronRight className="size-3.5 ml-1" /></a>
              </Button>
            }
          />
          <div className="px-4 pb-4">
            {agenda.length === 0 ? (
              <p className="py-4 text-center text-body text-fg-3">
                Nenhuma atividade pendente nos próximos 7 dias.
              </p>
            ) : (
              <div className="space-y-4">
                {agenda.map((grupo) => (
                  <div key={grupo.dataStr}>
                    <p className="mb-1 text-caption font-medium text-fg-3">
                      {grupo.rotulo}
                      <span className="ml-2 text-fg-4">({grupo.atividades.length})</span>
                    </p>
                    <div className="space-y-0.5">
                      {grupo.atividades.map((a) => (
                        <LinhaAgenda key={a.id} atividade={a} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Progresso por tipo */}
        <Card>
          <CardHeader
            title="Progresso por tipo"
            description={`${kpis.pctConcluidas}% das atividades concluídas`}
          />
          <div className="px-5 pb-5 space-y-3">
            {porTipo.map((item) => {
              const pct = item.total > 0 ? Math.round((item.concluidas / item.total) * 100) : 0;
              return (
                <div key={item.tipo} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={TIPO_TONE[item.tipo]} className="text-micro">
                      {TIPO_ATIVIDADE_LABEL[item.tipo as keyof typeof TIPO_ATIVIDADE_LABEL]}
                    </Badge>
                    <span className="text-caption text-fg-3 tabular-nums">{item.concluidas}/{item.total}</span>
                  </div>
                  <div className="h-1.5 bg-surface-subtle rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="flex items-center gap-4 border-t border-stroke pt-3 text-caption text-fg-3">
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" /> {locais.length} locais
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="size-3.5" /> {equipes.length} equipes
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: React.ReactNode;
  tone: "neutral" | "success" | "brand" | "danger";
}) {
  const tones = {
    neutral: "bg-surface-subtle text-fg border-stroke",
    success: "bg-success-bg/20 text-success-fg border-success-stroke",
    brand: "bg-brand-tint text-brand-fg border-brand/30",
    danger: "bg-danger-bg/20 text-danger-fg border-danger-stroke",
  };

  return (
    <div className={cn("rounded-lg border p-3", tones[tone])}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-caption text-fg-3">{label}</p>
          <p className="text-body font-bold mt-0.5 tabular-nums">{value}</p>
          {sub && <p className="text-micro opacity-70">{sub}</p>}
        </div>
        <div className="p-1.5 rounded-md bg-white/20 shrink-0">{icon}</div>
      </div>
    </div>
  );
}

function LinhaAgenda({ atividade }: { atividade: AtividadeCompleta }) {
  const { local, equipe, tipo, data_hora_planejada } = atividade;
  const statusEfetivo = getStatusEfetivo(atividade);

  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-subtle transition-colors">
      <span className="w-10 shrink-0 text-caption tabular-nums text-fg-3">
        {formatTimeBr(data_hora_planejada)}
      </span>
      <span
        className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[statusEfetivo] ?? "bg-fg-3")}
        title={
          statusEfetivo === "atrasado"
            ? "Atrasada"
            : statusEfetivo === "em_andamento"
              ? "Em andamento"
              : "Pendente"
        }
      />
      <span className="min-w-0 flex-1 truncate text-body">{local?.nome ?? "—"}</span>
      <span className="hidden sm:block shrink-0 text-micro text-fg-4 truncate max-w-[10rem]">
        {[equipe?.nome, local?.municipio].filter(Boolean).join(" · ")}
      </span>
      <Badge tone={TIPO_TONE[tipo]} className="text-micro shrink-0 hidden md:inline-flex">
        {TIPO_ATIVIDADE_LABEL[tipo as keyof typeof TIPO_ATIVIDADE_LABEL]}
      </Badge>
    </div>
  );
}