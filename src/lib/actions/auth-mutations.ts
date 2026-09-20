"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "./auth";
import type { Tables, TablesUpdate } from "@/types/supabase";

/**
 * Encerra a sessão do usuário e redireciona para /login.
 */
export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Lista todos os usuários (apenas admin).
 * Retorna perfis com email do auth.users via join.
 */
export async function listarUsuarios(): Promise<Array<Tables<"perfis"> & { email: string }>> {
  await requireAdmin();
  const supabase = await createClient();
  
  // Busca perfis
  const { data: perfis, error: perfisError } = await supabase
    .from("perfis")
    .select("*")
    .order("criado_em", { ascending: false });
  
  if (perfisError) throw perfisError;
  if (!perfis || perfis.length === 0) return [];

  // Retornamos perfis com email vazio (será preenchido no cliente se necessário)
  return perfis.map(p => ({ ...p, email: "" }));
}

/**
 * Atualiza configuração da eleição ativa (admin).
 */
export async function atualizarConfiguracaoEleicao(
  input: TablesUpdate<"configuracao_eleicao">
): Promise<{ error: string | null; data: Tables<"configuracao_eleicao"> | null }> {
  await requireAdmin();
  const supabase = await createClient();
  
  // Se está definindo como ativa, desativa as outras
  if (input.ativa === true) {
    await supabase
      .from("configuracao_eleicao")
      .update({ ativa: false })
      .neq("ativa", true);
  }

  // Remove id vazio para evitar erro de UUID
  const { id, ...updateData } = input;
  
  const { data, error } = await supabase
    .from("configuracao_eleicao")
    .upsert(updateData, { onConflict: "id" })
    .select()
    .single();
  
  return { error: error?.message ?? null, data };
}

/**
 * Cria nova configuração de eleição (admin).
 */
export async function criarConfiguracaoEleicao(
  input: TablesUpdate<"configuracao_eleicao"> & { ano: number; turno: number; data_montagem_sexta: string; data_montagem_sabado: string; data_eleicao: string; zona_eleitoral: string }
): Promise<{ error: string | null; data: Tables<"configuracao_eleicao"> | null }> {
  await requireAdmin();
  const supabase = await createClient();
  
  // Se está definindo como ativa, desativa as outras
  if (input.ativa === true) {
    await supabase
      .from("configuracao_eleicao")
      .update({ ativa: false })
      .neq("ativa", true);
  }

  // Remove id vazio para deixar o banco gerar o UUID
  const { id, ...insertData } = input;
  
  const { data, error } = await supabase
    .from("configuracao_eleicao")
    .insert(insertData)
    .select()
    .single();
  
  return { error: error?.message ?? null, data };
}

/**
 * Promove usuário para admin (admin).
 */
export async function promoverParaAdmin(userId: string): Promise<{ error: string | null }> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("perfis")
    .update({ perfil: "admin" })
    .eq("id", userId);
  return { error: error?.message ?? null };
}

/**
 * Rebaixa usuário para servidor_zona (admin).
 */
export async function rebaixarParaServidor(userId: string): Promise<{ error: string | null }> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("perfis")
    .update({ perfil: "servidor_zona" })
    .eq("id", userId);
  return { error: error?.message ?? null };
}