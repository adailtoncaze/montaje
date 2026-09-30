"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { createClient } from "@/lib/supabase/client";
import { entrar } from "./actions";

const inputClass =
  "h-8 w-full rounded-md border border-stroke-strong bg-surface px-3 text-body text-fg placeholder:text-fg-4 focus-visible:border-brand focus-visible:outline-none";

export default function LoginPage() {
  const router = useRouter();
  const [estado, formAction, pendente] = useActionState(entrar, { erro: null });

  // Sessão já existente nos cookies (ex.: voltou com a seta do navegador
  // depois de logar). A leitura é local (getSession), sem rede. O login em si
  // acontece na Server Action, que grava o cookie e redireciona de uma vez.
  useEffect(() => {
    let ativo = true;
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (ativo && data.session) router.replace("/painel");
      })
      .catch(() => {
        // Sem sessão ou erro ao ler: permanece na tela de login.
      });
    return () => {
      ativo = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-rail text-rail-fg">
            <Logo className="size-7" />
          </div>
          <h1 className="text-title font-semibold">Entrar no MontaJE</h1>
        </div>

        <form action={formAction} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-caption font-semibold text-fg-2">E-mail</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              className={inputClass}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-caption font-semibold text-fg-2">Senha</span>
            <input
              type="password"
              name="senha"
              autoComplete="current-password"
              required
              className={inputClass}
            />
          </label>

          {estado.erro && (
            <p role="alert" className="text-caption text-danger-fg">
              {estado.erro}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={pendente}
          >
            {pendente ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </Card>
    </main>
  );
}