import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { RelatoriosView } from "@/components/relatorios/relatorios-view";
import { renderComToast } from "@/test/render";
import { makeAtividade, makeEquipe, makeLocal } from "@/test/fixtures";
import { parseCSV } from "@/lib/csv";
import type { AtividadeCompleta } from "@/lib/actions/atividades";
import type { MembroResumido } from "@/lib/actions/equipes";
import type { Tables } from "@/types/supabase";

/* ------------------------------------------------------------------ */
/*  Mocks: só os efeitos colaterais (download e PDF)                   */
/*  As funções de filtro/agrupamento/CSV são as reais.                 */
/* ------------------------------------------------------------------ */

vi.mock("@/lib/reports", async (importOriginal) => {
  const modulo = await importOriginal<typeof import("@/lib/reports")>();
  return {
    ...modulo,
    gerarPdfRelatorio: vi.fn(async () => {}),
    baixarArquivo: vi.fn(),
  };
});

import { baixarArquivo, gerarPdfRelatorio } from "@/lib/reports";

const mockBaixar = vi.mocked(baixarArquivo);
const mockGerarPdf = vi.mocked(gerarPdfRelatorio);

function documentoTexto(corpo: string): string {
  return corpo.includes("Resumo do relatório") ? "TEM_RESUMO" : "SEM_RESUMO";
}

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const EQUIPE = makeEquipe({ id: "eq-1", nome: "Equipe Alfa", tipo: "instalacao" });
const LOCAL = makeLocal({ id: "loc-1", nome: "Escola A", municipio: "João Pessoa" });

const MEMBROS: MembroResumido[] = [
  { nome: "Bruno Costa", papel: "responsavel" },
  { nome: "Ana Lima", papel: "membro" },
];

// O bug reproduzido: duracao_minutos obsoleta (120 min) não bate com os
// horários 09:00–12:30 (210 min). O relatório tem que recalcular pelo
// intervalo, ignorando a coluna antiga.
const ATIVIDADE_EDITADA: AtividadeCompleta = makeAtividade({
  id: "atv-1",
  local_id: "loc-1",
  equipe_id: "eq-1",
  tipo: "instalacao",
  data_hora_planejada: "2026-10-02T09:00:00",
  status: "pendente",
  sequencia: 1,
  inicio_planejado: "09:00:00",
  fim_planejado: "12:30:00",
  duracao_minutos: 120, // valor antigo no banco
  local: LOCAL,
  equipe: EQUIPE,
});

function renderView(
  atividades: AtividadeCompleta[] = [ATIVIDADE_EDITADA],
  opcoes: { locais?: Tables<"locais_votacao">[] } = {}
) {
  return renderComToast(
    <RelatoriosView
      config={
        {
          ano: 2026,
          turno: 1,
          zona_eleitoral: "64ª Zona Eleitoral — João Pessoa/PB",
          data_montagem_sexta: "2026-10-01",
          data_eleicao: "2026-10-04",
        } as Tables<"configuracao_eleicao">
      }
      atividades={atividades}
      equipes={[EQUIPE]}
      locais={opcoes.locais ?? [LOCAL]}
      membrosPorEquipe={{ "eq-1": MEMBROS }}
    />
  );
}

beforeEach(() => {
  vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
  mockBaixar.mockClear();
  mockGerarPdf.mockClear();
});

/* ------------------------------------------------------------------ */
/*  Renderização                                                       */
/* ------------------------------------------------------------------ */

describe("RelatoriosView — renderização", () => {
  it("mostra o resumo com o total de atividades", () => {
    renderView();
    expect(screen.getByText(/Gerar relatório/)).toBeInTheDocument();
    expect(screen.getByText("1 atividade em 1 equipes")).toBeInTheDocument();
  });

  it("resumo em dias ao mudar o agrupamento", () => {
    renderView();
    fireEvent.change(screen.getByLabelText(/Agrupar por/), {
      target: { value: "dia" },
    });
    expect(screen.getByText("1 atividade em 1 dias")).toBeInTheDocument();
  });

  it("lista o bloco por equipe com título e membros", () => {
    renderView();
    expect(screen.getByText("Equipe: Equipe Alfa")).toBeInTheDocument();
  });

  it("informa quando nenhuma atividade corresponde aos filtros", () => {
    renderView([
      makeAtividade({ data_hora_planejada: "2026-11-01T08:00:00" }),
    ]);
    expect(
      screen.getByText(/Nenhuma atividade corresponde aos filtros/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Exportar CSV/ }) as HTMLButtonElement
    ).toBeDisabled();
  });
});

/* ------------------------------------------------------------------ */
/*  BUG: duração obsoleta no CSV após editar Início/Fim                */
/* ------------------------------------------------------------------ */

describe("RelatoriosView — CSV com duração recalculada", () => {
  it("exporta o CSV com o Tempo recalculado dos horários (bug do relatório)", async () => {
    renderView();

    fireEvent.click(screen.getByRole("button", { name: /Exportar CSV/ }));

    await waitFor(() => expect(mockBaixar).toHaveBeenCalledTimes(1));
    const [conteudo, nomeArquivo, mime] = mockBaixar.mock.calls[0];

    expect(nomeArquivo).toBe("Relatorio-equipe-equipe-alfa.csv");
    expect(mime).toContain("text/csv");

    const linhas = parseCSV(conteudo);
    expect(linhas).toHaveLength(1);
    // Duração derivada do intervalo (09:00–12:30 = 3h 30min), não dos 120 min
    expect(linhas[0]["Horário (início – fim)"]).toBe("09:00 – 12:30");
    expect(linhas[0].Tempo).toBe("3h 30min");
  });

  it("passa os grupos já agrupados por equipe para o CSV", async () => {
    renderView([ATIVIDADE_EDITADA]);
    fireEvent.click(screen.getByRole("button", { name: /Exportar CSV/ }));

    await waitFor(() => expect(mockBaixar).toHaveBeenCalledTimes(1));
    const linhas = parseCSV(mockBaixar.mock.calls[0][0]);
    expect(linhas[0]["LAT Origem"]).toBe("GPS 1");
    expect(linhas[0]["Local de votação"]).toBe("Escola A");
    expect(linhas[0].Município).toBe("João Pessoa");
    expect(linhas[0].Status).toBe("Pendente");
  });

  it("respeita o filtro por equipe ao exportar", async () => {
    const outra = makeAtividade({
      id: "atv-2",
      local_id: "loc-1",
      equipe_id: "eq-x",
      local: LOCAL,
    });
    renderView([ATIVIDADE_EDITADA, outra]);

    fireEvent.change(screen.getByLabelText(/Equipe/), {
      target: { value: "eq-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Exportar CSV/ }));

    await waitFor(() => expect(mockBaixar).toHaveBeenCalledTimes(1));
    expect(parseCSV(mockBaixar.mock.calls[0][0])).toHaveLength(1);
  });

  it("exporta a sequência cadastrada da atividade (não a posição da linha)", async () => {
    renderView([
      makeAtividade({
        id: "atv-seq",
        local_id: "loc-1",
        equipe_id: "eq-1",
        local: LOCAL,
        equipe: EQUIPE,
        sequencia: 7,
      }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: /Exportar CSV/ }));

    await waitFor(() => expect(mockBaixar).toHaveBeenCalledTimes(1));
    const linhas = parseCSV(mockBaixar.mock.calls[0][0]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]["Seq."]).toBe("7");
  });

  it("mantém os botões desabilitados quando não há atividades", () => {
    renderView([]);
    expect(
      screen.getByRole("button", { name: /Exportar CSV/ }) as HTMLButtonElement
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Gerar PDF/ }) as HTMLButtonElement
    ).toBeDisabled();
  });
});

/* ------------------------------------------------------------------ */
/*  Geração de PDF                                                    */
/* ------------------------------------------------------------------ */

describe("RelatoriosView — geração de PDF", () => {
  it("chama gerarPdfRelatorio com os grupos e a meta", async () => {
    renderView();

    fireEvent.click(screen.getByRole("button", { name: /Gerar PDF/ }));

    await waitFor(() => expect(mockGerarPdf).toHaveBeenCalledTimes(1));
    const [grupos, meta, quando] = mockGerarPdf.mock.calls[0];
    expect(grupos).toHaveLength(1);
    expect(grupos[0].titulo).toBe("Equipe: Equipe Alfa");
    expect(meta).toMatchObject({
      ano: 2026,
      turno: 1,
      zonaEleitoral: "64ª Zona Eleitoral — João Pessoa/PB",
      tipoLabel: "",
    });
    expect(quando).toBeInstanceOf(Date);
  });

  it("não gera o PDF quando a lista está vazia", () => {
    renderView([]);
    const botao = screen.getByRole("button", { name: /Gerar PDF/ }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
  });

  it("mostra erro em toast quando o PDF falha", async () => {
    mockGerarPdf.mockRejectedValue(new Error("boom"));
    renderView();

    fireEvent.click(screen.getByRole("button", { name: /Gerar PDF/ }));
    expect(
      await screen.findByText("Não foi possível gerar o PDF. Tente novamente.")
    ).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/*  Filtros                                                            */
/* ------------------------------------------------------------------ */

describe("RelatoriosView — filtros", () => {
  it("filtra por município", async () => {
    const outroLocal = makeLocal({ id: "loc-2", nome: "Escola B", municipio: "Campina Grande" });
    renderView(
      [
        ATIVIDADE_EDITADA,
        makeAtividade({
          id: "atv-2",
          local_id: "loc-2",
          equipe_id: "eq-1",
          local: outroLocal,
          equipe: EQUIPE,
        }),
      ],
      { locais: [LOCAL, outroLocal] }
    );

    fireEvent.change(screen.getByLabelText(/Município/), {
      target: { value: "Campina Grande" },
    });

    expect(await screen.findByText("1 atividade em 1 equipes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Exportar CSV/ }));
    await waitFor(() => expect(mockBaixar).toHaveBeenCalledTimes(1));
    const linhas = parseCSV(mockBaixar.mock.calls[0][0]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].Município).toBe("Campina Grande");
  });

  it("filtra por tipo de atividade e envia tipoLabel na meta", async () => {
    renderView([ATIVIDADE_EDITADA]);
    fireEvent.change(screen.getByLabelText(/Tipo de atividade/), {
      target: { value: "instalacao" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Gerar PDF/ }));

    await waitFor(() => expect(mockGerarPdf).toHaveBeenCalledTimes(1));
    expect(mockGerarPdf.mock.calls[0][1].tipoLabel).toBe("Instalação de Urna");
  });

  it("limpa o período com o botão Limpar período", () => {
    renderView();
    const inicio = screen.getByLabelText("Data inicial") as HTMLInputElement;
    const fim = screen.getByLabelText("Data final") as HTMLInputElement;
    expect(inicio.value).toBe("2026-10-01");
    expect(fim.value).toBe("2026-10-04");

    fireEvent.click(screen.getByRole("button", { name: /Limpar período/ }));
    expect(inicio.value).toBe("");
    expect(fim.value).toBe("");
  });
});