"use server";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/supabase";
import { cache } from "react";
import { parseSaoPauloDate } from "@/lib/utils/date";

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

/** KPIs gerais do cronograma. */
export const getKpisGerais = cache(async () => {
  const supabase = await createClient();
  
  const [{ count: totalAtividades }, { count: pendentes }, { count: emAndamento }, { count: concluidas }, { count: atrasadas }] = await Promise.all([
    supabase.from("atividades").select("*", { count: "exact", head: true }),
    supabase.from("atividades").select("*", { count: "exact", head: true }).eq("status", "pendente"),
    supabase.from("atividades").select("*", { count: "exact", head: true }).eq("status", "em_andamento"),
    supabase.from("atividades").select("*", { count: "exact", head: true }).eq("status", "concluido"),
    supabase.from("atividades").select("*", { count: "exact", head: true }).eq("status", "atrasado"),
  ]);

  // Calcula atrasados efetivos (pendentes/em_andamento com data passada)
  const { data: todas } = await supabase
    .from("atividades")
    .select("status, data_hora_planejada");
  
  const agora = new Date();
  let atrasadosEfetivos = atrasadas ?? 0;
  if (todas) {
    for (const a of todas) {
      if ((a.status === "pendente" || a.status === "em_andamento") && parseSaoPauloDate(a.data_hora_planejada) < agora) {
        atrasadosEfetivos++;
      }
    }
  }

  return {
    total: totalAtividades ?? 0,
    pendentes: (pendentes ?? 0) - (atrasadosEfetivos - (atrasadas ?? 0)),
    emAndamento: emAndamento ?? 0,
    concluidas: concluidas ?? 0,
    atrasadas: atrasadosEfetivos,
  };
});

/** Atividades por tipo. */
export const getAtividadesPorTipo = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("atividades")
    .select("tipo, status, data_hora_planejada");
  
  const agora = new Date();
  const porTipo: Record<string, { total: number; pendentes: number; emAndamento: number; concluidas: number; atrasadas: number }> = {};
  
  if (data) {
    for (const a of data) {
      if (!porTipo[a.tipo]) {
        porTipo[a.tipo] = { total: 0, pendentes: 0, emAndamento: 0, concluidas: 0, atrasadas: 0 };
      }
      porTipo[a.tipo].total++;
      const isAtrasado = (a.status === "pendente" || a.status === "em_andamento") && parseSaoPauloDate(a.data_hora_planejada) < agora;
      if (isAtrasado) porTipo[a.tipo].atrasadas++;
      else if (a.status === "pendente") porTipo[a.tipo].pendentes++;
      else if (a.status === "em_andamento") porTipo[a.tipo].emAndamento++;
      else if (a.status === "concluido") porTipo[a.tipo].concluidas++;
    }
  }
  
  return Object.entries(porTipo).map(([tipo, v]) => ({ tipo, ...v }));
});

/** Atividades por equipe. */
export const getAtividadesPorEquipe = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("atividades")
    .select(`
      equipe_id,
      status,
      data_hora_planejada,
      equipe:equipes (id, nome, tipo)
    `);
  
  const agora = new Date();
  const porEquipe: Record<string, { 
    equipe: EquipeBasica; 
    total: number; 
    pendentes: number; 
    emAndamento: number; 
    concluidas: number; 
    atrasadas: number;
  }> = {};
  
  if (data) {
    for (const a of data) {
      const key = a.equipe_id;
      if (!porEquipe[key] && a.equipe) {
        const equipe = Array.isArray(a.equipe) ? a.equipe[0] : a.equipe;
        porEquipe[key] = { 
          equipe: equipe as EquipeBasica, 
          total: 0, 
          pendentes: 0, 
          emAndamento: 0, 
          concluidas: 0, 
          atrasadas: 0 
        };
      }
      if (porEquipe[key]) {
        porEquipe[key].total++;
        const isAtrasado = (a.status === "pendente" || a.status === "em_andamento") && parseSaoPauloDate(a.data_hora_planejada) < agora;
        if (isAtrasado) porEquipe[key].atrasadas++;
        else if (a.status === "pendente") porEquipe[key].pendentes++;
        else if (a.status === "em_andamento") porEquipe[key].emAndamento++;
        else if (a.status === "concluido") porEquipe[key].concluidas++;
      }
    }
  }
  
  return Object.values(porEquipe).sort((a, b) => b.total - a.total);
});

/** Atividades por local. */
export const getAtividadesPorLocal = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("atividades")
    .select(`
      local_id,
      status,
      data_hora_planejada,
      local:locais_votacao (id, nome, municipio)
    `);
  
  const agora = new Date();
  const porLocal: Record<string, { 
    local: LocalBasico; 
    total: number; 
    pendentes: number; 
    emAndamento: number; 
    concluidas: number; 
    atrasadas: number;
  }> = {};
  
  if (data) {
    for (const a of data) {
      const key = a.local_id;
      if (!porLocal[key] && a.local) {
        const local = Array.isArray(a.local) ? a.local[0] : a.local;
        porLocal[key] = { 
          local: local as LocalBasico, 
          total: 0, 
          pendentes: 0, 
          emAndamento: 0, 
          concluidas: 0, 
          atrasadas: 0 
        };
      }
      if (porLocal[key]) {
        porLocal[key].total++;
        const isAtrasado = (a.status === "pendente" || a.status === "em_andamento") && parseSaoPauloDate(a.data_hora_planejada) < agora;
        if (isAtrasado) porLocal[key].atrasadas++;
        else if (a.status === "pendente") porLocal[key].pendentes++;
        else if (a.status === "em_andamento") porLocal[key].emAndamento++;
        else if (a.status === "concluido") porLocal[key].concluidas++;
      }
    }
  }
  
  return Object.values(porLocal).sort((a, b) => b.total - a.total);
});

/** Timeline de atividades por data (para gráfico de barras). */
export const getTimelineAtividades = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("atividades")
    .select("data_hora_planejada, status")
    .order("data_hora_planejada");
  
  const porData: Record<string, { data: string; total: number; concluidas: number; pendentes: number }> = {};
  const agora = new Date();
  
  // Helper para extrair data local (America/Sao_Paulo) de um timestamp ISO
  const getLocalDateFromTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // Returns YYYY-MM-DD
  };
  
  if (data) {
    for (const a of data) {
      // data_hora_planejada é horário de parede (timestamp sem zona): extrai a data literal
      const dataKey = a.data_hora_planejada.slice(0, 10);
      if (!porData[dataKey]) {
        porData[dataKey] = { data: dataKey, total: 0, concluidas: 0, pendentes: 0 };
      }
      porData[dataKey].total++;
      const isAtrasado = (a.status === "pendente" || a.status === "em_andamento") && parseSaoPauloDate(a.data_hora_planejada) < agora;
      if (a.status === "concluido" || isAtrasado) {
        porData[dataKey].concluidas++;
      } else {
        porData[dataKey].pendentes++;
      }
    }
  }
  
  return Object.values(porData).sort((a, b) => a.data.localeCompare(b.data));
});

/** Exporta atividades para CSV. */
export async function exportarAtividadesCsv(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("atividades")
    .select(`
      *,
      local:locais_votacao (nome, municipio),
      equipe:equipes (nome, tipo)
    `)
    .order("data_hora_planejada");
  
  if (!data || data.length === 0) return "";
  
  const headers = [
    "ID", "Local", "Município", "Equipe", "Tipo Equipe", "Tipo Atividade",
    "Planejada", "Real", "Status", "Observações"
  ];
  
  const fmtNaive = (ts?: string | null): string =>
    ts ? ts.slice(0, 19).replace("T", " ") : "";

  const rows = data.map(a => [
    a.id,
    a.local?.nome ?? "",
    a.local?.municipio ?? "",
    a.equipe?.nome ?? "",
    a.equipe?.tipo ?? "",
    a.tipo,
    fmtNaive(a.data_hora_planejada),
    a.data_hora_real ? new Date(a.data_hora_real).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
    a.status,
    a.observacoes?.replace(/"/g, '""') ?? ""
  ]);
  
  const escape = (v: string) => `"${v}"`;
  const csv = [headers.join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
  return csv;
}

/** Configuração da eleição ativa. */
export const getConfiguracaoEleicao = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("configuracao_eleicao")
    .select("*")
    .eq("ativa", true)
    .single();
  return data;
});