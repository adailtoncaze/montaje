import { getConfiguracaoEleicao, getAtividadesCompletas, getEquipes, getLocais } from "@/lib/actions/atividades";
import { getMembrosPorEquipe } from "@/lib/actions/equipes";
import { RelatoriosView } from "@/components/relatorios/relatorios-view";
import { PageContent } from "@/components/layout/page-header";

export default async function RelatoriosPage() {
  const [config, atividades, equipes, locais, membrosPorEquipe] =
    await Promise.all([
      getConfiguracaoEleicao(),
      getAtividadesCompletas(),
      getEquipes(),
      getLocais(),
      getMembrosPorEquipe(),
    ]);

  return (
    <PageContent>
      <RelatoriosView
        config={config}
        atividades={atividades}
        equipes={equipes}
        locais={locais}
        membrosPorEquipe={membrosPorEquipe}
      />
    </PageContent>
  );
}