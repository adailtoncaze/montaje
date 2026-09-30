"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface EstadoLogin {
  erro: string | null;
}

/**
 * Autentica o usuário no servidor (Server Action) e redireciona ao painel.
 *
 * Motivo: o login feito no navegador (`signInWithPassword` + `router.replace`
 * no cliente) mandava o navegador da intranet falar direto com o Supabase —
 * que ele não alcança sem internet — e ainda criava uma corrida entre o
 * redirecionamento e a gravação do cookie, deixando a tela presa no /login
 * mesmo com o usuário já autenticado. Aqui o cookie de sessão é gravado na
 * própria resposta do servidor, antes do redirect, em um único round-trip.
 */
export async function entrar(
  _estado: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");

  if (!email || !senha) {
    return { erro: "Informe e-mail e senha para entrar." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    console.error("Falha no login:", error.message);
    return {
      erro: "E-mail ou senha incorretos. Confira os dados e tente de novo.",
    };
  }

  redirect("/painel");
}