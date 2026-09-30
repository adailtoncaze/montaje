import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/supabase";
import { cache } from "react";

/**
 * Usuário autenticado (ou null) da requisição atual, cacheado por requisição.
 *
 * Quem valida e renova o token no Supabase é o MIDDLEWARE (`getUser()`), que
 * roda antes de toda requisição e já grava os cookies renovados. Aqui lemos
 * a sessão diretamente dos cookies (`getSession()` — leitura local quando o
 * token veio do middleware recém-renovado). Antes, layout e páginas também
 * chamavam `getUser()` por conta própria, disparando refreshs de token
 * CONCORRENTES em requisições paralelas (ex.: prefetch de rotas no App
 * Router): o refresh token é de uso único e, com o access token vencido, o
 * primeiro request queimava o token, o segundo falhava e a sessão parecia
 * inexistente — as queries caíam no RLS e a página exibia o erro
 * intermitente. Foi exatamente o padrão do /painel na Vercel, que sumia só
 * com refresh manual.
 */
export const getUsuario = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user ?? null;
});

/**
 * Exige que o usuário esteja autenticado.
 * Redireciona para /login se não estiver.
 * Retorna o cliente Supabase autenticado e o perfil do usuário.
 */
export async function requireAuth() {
  const user = await getUsuario();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: perfil, error: perfilError } = await supabase
    .from("perfis")
    .select("*")
    .eq("id", user.id)
    .single();
  // PGRST116 = usuário sem registro em perfis (ainda deve ser criado).
  if (perfilError && perfilError.code !== "PGRST116") throw perfilError;

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
  const user = await getUsuario();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("perfis")
    .select("*")
    .eq("id", user.id)
    .single();
  // PGRST116 = usuário sem registro em perfis — retorna null (não-admin).
  if (error && error.code !== "PGRST116") throw error;

  return data;
});
