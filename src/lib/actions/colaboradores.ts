"use server";

import { createClient } from "@/lib/supabase/server";
import type { TablesInsert, TablesUpdate } from "@/types/supabase";

export async function listarColaboradores(busca?: string, funcao?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("colaboradores")
    .select("*")
    .order("nome");

  if (busca) {
    query = query.or(`nome.ilike.%${busca}%,funcao.ilike.%${busca}%`);
  }
  if (funcao) {
    query = query.eq("funcao", funcao);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function buscarColaborador(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("colaboradores")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function criarColaborador(
  colaborador: TablesInsert<"colaboradores">,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("colaboradores")
    .insert(colaborador)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function atualizarColaborador(
  id: string,
  colaborador: TablesUpdate<"colaboradores">,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("colaboradores")
    .update(colaborador)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function excluirColaborador(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("colaboradores")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function listarFuncoes(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("colaboradores")
    .select("funcao")
    .order("funcao");
  if (error) throw error;
  // Distinct manual
  return [...new Set(data.map((r) => r.funcao))];
}

/**
 * Importação em lote (CSV). Insere apenas registros válidos.
 * Duplicados são ignorados no cliente (nome + função).
 */
export async function importarColaboradores(
  colaboradores: Array<{
    nome: string;
    funcao: string;
    telefone?: string | null;
  }>,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("colaboradores")
    .insert(colaboradores.map((c) => ({ ...c, telefone: c.telefone || null })))
    .select();
  if (error) throw error;
  return data ?? [];
}
