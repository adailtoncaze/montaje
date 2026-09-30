import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { CronogramaView } from "@/components/cronograma/cronograma-view";
import { renderComToast } from "@/test/render";
import { makeAtividade, makeEquipe, makeLocal } from "@/test/fixtures";
import type { Tables } from "@/types/supabase";
import type { AtividadeCompleta } from "@/lib/actions/atividades";

/* ------------------------------------------------------------------ */
/*  Server actions mockadas                                           */
/* ------------------------------------------------------------------ */

vi.mock("@/lib/actions/atividades-mutations", () => ({
  criarAtividade: vi.fn(async () => ({ error: null, data: null })),
  atualizarAtividade: vi.fn(async () => ({ error: null, data: null })),
  excluirAtividade: vi.fn(async () => ({ error: null })),
  iniciarAtividade: vi.fn(async () => ({ error: null, data: null })),
  concluirAtividade: vi.fn(async () => ({ error: null, data: null })),
  atualizarObservacoes: vi.fn(async () => ({ error: null, data: null })),
}));

import {
  atualizarAtividade,
  atualizarObservacoes,
  concluirAtividade,
  criarAtividade,
  excluirAtividade,
  iniciarAtividade,
} from "@/lib/actions/atividades-mutations";

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const EQUIPE_A = makeEquipe({ id: "eq-a", nome: "Equipe Alfa", tipo: "instalacao" });
const EQUIPE_B = makeEquipe({ id: "eq-b", nome: "Equipe Beta", tipo: "recolhimento_urna" });
const LOCAL_A = makeLocal({ id: "loc-a", nome: "Escola A", municipio: "João Pessoa" });
const LOCAL_B = makeLocal({ id: "loc-b", nome: "Escola B", municipio: "Campina Grande" });

const EQUIPES: Tables<"equipes">[] = [EQUIPE_A, EQUIPE_B];
const LOCAIS: Tables<"locais_votacao">[] = [LOCAL_A, LOCAL_B];

const ATIVIDADE: AtividadeCompleta = makeAtividade({
  id: "atv-1",
  local_id: "loc-a",
  equipe_id: "eq-a",
  tipo: "instalacao",
  data_hora_planejada: "2026-10-02T08:00:00",
  status: "pendente",
  sequencia: 1,
  inicio_planejado: "08:00:00",
  fim_planejado: "10:00:00",
  duracao_minutos: 120,
  observacoes: null,
  local: LOCAL_A,
  equipe: EQUIPE_A,
});

function renderView(
  atividades: AtividadeCompleta[] = [ATIVIDADE],
  isAdmin = true
) {
  return renderComToast(
    <CronogramaView
      atividades={atividades}
      equipes={EQUIPES}
      locais={LOCAIS}
      defaultDataInicio="2026-10-01"
      defaultDataFim="2026-10-31"
      isAdmin={isAdmin}
    />
  );
}

/** Abre o accordion do dia para exibir a tabela de atividades. */
async function expandirDia(nomeDia = "02/10/2026") {
  const botao = await screen.findByRole("button", { name: new RegExp(nomeDia) });
  fireEvent.click(botao);
}

const mockAtualizar = vi.mocked(atualizarAtividade);
const mockCriar = vi.mocked(criarAtividade);
const mockExcluir = vi.mocked(excluirAtividade);
const mockIniciar = vi.mocked(iniciarAtividade);
const mockConcluir = vi.mocked(concluirAtividade);
const mockObs = vi.mocked(atualizarObservacoes);

/**
 * Busca um campo pelo rótulo exato. Campos obrigatórios renderizam um "*"
 * decorativo dentro do <label> ("Equipe*"), daí o sufixo opcional.
 */
function campo(rotulo: string): HTMLElement {
  const alvo = rotulo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return screen.getByLabelText(new RegExp(`^${alvo}\\s*\\*?$`));
}

beforeEach(() => {
  // 2026-10-01 09:00 em São Paulo: a atividade de 02/10 está "pendente".
  vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
  mockAtualizar.mockResolvedValue({ error: null, data: null });
  mockCriar.mockResolvedValue({ error: null, data: null });
  mockExcluir.mockResolvedValue({ error: null });
  mockIniciar.mockResolvedValue({ error: null, data: null });
  mockConcluir.mockResolvedValue({ error: null, data: null });
  mockObs.mockResolvedValue({ error: null, data: null });
});

/* ------------------------------------------------------------------ */
/*  Renderização                                                       */
/* ------------------------------------------------------------------ */

describe("CronogramaView — renderização", () => {
  it("mostra o título e o botão de nova atividade para admin", () => {
    renderView();
    expect(screen.getByText("Cronograma de Atividades")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nova Atividade/i })).toBeInTheDocument();
  });

  it("esconde o botão de nova atividade para não-admin", () => {
    renderView([ATIVIDADE], false);
    expect(screen.queryByRole("button", { name: /Nova Atividade/i })).toBeNull();
  });

  it("agrupa as atividades por dia com a contagem", async () => {
    renderView();
    expect(await screen.findByText(/1 atividade$/)).toBeInTheDocument();
  });

  it("mostra mensagem de lista vazia sem nenhuma atividade", () => {
    renderView([]);
    expect(screen.getByText("Nenhuma atividade cadastrada.")).toBeInTheDocument();
  });

  it("esconde as ações de editar/excluir para não-admin", async () => {
    renderView([ATIVIDADE], false);
    await expandirDia();
    expect(screen.queryByRole("button", { name: /Editar/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Iniciar/ })).toBeInTheDocument();
  });

  it("mostra local, tipo, equipe e status na linha", async () => {
    renderView();
    await expandirDia();

    const linha = screen.getByRole("row", { name: /Escola A/ });
    // "Instalação de Urna" aparece 2x na linha: badge do tipo e subtítulo da equipe
    expect(within(linha).getAllByText("Instalação de Urna")).toHaveLength(2);
    expect(within(linha).getByText("Equipe Alfa")).toBeInTheDocument();
    expect(within(linha).getByText("Pendente")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/*  BUG: duração não recalculada ao editar Início/Fim                  */
/* ------------------------------------------------------------------ */

describe("CronogramaView — edição de horários (bug da duração nos relatórios)", () => {
  it("envia duracao_minutos recalculada ao alterar Início/Fim", async () => {
    renderView();
    await expandirDia();
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));

    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "09:00" } });
    fireEvent.change(screen.getByLabelText("Fim"), { target: { value: "12:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mockAtualizar).toHaveBeenCalledTimes(1));
    const [id, payload] = mockAtualizar.mock.calls[0];
    expect(id).toBe("atv-1");
    expect(payload).toMatchObject({
      inicio_planejado: "09:00:00",
      fim_planejado: "12:30:00",
      duracao_minutos: 210,
    });
  });

  it("envia duracao_minutos mesmo quando os horários ficam vazios (zera o valor antigo)", async () => {
    renderView();
    await expandirDia();
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));

    fireEvent.change(campo("Início"), { target: { value: "" } });
    fireEvent.change(campo("Fim"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mockAtualizar).toHaveBeenCalled());
    const [, payload] = mockAtualizar.mock.calls[0];
    expect(payload).toMatchObject({
      inicio_planejado: null,
      fim_planejado: null,
      duracao_minutos: null,
    });
  });

  it("atualiza a linha com a nova equipe e o novo local trocados", async () => {
    mockAtualizar.mockResolvedValue({
      error: null,
      data: {
        ...(ATIVIDADE as unknown as Tables<"atividades">),
        equipe_id: "eq-b",
        local_id: "loc-b",
      },
    });

    renderView();
    await expandirDia();
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));

    fireEvent.change(campo("Equipe"), { target: { value: "eq-b" } });
    fireEvent.change(campo("Local de Votação"), { target: { value: "loc-b" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.getByRole("row", { name: /Escola B/ })).toBeInTheDocument()
    );
    // A equipe antiga não pode continuar exibida na atualização otimista
    expect(screen.queryByRole("row", { name: /Escola A/ })).toBeNull();
  });

  it("mantém a equipe antiga quando o servidor devolve a mesma equipe_id", async () => {
    mockAtualizar.mockResolvedValue({
      error: null,
      data: { ...(ATIVIDADE as unknown as Tables<"atividades">), fim_planejado: "11:00:00" },
    });

    renderView();
    await expandirDia();
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));
    fireEvent.change(campo("Fim"), { target: { value: "11:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(screen.getByText("Equipe Alfa")).toBeInTheDocument());
  });

  it("envia o texto do campo Observações", async () => {
    renderView();
    await expandirDia();
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));

    fireEvent.change(screen.getByLabelText("Observações (opcional)"), {
      target: { value: "Equipe atrasou 20 min" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mockAtualizar).toHaveBeenCalled());
    expect(mockAtualizar.mock.calls[0][1]).toMatchObject({
      observacoes: "Equipe atrasou 20 min",
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Validação do formulário                                           */
/* ------------------------------------------------------------------ */

describe("CronogramaView — validação do formulário", () => {
  it("bloqueia o envio sem local selecionado", async () => {
    renderView();
    await expandirDia();
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));

    fireEvent.change(campo("Local de Votação"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Selecione o local de votação.")).toBeInTheDocument();
    expect(mockAtualizar).not.toHaveBeenCalled();
  });

  it("bloqueia o envio sem equipe selecionada", async () => {
    renderView();
    await expandirDia();
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));

    fireEvent.change(campo("Equipe"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Selecione a equipe.")).toBeInTheDocument();
    expect(mockAtualizar).not.toHaveBeenCalled();
  });

  it("exige o horário de fim quando há horário de início", async () => {
    renderView();
    await expandirDia();
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));

    fireEvent.change(campo("Fim"), { target: { value: "" } });
    // O próprio formulário já barra antes de chamar o servidor
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText("Informe o horário de fim para calcular a duração.")
    ).toBeInTheDocument();
    expect(mockAtualizar).not.toHaveBeenCalled();
  });

  it("exibe a duração calculada ao vivo enquanto o form está aberto", async () => {
    renderView();
    await expandirDia();
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));

    fireEvent.change(campo("Início"), { target: { value: "09:00" } });
    fireEvent.change(campo("Fim"), { target: { value: "12:30" } });

    expect(screen.getByText("3h 30min")).toBeInTheDocument();
  });

  it("exibe o erro devolvido pelo servidor", async () => {
    mockAtualizar.mockResolvedValue({ error: "violation: data_hora_planejada", data: null });
    renderView();
    await expandirDia();
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText("violation: data_hora_planejada")
    ).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/*  Criação de atividade                                              */
/* ------------------------------------------------------------------ */

describe("CronogramaView — criação de atividade", () => {
  it("cria com o payload derivado dos campos preenchidos", async () => {
    const criada = {
      ...(ATIVIDADE as unknown as Tables<"atividades">),
      id: "nova",
    };
    mockCriar.mockResolvedValue({ error: null, data: criada });

    renderView([]);
    fireEvent.click(screen.getByRole("button", { name: /Nova Atividade/i }));

    fireEvent.change(campo("Local de Votação"), { target: { value: "loc-a" } });
    fireEvent.change(campo("Equipe"), { target: { value: "eq-a" } });
    fireEvent.change(campo("Data"), { target: { value: "2026-10-05" } });
    fireEvent.change(campo("Sequência"), { target: { value: "3" } });
    fireEvent.change(campo("Início"), { target: { value: "14:00" } });
    fireEvent.change(campo("Fim"), { target: { value: "16:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));

    await waitFor(() => expect(mockCriar).toHaveBeenCalledTimes(1));
    expect(mockCriar.mock.calls[0][0]).toMatchObject({
      local_id: "loc-a",
      equipe_id: "eq-a",
      data_hora_planejada: expect.stringContaining("2026-10-05"),
      sequencia: 3,
      inicio_planejado: "14:00:00",
      fim_planejado: "16:00:00",
      duracao_minutos: 120,
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Ações de execução e exclusão                                       */
/* ------------------------------------------------------------------ */

describe("CronogramaView — ações de execução", () => {
  it("marca a atividade como em andamento", async () => {
    const { container } = renderView();
    await expandirDia();
    fireEvent.click(screen.getByRole("button", { name: /Iniciar/ }));

    await waitFor(() => expect(mockIniciar).toHaveBeenCalledWith("atv-1"));
    await waitFor(() =>
      expect(within(container.querySelector("tbody tr")!).getByText("Em andamento"))
        .toBeInTheDocument()
    );
  });

  it("desfaz a atualização otimista quando o servidor falha ao iniciar", async () => {
    mockIniciar.mockResolvedValue({ error: "sem permissão", data: null });
    const { container } = renderView();
    await expandirDia();
    fireEvent.click(screen.getByRole("button", { name: /Iniciar/ }));

    expect(await screen.findByText(/Erro ao iniciar: sem permissão/)).toBeInTheDocument();
    await waitFor(() =>
      expect(within(container.querySelector("tbody tr")!).getByText("Pendente"))
        .toBeInTheDocument()
    );
  });

  it("conclui a atividade", async () => {
    const { container } = renderView();
    await expandirDia();
    fireEvent.click(screen.getByRole("button", { name: /Concluir/ }));

    await waitFor(() => expect(mockConcluir).toHaveBeenCalledWith("atv-1", undefined));
    await waitFor(() =>
      expect(within(container.querySelector("tbody tr")!).getByText("Concluído"))
        .toBeInTheDocument()
    );
  });

  it("salva as observações pelo modal", async () => {
    const comObs = { ...ATIVIDADE, observacoes: "urnas conferidas" };
    mockObs.mockResolvedValue({ error: null, data: null });
    renderView([comObs]);
    await expandirDia();

    fireEvent.click(screen.getByRole("button", { name: "Ver/editar observações" }));
    const textarea = await screen.findByPlaceholderText(/Adicione observações/);
    fireEvent.change(textarea, { target: { value: "urnas conferidas e lacradas" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(mockObs).toHaveBeenCalledWith("atv-1", "urnas conferidas e lacradas")
    );
  });

});

/* ------------------------------------------------------------------ */
/*  Exclusão                                                           */
/* ------------------------------------------------------------------ */

describe("CronogramaView — exclusão", () => {
  it("remove a atividade da lista após confirmar", async () => {
    const { container } = renderView();
    await expandirDia();

    // A linha tem 4 botões: Iniciar, Concluir, Editar e Excluir (ícone).
    const linha = container.querySelector<HTMLElement>("tbody tr")!;
    const botoes = within(linha).getAllByRole("button");
    fireEvent.click(botoes[botoes.length - 1]);

    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(mockExcluir).toHaveBeenCalledWith("atv-1"));
    expect(await screen.findByText("Nenhuma atividade cadastrada.")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/*  Filtros                                                           */
/* ------------------------------------------------------------------ */

describe("CronogramaView — filtros", () => {
  it("filtra por busca textual no nome do local", async () => {
    renderView([
      ATIVIDADE,
      { ...ATIVIDADE, id: "atv-2", local_id: "loc-b", local: LOCAL_B, equipe_id: "eq-b", equipe: EQUIPE_B },
    ]);

    fireEvent.change(screen.getByLabelText("Buscar atividade"), {
      target: { value: "Escola B" },
    });

    expect(await screen.findByText(/1 atividade$/)).toBeInTheDocument();
    await expandirDia();
    expect(screen.getByRole("row", { name: /Escola B/ })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /Escola A/ })).toBeNull();
  });

  it("filtra por status concluído", async () => {
    renderView([
      ATIVIDADE,
      { ...ATIVIDADE, id: "atv-2", status: "concluido" },
    ]);

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "concluido" } });

    await expandirDia();
    expect(screen.getByRole("row", { name: /Escola A/ })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /Pendente/ })).toBeNull();
  });

  it("limpa os filtros e volta a listar tudo", async () => {
    renderView([
      ATIVIDADE,
      { ...ATIVIDADE, id: "atv-2", local_id: "loc-b", local: LOCAL_B },
    ]);

    fireEvent.change(screen.getByLabelText("Buscar atividade"), {
      target: { value: "Escola B" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Limpar$/ }));

    expect(await screen.findByText(/2 atividades$/)).toBeInTheDocument();
  });
});
