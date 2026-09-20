"use server";

import { createClient } from "@/lib/supabase/server";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/supabase";

/** Cria uma nova atividade (admin). */
export async function criarAtividade(
  input: TablesInsert<"atividades">
): Promise<{ error: string | null; data: Tables<"atividades"> | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("atividades")
    .insert(input)
    .select()
    .single();
  return { error: error?.message ?? null, data };
}

/** Atualiza uma atividade (status, observações, hora real — servidor_zona pode). */
export async function atualizarAtividade(
  id: string,
  input: TablesUpdate<"atividades">
): Promise<{ error: string | null; data: Tables<"atividades"> | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("atividades")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  return { error: error?.message ?? null, data };
}

/** Exclui uma atividade (admin). */
export async function excluirAtividade(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("atividades").delete().eq("id", id);
  return { error: error?.message ?? null };
}

/** Inicia uma atividade (status -> em_andamento). */
export async function iniciarAtividade(
  id: string
): Promise<{ error: string | null; data: Tables<"atividades"> | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("atividades")
    .update({
      status: "em_andamento",
      data_hora_real: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  return { error: error?.message ?? null, data };
}

/** Conclui uma atividade (status -> concluido). */
export async function concluirAtividade(
  id: string,
  observacoes?: string
): Promise<{ error: string | null; data: Tables<"atividades"> | null }> {
  const supabase = await createClient();
  const update: TablesUpdate<"atividades"> = {
    status: "concluido",
    observacoes,
  };
  const { data, error } = await supabase
    .from("atividades")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  return { error: error?.message ?? null, data };
}

/** Atualiza observações de uma atividade. */
export async function atualizarObservacoes(
  id: string,
  observacoes: string
): Promise<{ error: string | null; data: Tables<"atividades"> | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("atividades")
    .update({ observacoes })
    .eq("id", id)
    .select()
    .single();
  return { error: error?.message ?? null, data };
}