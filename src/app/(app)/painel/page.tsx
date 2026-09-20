import { getConfiguracaoEleicao, getAtividadesCompletas, getEquipes, getLocais } from "@/lib/actions/atividades";
import { getPerfil } from "@/lib/actions/auth";
import { PainelView } from "@/components/painel/painel-view";
import { PageContent } from "@/components/layout/page-header";

export default async function PainelPage() {
  const [config, atividades, equipes, locais, perfil] = await Promise.all([
    getConfiguracaoEleicao(),
    getAtividadesCompletas(),
    getEquipes(),
    getLocais(),
    getPerfil(),
  ]);

  const isAdmin = perfil?.perfil === "admin";

  return (
    <PageContent>
      <PainelView
        config={config}
        atividades={atividades}
        equipes={equipes}
        locais={locais}
        isAdmin={isAdmin}
      />
    </PageContent>
  );
}