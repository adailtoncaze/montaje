"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/types/supabase";

export async function listarEquipes(busca?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("equipes")
    .select("*")
    .order("nome");

  if (busca) {
    query = query.ilike("nome", `%${busca}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function buscarEquipe(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipes")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function criarEquipe(equipe: TablesInsert<"equipes">) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipes")
    .insert(equipe)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function atualizarEquipe(
  id: string,
  equipe: TablesUpdate<"equipes">,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipes")
    .update(equipe)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function excluirEquipe(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("equipes").delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  Membros da equipe                                                  */
/* ------------------------------------------------------------------ */

export interface MembroComNome {
  equipe_id: string;
  colaborador_id: string;
  papel: "responsavel" | "membro";
  colaborador_nome: string;
  colaborador_funcao: string;
}

export async function listarMembros(equipeId: string): Promise<MembroComNome[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipe_colaboradores")
    .select("equipe_id, colaborador_id, papel, colaboradores!inner(nome, funcao)")
    .eq("equipe_id", equipeId)
    .order("papel", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    equipe_id: row.equipe_id,
    colaborador_id: row.colaborador_id,
    papel: row.papel as "responsavel" | "membro",
    colaborador_nome: (row.colaboradores as unknown as { nome: string }).nome,
    colaborador_funcao: (row.colaboradores as unknown as { funcao: string })
      .funcao,
  }));
}

export async function adicionarMembro(
  equipeId: string,
  colaboradorId: string,
  papel: "responsavel" | "membro" = "membro",
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("equipe_colaboradores")
    .insert({ equipe_id: equipeId, colaborador_id: colaboradorId, papel });
  if (error) throw error;
}

export async function removerMembro(equipeId: string, colaboradorId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("equipe_colaboradores")
    .delete()
    .eq("equipe_id", equipeId)
    .eq("colaborador_id", colaboradorId);
  if (error) throw error;
}

export async function definirResponsavel(
  equipeId: string,
  colaboradorId: string,
) {
  const supabase = await createClient();

  // Remove responsável anterior (se houver)
  await supabase
    .from("equipe_colaboradores")
    .update({ papel: "membro" })
    .eq("equipe_id", equipeId)
    .eq("papel", "responsavel");

  // Define novo responsável
  const { error } = await supabase
    .from("equipe_colaboradores")
    .update({ papel: "responsavel" })
    .eq("equipe_id", equipeId)
    .eq("colaborador_id", colaboradorId);
  if (error) throw error;
}
