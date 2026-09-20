import { getConfiguracaoEleicao, getAtividadesCompletas, getEquipes, getLocais } from "@/lib/actions/atividades";
import { RelatoriosView } from "@/components/relatorios/relatorios-view";
import { PageContent } from "@/components/layout/page-header";

export default async function RelatoriosPage() {
  const [config, atividades, equipes, locais] = await Promise.all([
    getConfiguracaoEleicao(),
    getAtividadesCompletas(),
    getEquipes(),
    getLocais(),
  ]);

  return (
    <PageContent>
      <RelatoriosView
        config={config}
        atividades={atividades}
        equipes={equipes}
        locais={locais}
      />
    </PageContent>
  );
}