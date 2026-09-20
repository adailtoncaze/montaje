"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type { Tables } from "@/types/supabase";
import {
  TIPO_ATIVIDADE_LABEL,
  PAPEL_EQUIPE_LABEL,
  rotuloTipoEquipe,
  normalizarTipoEquipe,
} from "@/lib/constants";
import {
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserMinus,
  UserPlus,
  Star,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  criarEquipe,
  atualizarEquipe,
  excluirEquipe,
  listarMembros,
  adicionarMembro,
  removerMembro,
  definirResponsavel,
  type MembroComNome,
} from "@/lib/actions/equipes";
type Equipe = Tables<"equipes">;
type Colaborador = Tables<"colaboradores">;

interface EquipesClientProps {
  equipes: Equipe[];
  colaboradores: Colaborador[];
  isAdmin: boolean;
}

export function EquipesClient({
  equipes,
  colaboradores,
  isAdmin,
}: EquipesClientProps) {
  const { toast } = useToast();

  // Cópia local da lista: atualiza sem recarregar a página (sem router.refresh)
  const [listaEquipes, setListaEquipes] = useState<Equipe[]>(equipes);

  useEffect(() => {
    setListaEquipes(equipes);
  }, [equipes]);

  const [busca, setBusca] = useState("");

  // Form criar/editar equipe
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Equipe | null>(null);
  const [form, setForm] = useState({
    nome: "",
    tipo: "instalacao" as "instalacao" | "verificacao" | "recolhimento_midia" | "recolhimento_urna",
    lat_origem: "",
  });
  const [formError, setFormError] = useState("");

  // Exclusão
  const [excluindo, setExcluindo] = useState<Equipe | null>(null);

  // Detalhe da equipe (membros)
  const [detalheEquipe, setDetalheEquipe] = useState<Equipe | null>(null);
  const [membros, setMembros] = useState<MembroComNome[]>([]);
  const [membrosLoading, setMembrosLoading] = useState(false);
  const [addMembroOpen, setAddMembroOpen] = useState(false);
  const [colaboradorParaAdicionar, setColaboradorParaAdicionar] = useState("");

  const carregarMembros = useCallback(async (equipeId: string) => {
    setMembrosLoading(true);
    try {
      const data = await listarMembros(equipeId);
      setMembros(data);
    } catch {
      toast("error", "Erro ao carregar membros.");
    } finally {
      setMembrosLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (detalheEquipe) {
      carregarMembros(detalheEquipe.id);
    }
  }, [detalheEquipe, carregarMembros]);

  const equipesFiltradas = listaEquipes.filter((e) => {
    if (!busca) return true;
    return e.nome.toLowerCase().includes(busca.toLowerCase());
  });

  // ---- CRUD Equipe ----

  const abrirFormNovo = () => {
    setEditando(null);
    setForm({ nome: "", tipo: "instalacao", lat_origem: "" });
    setFormError("");
    setFormOpen(true);
  };

  const abrirFormEditar = (equipe: Equipe) => {
    setEditando(equipe);
    setForm({
      nome: equipe.nome,
      tipo: equipe.tipo,
      lat_origem: equipe.lat_origem ?? "",
    });
    setFormError("");
    setFormOpen(true);
  };

  const salvar = async () => {
    if (!form.nome.trim()) {
      setFormError("Nome da equipe é obrigatório.");
      return;
    }

    try {
      if (editando) {
        const data = await atualizarEquipe(editando.id, {
          nome: form.nome.trim(),
          tipo: form.tipo,
          lat_origem: form.lat_origem.trim() || null,
        });
        // Atualiza na lista local: a edição aparece sem sair da tela
        setListaEquipes((prev) =>
          prev.map((e) => (e.id === editando.id ? data : e))
        );
        toast("success", "Equipe atualizada com sucesso.");
      } else {
        const data = await criarEquipe({
          nome: form.nome.trim(),
          tipo: form.tipo,
          lat_origem: form.lat_origem.trim() || null,
        });
        // Adiciona na lista local: a nova equipe aparece sem sair da tela
        setListaEquipes((prev) => [...prev, data]);
        toast("success", "Equipe criada com sucesso.");
      }
      setFormOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar.";
      setFormError(msg);
    }
  };

  const excluir = async () => {
    if (!excluindo) return;
    try {
      await excluirEquipe(excluindo.id);
      // Remove da lista local: some da tabela sem recarregar a página
      setListaEquipes((prev) => prev.filter((e) => e.id !== excluindo.id));
      toast("success", "Equipe excluída com sucesso.");
      setExcluindo(null);
      if (detalheEquipe?.id === excluindo.id) {
        setDetalheEquipe(null);
      }
    } catch {
      toast("error", "Erro ao excluir equipe.");
    }
  };

  // ---- Membros ----

  const handleAdicionarMembro = async () => {
    if (!detalheEquipe || !colaboradorParaAdicionar) return;
    try {
      await adicionarMembro(detalheEquipe.id, colaboradorParaAdicionar);
      toast("success", "Membro adicionado.");
      setAddMembroOpen(false);
      setColaboradorParaAdicionar("");
      carregarMembros(detalheEquipe.id);
    } catch {
      toast("error", "Erro ao adicionar membro. Pode já estar na equipe.");
    }
  };

  const handleRemoverMembro = async (colaboradorId: string) => {
    if (!detalheEquipe) return;
    try {
      await removerMembro(detalheEquipe.id, colaboradorId);
      toast("success", "Membro removido.");
      carregarMembros(detalheEquipe.id);
    } catch {
      toast("error", "Erro ao remover membro.");
    }
  };

  const handleDefinirResponsavel = async (colaboradorId: string) => {
    if (!detalheEquipe) return;
    try {
      await definirResponsavel(detalheEquipe.id, colaboradorId);
      toast("success", "Responsável definido.");
      carregarMembros(detalheEquipe.id);
    } catch {
      toast("error", "Erro ao definir responsável.");
    }
  };

  // Colaboradores que ainda não estão na equipe
  const idsMembros = new Set(membros.map((m) => m.colaborador_id));
  const colaboradoresDisponiveis = colaboradores.filter(
    (c) => !idsMembros.has(c.id),
  );

  const colunasEquipes: Column<Equipe>[] = [
    { key: "nome", header: "Nome" },
    {
      key: "tipo",
      header: "Tipo",
      render: (row) => (
        <Badge tone={normalizarTipoEquipe(row.tipo) === "instalacao" || normalizarTipoEquipe(row.tipo) === "verificacao" ? "brand" : "success"}>
          {rotuloTipoEquipe(row.tipo)}
        </Badge>
      ),
    },
    {
      key: "lat_origem",
      header: "LAT de origem",
      render: (row) => (
        <span className="text-fg-3">{row.lat_origem ?? "—"}</span>
      ),
    },
    {
      key: "acoes",
      header: "",
      className: "w-24",
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDetalheEquipe(row);
            }}
            className="rounded p-1 text-fg-3 transition-colors hover:bg-surface-subtle hover:text-fg"
            aria-label="Ver membros"
          >
            <Users className="size-4" />
          </button>
          {isAdmin && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  abrirFormEditar(row);
                }}
                className="rounded p-1 text-fg-3 transition-colors hover:bg-surface-subtle hover:text-fg"
                aria-label="Editar"
              >
                <Pencil className="size-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExcluindo(row);
                }}
                className="rounded p-1 text-fg-3 transition-colors hover:bg-danger-bg hover:text-danger-fg"
                aria-label="Excluir"
              >
                <Trash2 className="size-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      {/* Barra de ações */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-4" />
          <input
            type="text"
            placeholder="Buscar equipe…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-8 w-full rounded-md border border-stroke-strong bg-surface pl-8 pr-3 text-body text-fg placeholder:text-fg-4 focus-visible:border-brand focus-visible:outline-none"
          />
        </div>
        {isAdmin && (
          <Button variant="primary" onClick={abrirFormNovo}>
            <Plus className="size-4" />
            Nova Equipe
          </Button>
        )}
      </div>

      {/* Tabela de equipes */}
      <DataTable
        columns={colunasEquipes}
        data={equipesFiltradas}
        keyExtractor={(row) => row.id}
        emptyMessage="Nenhuma equipe cadastrada."
        onRowClick={(row) => setDetalheEquipe(row)}
      />

      {/* Dialog criar/editar equipe */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editando ? "Editar Equipe" : "Nova Equipe"}
        actions={
          <>
            <Button variant="subtle" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={salvar}>
              {editando ? "Salvar" : "Criar"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nome da equipe"
            placeholder="Ex: Equipe Alpha"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            required
          />
          <Select
            label="Tipo"
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value as "instalacao" | "verificacao" | "recolhimento_midia" | "recolhimento_urna" })}
            options={[
              { value: "instalacao", label: TIPO_ATIVIDADE_LABEL.instalacao },
              { value: "verificacao", label: TIPO_ATIVIDADE_LABEL.verificacao },
              { value: "recolhimento_midia", label: TIPO_ATIVIDADE_LABEL.recolhimento_midia },
              { value: "recolhimento_urna", label: TIPO_ATIVIDADE_LABEL.recolhimento_urna },
            ]}
            required
          />
          <Input
            label="LAT de origem"
            placeholder="Opcional"
            helperText="Localização de origem da equipe (texto livre)."
            value={form.lat_origem}
            onChange={(e) => setForm({ ...form, lat_origem: e.target.value })}
          />
          {formError && (
            <p className="text-caption text-danger-fg" role="alert">
              {formError}
            </p>
          )}
        </div>
      </Dialog>

      {/* Dialog exclusão */}
      <ConfirmDialog
        open={!!excluindo}
        onClose={() => setExcluindo(null)}
        onConfirm={excluir}
        title="Excluir equipe"
        message={`Tem certeza que deseja excluir a equipe "${excluindo?.nome}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
      />

      {/* Dialog detalhe da equipe (membros) */}
      <Dialog
        open={!!detalheEquipe}
        onClose={() => setDetalheEquipe(null)}
        title={`Equipe: ${detalheEquipe?.nome ?? ""}`}
        maxWidth="max-w-xl"
        actions={
          isAdmin && (
            <Button
              variant="primary"
              onClick={() => setAddMembroOpen(true)}
              disabled={colaboradoresDisponiveis.length === 0}
            >
              <UserPlus className="size-4" />
              Adicionar Membro
            </Button>
          )
        }
      >
        {detalheEquipe && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge
                tone={
                  normalizarTipoEquipe(detalheEquipe.tipo) === "instalacao" ||
                  normalizarTipoEquipe(detalheEquipe.tipo) === "verificacao"
                    ? "brand"
                    : "success"
                }
              >
                {rotuloTipoEquipe(detalheEquipe.tipo)}
              </Badge>
            </div>

            {membrosLoading ? (
              <div className="py-4 text-center text-caption text-fg-4">
                Carregando membros…
              </div>
            ) : membros.length === 0 ? (
              <p className="py-4 text-center text-body text-fg-3">
                Nenhum membro nesta equipe.
              </p>
            ) : (
              <div className="space-y-1">
                {membros.map((m) => (
                  <div
                    key={m.colaborador_id}
                    className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-surface-subtle"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-body font-medium text-fg">
                          {m.colaborador_nome}
                        </span>
                        <Badge
                          tone={m.papel === "responsavel" ? "warning" : "neutral"}
                        >
                          {PAPEL_EQUIPE_LABEL[m.papel]}
                        </Badge>
                      </div>
                      <span className="text-caption text-fg-4">
                        {m.colaborador_funcao}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {isAdmin && m.papel !== "responsavel" && (
                        <button
                          onClick={() =>
                            handleDefinirResponsavel(m.colaborador_id)
                          }
                          className="rounded p-1 text-fg-3 transition-colors hover:bg-warning-bg hover:text-warning-fg"
                          aria-label="Definir como responsável"
                          title="Definir como responsável"
                        >
                          <Star className="size-4" />
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleRemoverMembro(m.colaborador_id)}
                          className="rounded p-1 text-fg-3 transition-colors hover:bg-danger-bg hover:text-danger-fg"
                          aria-label="Remover da equipe"
                        >
                          <UserMinus className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* Dialog adicionar membro */}
      <Dialog
        open={addMembroOpen}
        onClose={() => setAddMembroOpen(false)}
        title="Adicionar membro"
        actions={
          <>
            <Button variant="subtle" onClick={() => setAddMembroOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleAdicionarMembro}
              disabled={!colaboradorParaAdicionar}
            >
              Adicionar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Colaborador"
            value={colaboradorParaAdicionar}
            onChange={(e) => setColaboradorParaAdicionar(e.target.value)}
            placeholder="Selecione um colaborador"
            options={colaboradoresDisponiveis.map((c) => ({
              value: c.id,
              label: `${c.nome} — ${c.funcao}`,
            }))}
          />
        </div>
      </Dialog>
    </>
  );
}
