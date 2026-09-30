import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { PainelView } from "@/components/painel/painel-view";
import { renderComToast } from "@/test/render";
import { makeAtividade, makeEquipe, makeLocal } from "@/test/fixtures";
import type { AtividadeCompleta } from "@/lib/actions/atividades";
import type { Tables } from "@/types/supabase";

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const CONFIG = {
  id: "cfg-1",
  ano: 2026,
  turno: 1,
  data_montagem_sexta: "2026-10-01",
  data_montagem_sabado: "2026-10-02",
  data_eleicao: "2026-10-04",
  zona_eleitoral: "64ª Zona Eleitoral — João Pessoa/PB",
  ativa: true,
  criado_em: "2026-01-01T00:00:00",
} as Tables<"configuracao_eleicao">;

const EQUIPE = makeEquipe({ id: "eq-1", nome: "Equipe Alfa", tipo: "instalacao" });
const LOCAL = makeLocal({ id: "loc-1", nome: "Escola A", municipio: "João Pessoa" });
const LOCAL_B = makeLocal({ id: "loc-2", nome: "Escola B", municipio: "Campina Grande" });

// "Agora" fixo: 2026-10-02 09:00 em São Paulo (12:00Z). As atividades sem
// fuso são interpretadas no horário de parede do app (America/Sao_Paulo).
const AGORA = new Date("2026-10-02T12:00:00Z");

interface OpcoesRender {
  config?: Tables<"configuracao_eleicao"> | null;
  equipes?: Tables<"equipes">[];
  locais?: Tables<"locais_votacao">[];
  isAdmin?: boolean;
}

function renderView(
  atividades: AtividadeCompleta[] = [],
  opcoes: OpcoesRender = {}
) {
  return renderComToast(
    <PainelView
      config={opcoes.config === undefined ? CONFIG : opcoes.config}
      atividades={atividades}
      equipes={opcoes.equipes ?? [EQUIPE]}
      locais={opcoes.locais ?? [LOCAL]}
      isAdmin={opcoes.isAdmin ?? false}
    />
  );
}

/** Cartão de KPI pelo rótulo (retorna o card inteiro: label + valor + sub). */
function cartaoKpi(rotulo: string): HTMLElement {
  const cartao = screen.getByText(rotulo).closest("[class*='rounded-lg']");
  expect(cartao).not.toBeNull();
  return cartao as HTMLElement;
}

beforeEach(() => {
  vi.setSystemTime(AGORA);
});

/* ------------------------------------------------------------------ */
/*  Sem eleição configurada                                            */
/* ------------------------------------------------------------------ */

describe("PainelView — eleição não configurada", () => {
  it("exibe o estado vazio com link para os Ajustes", () => {
    renderView([], { config: null });

    expect(screen.getByText("Eleição não configurada")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ajustes" })).toHaveAttribute(
      "href",
      "/ajustes"
    );
    // Nada do painel normal deve aparecer
    expect(screen.queryByText("Total")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Nova Atividade/ })).not.toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/*  KPIs                                                               */
/* ------------------------------------------------------------------ */

describe("PainelView — KPIs", () => {
  it("calcula total, concluídas, em andamento, pendentes e atrasadas", () => {
    renderView([
      // Concluída → não conta como pendente/atrasada
      makeAtividade({
        id: "a1",
        status: "concluido",
        data_hora_planejada: "2026-10-02T08:00:00",
      }),
      // Em andamento com horário futuro → mantém em andamento
      makeAtividade({
        id: "a2",
        status: "em_andamento",
        data_hora_planejada: "2026-10-02T15:00:00",
      }),
      // Pendente futura → pendente
      makeAtividade({
        id: "a3",
        status: "pendente",
        data_hora_planejada: "2026-10-02T14:00:00",
      }),
      // Pendente com horário passado (07:00 < 09:00) → atrasada
      makeAtividade({
        id: "a4",
        status: "pendente",
        data_hora_planejada: "2026-10-02T07:00:00",
      }),
    ]);

    expect(within(cartaoKpi("Total")).getByText("4")).toBeInTheDocument();
    const concluidas = cartaoKpi("Concluídas");
    expect(within(concluidas).getByText("1")).toBeInTheDocument();
    expect(within(concluidas).getByText("25%")).toBeInTheDocument();
    expect(within(cartaoKpi("Em andamento")).getByText("1")).toBeInTheDocument();
    expect(within(cartaoKpi("Pendentes")).getByText("1")).toBeInTheDocument();
    expect(within(cartaoKpi("Atrasadas")).getByText("1")).toBeInTheDocument();
  });

  it("zera os contadores (e o percentual) quando não há atividades", () => {
    renderView([]);

    expect(within(cartaoKpi("Total")).getByText("0")).toBeInTheDocument();
    expect(within(cartaoKpi("Concluídas")).getByText("0%")).toBeInTheDocument();
    expect(within(cartaoKpi("Em andamento")).getByText("0")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/*  Agenda                                                             */
/* ------------------------------------------------------------------ */

describe("PainelView — agenda", () => {
  it("agrupa as pendentes por dia (Hoje/Amanhã) e oculta as concluídas", () => {
    renderView([
      makeAtividade({
        id: "hoje",
        local: LOCAL,
        equipe: EQUIPE,
        tipo: "instalacao",
        status: "pendente",
        data_hora_planejada: "2026-10-02T14:00:00",
      }),
      makeAtividade({
        id: "amanha",
        local: LOCAL_B,
        equipe: EQUIPE,
        tipo: "verificacao",
        status: "pendente",
        data_hora_planejada: "2026-10-03T08:00:00",
      }),
      // Concluída hoje → não entra na agenda
      makeAtividade({
        id: "concluida",
        local: makeLocal({ id: "loc-c", nome: "Escola C" }),
        status: "concluido",
        data_hora_planejada: "2026-10-02T08:00:00",
      }),
      // Fora da janela (ontem) → não entra na agenda
      makeAtividade({
        id: "ontem",
        local: makeLocal({ id: "loc-d", nome: "Escola D" }),
        status: "pendente",
        data_hora_planejada: "2026-10-01T08:00:00",
      }),
    ]);

    expect(screen.getByText("Hoje")).toBeInTheDocument();
    expect(screen.getByText("Amanhã")).toBeInTheDocument();
    expect(screen.getAllByText("(1)")).toHaveLength(2);

    expect(screen.getByText("Escola A")).toBeInTheDocument();
    expect(screen.getByText("Escola B")).toBeInTheDocument();
    expect(screen.queryByText("Escola C")).not.toBeInTheDocument();
    expect(screen.queryByText("Escola D")).not.toBeInTheDocument();

    // Acessos do card da agenda
    expect(screen.getByText("Atividades pendentes de hoje aos próximos 7 dias")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver todas/ })).toHaveAttribute(
      "href",
      "/cronograma"
    );
  });

  it("marca a atividade em atraso do dia (e a pendente futura)", () => {
    renderView([
      makeAtividade({
        id: "atrasada",
        local: LOCAL,
        tipo: "recolhimento_urna",
        status: "pendente",
        data_hora_planejada: "2026-10-02T07:00:00", // 07:00 < agora (09:00)
      }),
      makeAtividade({
        id: "pendente",
        local: LOCAL_B,
        tipo: "recolhimento_midia",
        status: "pendente",
        data_hora_planejada: "2026-10-02T14:00:00", // futura
      }),
    ]);

    expect(screen.getByTitle("Atrasada")).toBeInTheDocument();
    expect(screen.getByTitle("Pendente")).toBeInTheDocument();
    expect(screen.queryByTitle("Em andamento")).not.toBeInTheDocument();
  });

  it("informa quando não há pendentes na janela", () => {
    renderView([
      makeAtividade({
        id: "a1",
        status: "concluido",
        data_hora_planejada: "2026-10-02T08:00:00",
      }),
    ]);

    expect(
      screen.getByText("Nenhuma atividade pendente nos próximos 7 dias.")
    ).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/*  Progresso por tipo                                                 */
/* ------------------------------------------------------------------ */

describe("PainelView — progresso por tipo", () => {
  it("mostra contagem concluídas/total e a barra de cada tipo", () => {
    renderView([
      makeAtividade({
        id: "p1",
        tipo: "instalacao",
        status: "concluido",
        data_hora_planejada: "2026-10-02T08:00:00",
      }),
      makeAtividade({
        id: "p2",
        tipo: "instalacao",
        status: "pendente",
        data_hora_planejada: "2026-10-02T14:00:00",
      }),
      makeAtividade({
        id: "p3",
        tipo: "verificacao",
        status: "concluido",
        data_hora_planejada: "2026-10-02T08:00:00",
      }),
    ]);

    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("1/1")).toBeInTheDocument();
    // Tipos sem atividades aparecem zerados
    expect(screen.getAllByText("0/0")).toHaveLength(2);

    // 1 de 2 instalacao → barra de 50%; 1 de 1 verificação → 100%
    const itemInstalacao = screen.getByText("1/2").closest("div")!.parentElement!;
    expect(itemInstalacao.querySelector(".bg-brand")).toHaveStyle({ width: "50%" });
    const itemVerificacao = screen.getByText("1/1").closest("div")!.parentElement!;
    expect(itemVerificacao.querySelector(".bg-brand")).toHaveStyle({ width: "100%" });
  });

  it("mostra o percentual geral no cabeçalho do card", () => {
    renderView([
      makeAtividade({
        id: "p1",
        tipo: "instalacao",
        status: "concluido",
        data_hora_planejada: "2026-10-02T08:00:00",
      }),
    ]);

    expect(
      screen.getByText("100% das atividades concluídas")
    ).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/*  Permissões e rodapé                                                */
/* ------------------------------------------------------------------ */

describe("PainelView — permissões e informações", () => {
  it("mostra o botão Nova Atividade apenas para administradores", () => {
    renderView([], { isAdmin: true });
    expect(screen.getByRole("link", { name: /Nova Atividade/ })).toHaveAttribute(
      "href",
      "/cronograma"
    );
  });

  it("não mostra o botão Nova Atividade para não administradores", () => {
    renderView([], { isAdmin: false });
    expect(
      screen.queryByRole("link", { name: /Nova Atividade/ })
    ).not.toBeInTheDocument();
  });

  it("informa a quantidade de locais e equipes no rodapé", () => {
    renderView([], {
      equipes: [EQUIPE, makeEquipe({ id: "eq-2", nome: "Equipe Beta" })],
      locais: [LOCAL, LOCAL_B],
    });

    expect(screen.getByText("2 locais")).toBeInTheDocument();
    expect(screen.getByText("2 equipes")).toBeInTheDocument();
  });
});