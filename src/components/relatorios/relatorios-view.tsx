"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  FileDown,
  FileText,
  Loader2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { TIPO_ATIVIDADE_LABEL } from "@/lib/constants";
import {
  agrupaPorDia,
  agrupaPorEquipe,
  baixarArquivo,
  filtraAtividades,
  gerarPdfRelatorio,
  montaCsv,
  nomeArquivoCsv,
  type AgruparPor,
  type IdFiltro,
  type TipoFiltro,
} from "@/lib/reports";
import type { AtividadeCompleta } from "@/lib/actions/atividades";
import type { Tables } from "@/types/supabase";
import type { TipoAtividade } from "@/types/database";

interface RelatoriosViewProps {
  config: Tables<"configuracao_eleicao"> | null;
  atividades: AtividadeCompleta[];
  equipes: Tables<"equipes">[];
  locais: Tables<"locais_votacao">[];
}

export function RelatoriosView({
  config,
  atividades,
  equipes,
  locais,
}: RelatoriosViewProps) {
  const { toast } = useToast();

  const [agruparPor, setAgruparPor] = useState<AgruparPor>("equipe");
  const [tipo, setTipo] = useState<TipoFiltro>("todas");
  const [equipeId, setEquipeId] = useState<IdFiltro>("todas");
  const [municipio, setMunicipio] = useState<IdFiltro>("todos");
  const [dataInicio, setDataInicio] = useState(
    config?.data_montagem_sexta ?? ""
  );
  const [dataFim, setDataFim] = useState(config?.data_eleicao ?? "");
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [gerandoCsv, setGerandoCsv] = useState(false);

  const municipios = useMemo(
    () =>
      Array.from(new Set(locais.map((l) => l.municipio).filter(Boolean))).sort(),
    [locais]
  );

  const resultados = useMemo(() => {
    const lista = filtraAtividades(atividades, {
      agruparPor,
      tipo,
      equipeId,
      municipio,
      dataInicio,
      dataFim,
    });
    return agruparPor === "equipe" ? agrupaPorEquipe(lista) : agrupaPorDia(lista);
  }, [atividades, agruparPor, tipo, equipeId, municipio, dataInicio, dataFim]);

  const totalAtividades = useMemo(
    () => resultados.reduce((soma, g) => soma + g.atividades.length, 0),
    [resultados]
  );

  const meta = {
    ano: config?.ano ?? 0,
    turno: config?.turno ?? 1,
    zonaEleitoral: config?.zona_eleitoral ?? "",
  };

  const aoGerarPdf = async () => {
    if (totalAtividades === 0) return;
    setGerandoPdf(true);
    try {
      await gerarPdfRelatorio(resultados, meta, new Date());
      toast("success", "PDF gerado com sucesso.");
    } catch {
      toast("error", "Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setGerandoPdf(false);
    }
  };

  const aoExportarCsv = () => {
    if (totalAtividades === 0) return;
    setGerandoCsv(true);
    try {
      baixarArquivo(
        montaCsv(resultados),
        nomeArquivoCsv(resultados, meta),
        "text/csv;charset=utf-8"
      );
      toast("success", "CSV exportado com sucesso.");
    } catch {
      toast("error", "Não foi possível exportar o CSV. Tente novamente.");
    } finally {
      setGerandoCsv(false);
    }
  };

  const semPeriodo = !dataInicio && !dataFim;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <Card>
        <CardHeader
          title="Gerar relatório"
          description="Escolha o agrupamento e os filtros. O PDF segue o modelo do cronograma: cabeçalho oficial, agrupamento por município e tabela com sequência, local, seções, tipo de atividade, horários, equipe e origem."
        />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
          <Select
            label="Agrupar por"
            value={agruparPor}
            onChange={(e) => setAgruparPor(e.target.value as AgruparPor)}
            options={[
              { value: "equipe", label: "Por equipe (um bloco por equipe)" },
              { value: "dia", label: "Por dia (um bloco por dia)" },
            ]}
          />
          <Select
            label="Tipo de atividade"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoFiltro)}
            options={[
              { value: "todas", label: "Todas" },
              ...(Object.keys(TIPO_ATIVIDADE_LABEL) as TipoAtividade[]).map(
                (k) => ({ value: k, label: TIPO_ATIVIDADE_LABEL[k] })
              ),
            ]}
          />
          <Select
            label="Equipe"
            value={equipeId}
            onChange={(e) => setEquipeId(e.target.value as IdFiltro)}
            options={[
              { value: "todas", label: "Todas as equipes" },
              ...equipes.map((e) => ({ value: e.id, label: e.nome })),
            ]}
          />
          <Select
            label="Município"
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value as IdFiltro)}
            options={[
              { value: "todos", label: "Todos os municípios" },
              ...municipios.map((m) => ({ value: m, label: m })),
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Data inicial"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
            <Input
              label="Data final"
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="subtle"
              onClick={() => {
                setDataInicio("");
                setDataFim("");
              }}
              disabled={semPeriodo}
            >
              Limpar período
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Resumo do relatório"
          description={`${totalAtividades} ${
            totalAtividades === 1 ? "atividade" : "atividades"
          } em ${resultados.length} ${
            agruparPor === "equipe" ? "equipes" : "dias"
          }`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={aoExportarCsv}
                disabled={totalAtividades === 0 || gerandoCsv}
              >
                {gerandoCsv ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <FileDown className="size-4" aria-hidden />
                )}
                Exportar CSV
              </Button>
              <Button
                variant="primary"
                onClick={aoGerarPdf}
                disabled={totalAtividades === 0 || gerandoPdf}
              >
                {gerandoPdf ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <FileText className="size-4" aria-hidden />
                )}
                Gerar PDF
              </Button>
            </div>
          }
        />
        <div className="px-5 pb-5">
          {resultados.length === 0 ? (
            <p className="rounded-md border border-stroke bg-surface-subtle px-3 py-4 text-center text-caption text-fg-4">
              Nenhuma atividade corresponde aos filtros. Ajuste os filtros
              acima.
            </p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto rounded-md border border-stroke bg-surface-subtle p-3">
              {resultados.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="flex min-w-0 items-center gap-2 text-body">
                    {agruparPor === "equipe" ? (
                      <Users className="size-4 shrink-0 text-fg-3" aria-hidden />
                    ) : (
                      <CalendarDays
                        className="size-4 shrink-0 text-fg-3"
                        aria-hidden
                      />
                    )}
                    <span className="truncate font-semibold text-fg">
                      {g.titulo}
                    </span>
                    {g.subtitulo && (
                      <span className="hidden truncate text-caption text-fg-3 sm:inline">
                        {g.subtitulo}
                      </span>
                    )}
                  </span>
                  <Badge tone="brand">
                    {g.atividades.length}{" "}
                    {g.atividades.length === 1 ? "atividade" : "atividades"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}