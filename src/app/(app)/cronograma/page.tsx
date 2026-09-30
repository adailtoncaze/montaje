import { getConfiguracaoEleicao, getAtividadesCompletas, getEquipes, getLocais } from "@/lib/actions/atividades";
import { getPerfil } from "@/lib/actions/auth";
import { addDias, hojeSaoPaulo } from "@/lib/utils/date";
import { CronogramaView } from "@/components/cronograma/cronograma-view";
import { PageContent } from "@/components/layout/page-header";

export default async function CronogramaPage() {
  // Busca dados em paralelo
  const [config, atividades, equipes, locais, perfil] = await Promise.all([
    getConfiguracaoEleicao(),
    getAtividadesCompletas(),
    getEquipes(),
    getLocais(),
    getPerfil(),
  ]);

  const isAdmin = perfil?.perfil === "admin";

  // Define período padrão baseado na configuração da eleição
  // (data local em America/Sao_Paulo, não UTC)
  const hojeSP = hojeSaoPaulo();
  const defaultDataInicio = config?.data_montagem_sexta ?? hojeSP;
  const defaultDataFim = config?.data_eleicao ?? addDias(hojeSP, 30);

  return (
    <PageContent>
      <CronogramaView
        atividades={atividades}
        equipes={equipes}
        locais={locais}
        defaultDataInicio={defaultDataInicio}
        defaultDataFim={defaultDataFim}
        isAdmin={isAdmin}
      />
    </PageContent>
  );
}