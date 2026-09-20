import { getKpisGerais, getAtividadesPorTipo, getAtividadesPorEquipe, getAtividadesPorLocal, getTimelineAtividades, getConfiguracaoEleicao } from "@/lib/actions/relatorios";
import { RelatoriosView } from "@/components/relatorios/relatorios-view";
import { PageContent } from "@/components/layout/page-header";

export default async function RelatoriosPage() {
  const [config, kpis, porTipo, porEquipe, porLocal, timeline] = await Promise.all([
    getConfiguracaoEleicao(),
    getKpisGerais(),
    getAtividadesPorTipo(),
    getAtividadesPorEquipe(),
    getAtividadesPorLocal(),
    getTimelineAtividades(),
  ]);

  const defaultDataInicio = config?.data_montagem_sexta ?? new Date().toISOString().split("T")[0];
  const defaultDataFim = config?.data_eleicao ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  return (
    <PageContent>
      <RelatoriosView
        kpis={kpis}
        porTipo={porTipo}
        porEquipe={porEquipe}
        porLocal={porLocal}
        timeline={timeline}
        defaultDataInicio={defaultDataInicio}
        defaultDataFim={defaultDataFim}
      />
    </PageContent>
  );
}