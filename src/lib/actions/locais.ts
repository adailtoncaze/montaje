"use server";

import { createClient } from "@/lib/supabase/server";
import type { TablesInsert, TablesUpdate } from "@/types/supabase";

export async function listarLocais(busca?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("locais_votacao")
    .select("*")
    .order("nome");

  if (busca) {
    query = query.or(`nome.ilike.%${busca}%,municipio.ilike.%${busca}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function buscarLocal(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locais_votacao")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function criarLocal(local: TablesInsert<"locais_votacao">) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locais_votacao")
    .insert(local)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function atualizarLocal(
  id: string,
  local: TablesUpdate<"locais_votacao">,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locais_votacao")
    .update(local)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function excluirLocal(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("locais_votacao").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Importação em lote (CSV). Insere apenas registros válidos e não duplicados
 * (duplicado = mesmo nome + município, conforme índice único no banco).
 */
export async function importarLocais(
  locais: Array<{
    nome: string;
    municipio: string;
    qtd_secoes: number;
    endereco?: string | null;
  }>,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locais_votacao")
    .insert(locais.map((l) => ({ ...l, endereco: l.endereco || null })))
    .select();
  if (error) throw error;
  return data ?? [];
}
