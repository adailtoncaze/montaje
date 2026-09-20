"use client";

import { useState, useMemo } from "react";
import { Calendar, Download, BarChart2, Users, MapPin, Loader2, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Select, type SelectOption } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { exportarAtividadesCsv, getConfiguracaoEleicao } from "@/lib/actions/relatorios";
import { useToast } from "@/components/ui/toast";
import { TIPO_ATIVIDADE_LABEL } from "@/lib/constants";

interface KpisGerais {
  total: number;
  pendentes: number;
  emAndamento: number;
  concluidas: number;
  atrasadas: number;
}

interface AtividadePorTipo {
  tipo: string;
  total: number;
  pendentes: number;
  emAndamento: number;
  concluidas: number;
  atrasadas: number;
}

interface EquipeBasica {
  id: string;
  nome: string;
  tipo: "montagem" | "recolhimento";
}

interface LocalBasico {
  id: string;
  nome: string;
  municipio: string;
}

interface AtividadePorEquipe {
  equipe: EquipeBasica;
  total: number;
  pendentes: number;
  emAndamento: number;
  concluidas: number;
  atrasadas: number;
}

interface AtividadePorLocal {
  local: LocalBasico;
  total: number;
  pendentes: number;
  emAndamento: number;
  concluidas: number;
  atrasadas: number;
}

interface TimelineItem {
  data: string;
  total: number;
  concluidas: number;
  pendentes: number;
}

interface RelatoriosViewProps {
  kpis: KpisGerais;
  porTipo: AtividadePorTipo[];
  porEquipe: AtividadePorEquipe[];
  porLocal: AtividadePorLocal[];
  timeline: TimelineItem[];
  defaultDataInicio: string;
  defaultDataFim: string;
}

export function RelatoriosView({
  kpis,
  porTipo,
  porEquipe,
  porLocal,
  timeline,
  defaultDataInicio,
  defaultDataFim,
}: RelatoriosViewProps) {
  const { toast } = useToast();
  const [periodo, setPeriodo] = useState({ inicio: defaultDataInicio, fim: defaultDataFim });
  const [exportando, setExportando] = useState(false);

  const handleExportarCsv = async () => {
    setExportando(true);
    try {
      const csv = await exportarAtividadesCsv();
      if (!csv) {
        toast("warning", "Nenhum dado para exportar");
        return;
      }
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `montaje-atividades-${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast("success", "CSV exportado com sucesso");
    } catch (error) {
      toast("error", `Erro ao exportar: ${error}`);
    } finally {
      setExportando(false);
    }
  };

  const totalGeral = kpis.total;
  const pctConcluidas = totalGeral > 0 ? Math.round((kpis.concluidas / totalGeral) * 100) : 0;
  const pctPendentes = totalGeral > 0 ? Math.round(((kpis.pendentes + kpis.emAndamento) / totalGeral) * 100) : 0;
  const pctAtrasadas = totalGeral > 0 ? Math.round((kpis.atrasadas / totalGeral) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <BarChart2 className="size-6 text-brand" />
          <h2 className="text-title font-semibold text-fg">Relatórios</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="subtle" onClick={handleExportarCsv} disabled={exportando} className="whitespace-nowrap">
            <Download className="size-4 mr-1.5" />
            {exportando ? "Exportando…" : "Exportar CSV"}
          </Button>
        </div>
      </div>

      {/* Filtro de período */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="dataInicio-rel" className="sr-only">Data inicial</label>
          <Select
            id="dataInicio-rel"
            value={periodo.inicio}
            onChange={(e) => setPeriodo((p) => ({ ...p, inicio: e.target.value }))}
            options={[]}
            placeholder="Data inicial"
            disabled
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="dataFim-rel" className="sr-only">Data final</label>
          <Select
            id="dataFim-rel"
            value={periodo.fim}
            onChange={(e) => setPeriodo((p) => ({ ...p, fim: e.target.value }))}
            options={[]}
            placeholder="Data final"
            disabled
          />
        </div>
        <div className="flex items-center gap-2 text-caption text-fg-3">
          Período da eleição ativa
        </div>
      </div>

      {/* KPIs Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard 
          label="Total" 
          value={kpis.total} 
          icon={BarChart2} 
          tone="neutral" 
        />
        <KpiCard 
          label="Concluídas" 
          value={kpis.concluidas} 
          sub={`(${pctConcluidas}%)`}
          icon={CheckCircle} 
          tone="success" 
        />
        <KpiCard 
          label="Em andamento" 
          value={kpis.emAndamento} 
          sub={`(${pctPendentes}%)`}
          icon={Clock} 
          tone="brand" 
        />
        <KpiCard 
          label="Pendentes" 
          value={kpis.pendentes} 
          icon={Clock} 
          tone="neutral" 
        />
        <KpiCard 
          label="Atrasadas" 
          value={kpis.atrasadas} 
          sub={`(${pctAtrasadas}%)`}
          icon={AlertTriangle} 
          tone="danger" 
        />
      </div>

      {/* Gráfico de barras - Timeline */}
      <Card>
        <CardHeader title="Atividades por Data" actions={<BarChart2 className="size-5 text-brand" />} />
        <div className="px-5 pb-5">
          <TimelineChart timeline={timeline} />
        </div>
      </Card>

      {/* Breakdown por Tipo */}
      <Card>
        <CardHeader title="Por Tipo de Atividade" actions={<Clock className="size-5 text-brand" />} />
        <div className="px-5 pb-5">
          <BreakdownTable
            items={porTipo}
            columns={[
              { key: "tipo", header: "Tipo", render: (item) => <TipoAtividadeBadgeInline tipo={item.tipo as "instalacao" | "verificacao" | "recolhimento_midia" | "recolhimento_urna"} /> },
              { key: "total", header: "Total", align: "right" },
              { key: "concluidas", header: "Concl.", align: "right", tone: "success" },
              { key: "emAndamento", header: "And.", align: "right", tone: "brand" },
              { key: "pendentes", header: "Pend.", align: "right", tone: "neutral" },
              { key: "atrasadas", header: "Atras.", align: "right", tone: "danger" },
            ]}
          />
        </div>
      </Card>

      {/* Breakdown por Equipe */}
      <Card>
        <CardHeader title="Por Equipe" actions={<Users className="size-5 text-brand" />} />
        <div className="px-5 pb-5">
          <BreakdownTable<AtividadePorEquipe>
            items={porEquipe}
            columns={[
              { key: "equipe", header: "Equipe", render: (item) => (
                <div>
                  <p className="font-medium">{item.equipe.nome}</p>
                  <p className="text-caption text-fg-3 capitalize">{item.equipe.tipo}</p>
                </div>
              ) },
              { key: "total", header: "Total", align: "right" },
              { key: "concluidas", header: "Concl.", align: "right", tone: "success" },
              { key: "emAndamento", header: "And.", align: "right", tone: "brand" },
              { key: "pendentes", header: "Pend.", align: "right", tone: "neutral" },
              { key: "atrasadas", header: "Atras.", align: "right", tone: "danger" },
            ]}
          />
        </div>
      </Card>

      {/* Breakdown por Local */}
      <Card>
        <CardHeader title="Por Local de Votação" actions={<MapPin className="size-5 text-brand" />} />
        <div className="px-5 pb-5">
          <BreakdownTable<AtividadePorLocal>
            items={porLocal}
            columns={[
              { key: "local", header: "Local", render: (item) => (
                <div>
                  <p className="font-medium">{item.local.nome}</p>
                  <p className="text-caption text-fg-3">{item.local.municipio}</p>
                </div>
              ) },
              { key: "total", header: "Total", align: "right" },
              { key: "concluidas", header: "Concl.", align: "right", tone: "success" },
              { key: "emAndamento", header: "And.", align: "right", tone: "brand" },
              { key: "pendentes", header: "Pend.", align: "right", tone: "neutral" },
              { key: "atrasadas", header: "Atras.", align: "right", tone: "danger" },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}

function KpiCard({ 
  label, 
  value, 
  sub, 
  icon: Icon, 
  tone 
}: { 
  label: string; 
  value: number; 
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
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
        <Icon className="size-8 opacity-50" />
      </div>
    </div>
  );
}

function TipoAtividadeBadgeInline({ tipo }: { tipo: "instalacao" | "verificacao" | "recolhimento_midia" | "recolhimento_urna" }) {
  const tones: Record<typeof tipo, "neutral" | "brand" | "success" | "warning" | "danger"> = {
    instalacao: "brand",
    verificacao: "success",
    recolhimento_midia: "warning",
    recolhimento_urna: "danger",
  };
  return <Badge tone={tones[tipo]} className="text-caption">{TIPO_ATIVIDADE_LABEL[tipo]}</Badge>;
}

interface Column<T> {
  key: keyof T | string;
  header: string;
  align?: "left" | "right";
  tone?: "neutral" | "success" | "brand" | "danger" | "warning";
  render?: (item: T) => React.ReactNode;
}

interface BreakdownTableProps<T> {
  items: T[];
  columns: Column<T>[];
}

function BreakdownTable<T>({ items, columns }: BreakdownTableProps<T>) {
  if (items.length === 0) {
    return <p className="text-body text-fg-3 text-center py-4">Nenhum dado</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-body">
        <thead>
          <tr className="border-b border-stroke bg-surface-subtle">
            {columns.map((col) => (
              <th
                key={col.key as string}
                className={cn(
                  "px-4 py-2.5 text-caption font-semibold text-fg-2",
                  col.align === "right" && "text-right"
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b border-stroke-subtle last:border-b-0">
              {columns.map((col) => {
                const value = item[col.key as keyof T];
                return (
                  <td
                    key={col.key as string}
                    className={cn(
                      "px-4 py-2.5 text-fg",
                      col.align === "right" && "text-right font-mono tabular-nums",
                      col.tone && col.tone !== "neutral" && `text-${col.tone}-fg`
                    )}
                  >
                    {col.render ? col.render(item) : String(value ?? "")}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TimelineChart({ timeline }: { timeline: TimelineItem[] }) {
  if (timeline.length === 0) {
    return <p className="text-body text-fg-3 text-center py-4">Nenhum dado no período</p>;
  }

  const maxTotal = Math.max(...timeline.map(t => t.total), 1);

  return (
    <div className="space-y-3">
      {timeline.map((item) => {
        const pctTotal = (item.total / maxTotal) * 100;
        const pctConcluidas = item.total > 0 ? (item.concluidas / item.total) * 100 : 0;
        const pctPendentes = item.total > 0 ? (item.pendentes / item.total) * 100 : 0;
        const dataFormatada = new Date(item.data + "T12:00:00").toLocaleDateString("pt-BR", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
        });

        return (
          <div key={item.data} className="flex items-center gap-3">
            <span className="w-24 text-caption text-fg-3 shrink-0">{dataFormatada}</span>
            <div className="flex-1 h-6 bg-surface-subtle rounded-full overflow-hidden relative">
              {pctConcluidas > 0 && (
                <div
                  className="absolute left-0 top-0 h-full bg-success-bg"
                  style={{ width: `${pctConcluidas}%` }}
                />
              )}
              {pctPendentes > 0 && (
                <div
                  className={`absolute h-full ${pctConcluidas > 0 ? `left-[${pctConcluidas}%]` : "left-0"} top-0 bg-brand/30`}
                  style={{ width: `${pctPendentes}%` }}
                />
              )}
            </div>
            <span className="w-20 text-caption text-fg-3 text-right font-mono tabular-nums">
              {item.total}
            </span>
          </div>
        );
      })}
      <div className="flex items-center gap-2 ml-24 text-caption text-fg-3">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-success-bg" />
          Concluídas / Atrasadas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-brand/30" />
          Pendentes / Em andamento
        </span>
      </div>
    </div>
  );
}