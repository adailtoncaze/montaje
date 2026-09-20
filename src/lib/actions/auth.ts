import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/supabase";
import { cache } from "react";

/**
 * Exige que o usuário esteja autenticado.
 * Redireciona para /login se não estiver.
 * Retorna o cliente Supabase autenticado e o perfil do usuário.
 */
export async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: perfil } = await supabase
    .from("perfis")
    .select("*")
    .eq("id", user.id)
    .single();

  return { supabase, user, perfil };
}

/**
 * Exige que o usuário seja admin.
 * Redireciona para /painel se não for admin.
 */
export async function requireAdmin() {
  const { supabase, user, perfil } = await requireAuth();

  if (perfil?.perfil !== "admin") {
    redirect("/painel");
  }

  return { supabase, user, perfil: perfil as Tables<"perfis"> };
}

/**
 * Busca o perfil do usuário logado.
 * Retorna null se não estiver autenticado (não redireciona).
 * Cacheado por requisição para evitar múltiplas chamadas ao Supabase.
 */
export const getPerfil = cache(async (): Promise<Tables<"perfis"> | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("perfis")
    .select("*")
    .eq("id", user.id)
    .single();

  return data;
});
