"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { Vote } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass =
  "h-8 w-full rounded-md border border-stroke-strong bg-surface px-3 text-body text-fg placeholder:text-fg-4 focus-visible:border-brand";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    const { error } = await createClient().auth.signInWithPassword({
      email,
      password: senha,
    });
    setCarregando(false);
    if (error) {
      setErro("E-mail ou senha incorretos. Confira os dados e tente de novo.");
      return;
    }
    router.replace("/painel");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-rail text-rail-fg">
            <Vote className="size-[18px]" aria-hidden />
          </div>
          <h1 className="text-title font-semibold">Entrar no MontaJE</h1>
        </div>

        <form onSubmit={entrar} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-caption font-semibold text-fg-2">E-mail</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-caption font-semibold text-fg-2">Senha</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className={inputClass}
            />
          </label>

          {erro && (
            <p role="alert" className="text-caption text-danger-fg">
              {erro}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={carregando}
          >
            {carregando ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
