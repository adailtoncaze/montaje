"use client";

import { useMemo } from "react";
import { CheckCircle, AlertTriangle, Clock, Activity, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getLocalDateFromTimestamp, formatTimeBr } from "@/lib/utils/date";
import { TIPO_ATIVIDADE_LABEL, TIPO_EQUIPE_LABEL } from "@/lib/constants";
import { getStatusEfetivo } from "@/lib/utils/atividades";
import type { AtividadeCompleta } from "@/lib/actions/atividades";
import type { Tables } from "@/types/supabase";

type Equipe = Tables<"equipes">;
type Local = Tables<"locais_votacao">;
type ConfigEleicao = Tables<"configuracao_eleicao">;

/** Cor do badge por tipo de atividade/equipe (4 tipos atuais). */
const TIPO_TONE: Record<string, BadgeTone> = {
  instalacao: "brand",
  verificacao: "success",
  recolhimento_midia: "warning",
  recolhimento_urna: "danger",
};

interface PainelViewProps {
  config: ConfigEleicao | null;
  atividades: AtividadeCompleta[];
  equipes: Equipe[];
  locais: Local[];
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

  // Atividades de hoje
  const atividadesHoje = useMemo(() => {
    return atividades.filter((a) => {
      const dataAtividadeStr = getLocalDateFromTimestamp(a.data_hora_planejada);
      return dataAtividadeStr === hojeStr;
    }).sort((a, b) => new Date(a.data_hora_planejada).getTime() - new Date(b.data_hora_planejada).getTime());
  }, [atividades]);

  // Próximas atividades (próximos 7 dias)
  const proximasAtividades = useMemo(() => {
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() + 7);
    const limiteStr = getLocalDateFromTimestamp(limite.toISOString());
    return atividades
      .filter((a) => {
        const dataAtividadeStr = getLocalDateFromTimestamp(a.data_hora_planejada);
        return dataAtividadeStr >= hojeStr && dataAtividadeStr <= limiteStr && getStatusEfetivo(a) !== "concluido";
      })
      .sort((a, b) => new Date(a.data_hora_planejada).getTime() - new Date(b.data_hora_planejada).getTime())
      .slice(0, 10);
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

  // Equipes com mais atividades
  const equipesAtivas = useMemo(() => {
    return equipes
      .map((e) => {
        const total = atividades.filter((a) => a.equipe_id === e.id).length;
        const concluidas = atividades.filter((a) => a.equipe_id === e.id && getStatusEfetivo(a) === "concluido").length;
        return { ...e, total, concluidas };
      })
      .filter((e) => e.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [atividades, equipes]);

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
    <div className="flex flex-col gap-6">
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard
          label="Total"
          value={kpis.total}
          icon={<Activity className="size-5" />}
          tone="neutral"
        />
        <KpiCard
          label="Concluídas"
          value={kpis.concluidas}
          sub={`${kpis.pctConcluidas}%`}
          icon={<CheckCircle className="size-5" />}
          tone="success"
        />
        <KpiCard
          label="Em andamento"
          value={kpis.emAndamento}
          icon={<Clock className="size-5" />}
          tone="brand"
        />
        <KpiCard
          label="Pendentes"
          value={kpis.pendentes}
          icon={<Clock className="size-5" />}
          tone="neutral"
        />
        <KpiCard
          label="Atrasadas"
          value={kpis.atrasadas}
          icon={<AlertTriangle className="size-5" />}
          tone="danger"
        />
      </div>

      {/* Próximas atividades + Atividades por tipo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Próximas atividades */}
        <Card>
          <CardHeader
            title="Próximas atividades"
            actions={
              <Button variant="subtle" size="sm" asChild>
                <a href="/cronograma">Ver todas <ChevronRight className="size-3.5 ml-1" /></a>
              </Button>
            }
          />
          <div className="px-5 pb-5">
            {proximasAtividades.length === 0 ? (
              <p className="py-4 text-center text-body text-fg-3">Nenhuma atividade agendada nos próximos 7 dias.</p>
            ) : (
              <div className="space-y-2">
                {proximasAtividades.map((a) => (
                  <AtividadeCard key={a.id} atividade={a} />
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Atividades por tipo */}
        <Card>
          <CardHeader title="Por tipo de atividade" />
          <div className="px-5 pb-5 space-y-3">
            {porTipo.map((item) => {
              const pct = item.total > 0 ? Math.round((item.concluidas / item.total) * 100) : 0;
              return (
                <div key={item.tipo} className="space-y-1">
                  <div className="flex items-center justify-between text-caption">
                    <Badge tone={TIPO_TONE[item.tipo]} className="text-micro mr-2">
                      {TIPO_ATIVIDADE_LABEL[item.tipo as keyof typeof TIPO_ATIVIDADE_LABEL]}
                    </Badge>
                    <span className="text-fg-3">{item.concluidas} / {item.total}</span>
                  </div>
                  <div className="h-2 bg-surface-subtle rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Atividades de hoje + Equipes ativas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Atividades de hoje */}
        <Card>
          <CardHeader title="Atividades de hoje" />
          <div className="px-5 pb-5">
            {atividadesHoje.length === 0 ? (
              <p className="py-4 text-center text-body text-fg-3">Nenhuma atividade agendada para hoje.</p>
            ) : (
              <div className="space-y-2">
                {atividadesHoje.map((a) => (
                  <AtividadeCard key={a.id} atividade={a} compact />
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Equipes mais ativas */}
        <Card>
          <CardHeader title="Equipes mais ativas" />
          <div className="px-5 pb-5">
            {equipesAtivas.length === 0 ? (
              <p className="py-4 text-center text-body text-fg-3">Nenhuma equipe com atividades.</p>
            ) : (
              <div className="space-y-2">
                {equipesAtivas.map((e) => (
                  <EquipeCard key={e.id} equipe={e} />
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Estatísticas gerais */}
      <Card>
        <CardHeader title="Resumo geral" />
        <div className="px-5 pb-5 grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
          <StatBox label="Locais" value={locais.length} />
          <StatBox label="Equipes" value={equipes.length} />
          {(Object.keys(TIPO_EQUIPE_LABEL) as Array<keyof typeof TIPO_EQUIPE_LABEL>).map((tipo) => (
            <StatBox
              key={tipo}
              label={TIPO_EQUIPE_LABEL[tipo]}
              value={equipes.filter((e) => e.tipo === tipo).length}
            />
          ))}
        </div>
      </Card>
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
    <div className={cn("rounded-lg border p-4", tones[tone])}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-caption text-fg-3">{label}</p>
          <p className="text-headline font-bold mt-1">{value}</p>
          {sub && <p className="text-caption opacity-70">{sub}</p>}
        </div>
        <div className="p-1 rounded-lg bg-white/20">{icon}</div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-subtle p-4">
      <p className="text-headline font-bold text-fg">{value}</p>
      <p className="text-caption text-fg-3">{label}</p>
    </div>
  );
}

function AtividadeCard({
  atividade,
  compact = false,
}: {
  atividade: AtividadeCompleta;
  compact?: boolean;
}) {
  const { local, equipe, tipo, data_hora_planejada, status } = atividade;
  const statusEfetivo = getStatusEfetivo(atividade);
  const isAtrasado = statusEfetivo === "atrasado";

  const horario = formatTimeBr(data_hora_planejada);

  return (
    <div className={cn("rounded-md border border-stroke p-3 hover:bg-surface-subtle transition-colors", compact && "p-2")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={TIPO_TONE[tipo]} className={cn("text-micro", compact && "text-micro")}>
              {TIPO_ATIVIDADE_LABEL[tipo]}
            </Badge>
            <span className="text-caption text-fg-3 whitespace-nowrap">{horario}</span>
            {isAtrasado && <Badge tone="danger" className="text-micro" dot>Atrasado</Badge>}
            {statusEfetivo === "em_andamento" && <Badge tone="brand" className="text-micro" dot>Em andamento</Badge>}
            {statusEfetivo === "concluido" && <Badge tone="success" className="text-micro" dot>Concluída</Badge>}
          </div>
          <p className="mt-1 text-body font-medium truncate">{local?.nome ?? "—"}</p>
          <p className="text-micro text-fg-4 truncate">
            {local?.municipio ?? ""} • {equipe?.nome ?? "Sem equipe"}
          </p>
        </div>
      </div>
    </div>
  );
}

function EquipeCard({ equipe }: { equipe: { nome: string; tipo: string; total: number; concluidas: number } }) {
  const pct = equipe.total > 0 ? Math.round((equipe.concluidas / equipe.total) * 100) : 0;

  return (
    <div className="rounded-md border border-stroke p-3 hover:bg-surface-subtle transition-colors">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-body truncate">{equipe.nome}</span>
            <Badge tone={TIPO_TONE[equipe.tipo] ?? "neutral"} className="text-micro">
              {TIPO_EQUIPE_LABEL[equipe.tipo as keyof typeof TIPO_EQUIPE_LABEL] ?? equipe.tipo}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-2 text-caption text-fg-3">
            <span>{equipe.concluidas} / {equipe.total} atividades</span>
            <span className="text-fg-4">({pct}%)</span>
          </div>
        </div>
        <div className="h-2 w-24 bg-surface-subtle rounded-full overflow-hidden ml-2">
          <div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}