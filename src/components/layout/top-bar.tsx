"use client";

import { usePathname } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sair } from "@/lib/actions/auth-mutations";

/** Título por rota (mantém os títulos das páginas atuais). */
const PAGE_TITLES: Record<string, string> = {
  "/painel": "Painel",
  "/cronograma": "Cronograma",
  "/locais": "Locais de Votação",
  "/colaboradores": "Colaboradores",
  "/equipes": "Equipes",
  "/relatorios": "Relatórios",
  "/ajustes": "Ajustes",
};

function tituloDaRota(pathname: string): string {
  // Casamento exato ou por prefixo mais longo (ex: /ajustes)
  let titulo = "MontaJE";
  let melhorLen = -1;
  for (const [rota, nome] of Object.entries(PAGE_TITLES)) {
    if (pathname === rota || pathname.startsWith(`${rota}/`)) {
      if (rota.length > melhorLen) {
        titulo = nome;
        melhorLen = rota.length;
      }
    }
  }
  return titulo;
}

/** Barra fixa no topo: título da página ativa + nome do usuário + logout. */
export function TopBar({ nome }: { nome?: string | null }) {
  const pathname = usePathname();
  const titulo = tituloDaRota(pathname);

  return (
    <header className="sticky top-0 z-10 flex min-h-(--header-height) items-center justify-between gap-4 border-b border-stroke bg-surface px-4 py-2 md:px-6">
      <div className="min-w-0">
        <nav aria-label="Você está em" className="text-micro text-fg-4">
          MontaJE <span aria-hidden>/</span>{" "}
          <span className="font-semibold text-fg-3">{titulo}</span>
        </nav>
        <h1 className="truncate text-title font-semibold text-fg">{titulo}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden min-w-0 items-center gap-1.5 text-caption text-fg-3 sm:flex">
          <UserRound className="size-4 shrink-0" aria-hidden />
          <span className="max-w-40 truncate">{nome ?? "Usuário"}</span>
        </span>

        <form action={sair}>
          <Button
            type="submit"
            variant="subtle"
            size="sm"
            className="gap-1.5 whitespace-nowrap"
          >
            <LogOut className="size-4" aria-hidden />
            Sair
          </Button>
        </form>
      </div>
    </header>
  );
}