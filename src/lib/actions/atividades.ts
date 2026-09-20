import { createClient } from "@/lib/supabase/server";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/supabase";
import { cache } from "react";
import { parseSaoPauloDate } from "@/lib/utils/date";

/** Busca a configuração ativa da eleição. */
export const getConfiguracaoEleicao = cache(async (): Promise<Tables<"configuracao_eleicao"> | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("configuracao_eleicao")
    .select("*")
    .eq("ativa", true)
    .single();
  // PGRST116 = nenhuma linha (eleição ainda não configurada) — não é erro real.
  if (error && error.code !== "PGRST116") throw error;
  return data;
});

/** Busca todas as atividades com joins de local e equipe, ordenadas por data/hora planejada. */
export const getAtividadesCompletas = cache(async (): Promise<AtividadeCompleta[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("atividades")
    .select(`
      *,
      local:locais_votacao (id, nome, municipio, qtd_secoes, endereco),
      equipe:equipes (id, nome, tipo, lat_origem)
    `)
    .order("data_hora_planejada", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AtividadeCompleta[];
});

/** Busca atividades filtradas por data (início/fim do dia em UTC). */
export async function getAtividadesPorPeriodo(
  inicio: Date,
  fim: Date
): Promise<AtividadeCompleta[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("atividades")
    .select(`
      *,
      local:locais_votacao (id, nome, municipio, qtd_secoes, endereco),
      equipe:equipes (id, nome, tipo, lat_origem)
    `)
    .gte("data_hora_planejada", inicio.toISOString())
    .lte("data_hora_planejada", fim.toISOString())
    .order("data_hora_planejada", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AtividadeCompleta[];
}

/** Busca todas as equipes para filtros. */
export const getEquipes = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipes")
    .select("*")
    .order("nome");
  if (error) throw error;
  return data ?? [];
});

/** Busca todos os locais para filtros. */
export const getLocais = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locais_votacao")
    .select("*")
    .order("nome");
  if (error) throw error;
  return data ?? [];
});

/** Tipos estendidos com joins. */
export type AtividadeCompleta = Tables<"atividades"> & {
  local: Tables<"locais_votacao"> | null;
  equipe: Tables<"equipes"> | null;
};

/** Calcula o status efetivo considerando atraso (replica a view atividades_com_status). */
export function getStatusEfetivo(atividade: AtividadeCompleta): "pendente" | "em_andamento" | "concluido" | "atrasado" {
  const { status, data_hora_planejada } = atividade;
  if (status === "pendente" || status === "em_andamento") {
    const agora = new Date();
    // data_hora_planejada é horário de parede (America/Sao_Paulo)
    const planejada = parseSaoPauloDate(data_hora_planejada);
    if (planejada < agora) return "atrasado";
  }
  return status;
}