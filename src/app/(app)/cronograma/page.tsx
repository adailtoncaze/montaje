import { getConfiguracaoEleicao, getAtividadesCompletas, getEquipes, getLocais } from "@/lib/actions/atividades";
import { getPerfil } from "@/lib/actions/auth";
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
  const hojeSP = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const limite = new Date();
  limite.setDate(limite.getDate() + 30);
  const daqui30diasSP = limite.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const defaultDataInicio = config?.data_montagem_sexta ?? hojeSP;
  const defaultDataFim = config?.data_eleicao ?? daqui30diasSP;

  return (
    <PageContent>
      <CronogramaView
        atividades={atividades}
        equipes={equipes.map((e) => ({ id: e.id, nome: e.nome, tipo: e.tipo }))}
        locais={locais.map((l) => ({ id: l.id, nome: l.nome, municipio: l.municipio }))}
        defaultDataInicio={defaultDataInicio}
        defaultDataFim={defaultDataFim}
        isAdmin={isAdmin}
      />
    </PageContent>
  );
}