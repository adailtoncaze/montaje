import { getConfiguracaoEleicao } from "@/lib/actions/atividades";
import { getPerfil } from "@/lib/actions/auth";
import { listarUsuarios, atualizarConfiguracaoEleicao, criarConfiguracaoEleicao, promoverParaAdmin, rebaixarParaServidor } from "@/lib/actions/auth-mutations";
import { AjustesView } from "@/components/ajustes/ajustes-view";
import { PageContent } from "@/components/layout/page-header";

export default async function AjustesPage() {
  const [config, perfil, usuarios] = await Promise.all([
    getConfiguracaoEleicao(),
    getPerfil(),
    listarUsuarios(),
  ]);

  const isAdmin = perfil?.perfil === "admin";

  if (!isAdmin) {
    return (
      <PageContent>
        <div className="rounded-lg border border-stroke bg-surface p-8 text-center">
          <p className="text-body text-fg-3">Acesso restrito a administradores.</p>
        </div>
      </PageContent>
    );
  }

  return (
    <PageContent>
      <AjustesView
        config={config}
        usuarios={usuarios}
        perfil={perfil}
      />
    </PageContent>
  );
}