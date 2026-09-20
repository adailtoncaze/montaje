"use client";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Dialog } from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { Tables } from "@/types/supabase";
import { getColumn, parseCSV, type CsvRow } from "@/lib/csv";
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  criarColaborador,
  atualizarColaborador,
  excluirColaborador,
  importarColaboradores,
} from "@/lib/actions/colaboradores";

type Colaborador = Tables<"colaboradores">;

interface ColaboradoresClientProps {
  colaboradores: Colaborador[];
  funcoes: string[];
  isAdmin: boolean;
}

function norm(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function ColaboradoresClient({
  colaboradores,
  funcoes,
  isAdmin,
}: ColaboradoresClientProps) {
  const { toast } = useToast();

  // Cópia local da lista: atualiza sem recarregar a página (sem router.refresh)
  const [listaColaboradores, setListaColaboradores] = useState<Colaborador[]>(
    colaboradores,
  );
  const [listaFuncoes, setListaFuncoes] = useState<string[]>(funcoes);

  useEffect(() => {
    setListaColaboradores(colaboradores);
  }, [colaboradores]);

  useEffect(() => {
    setListaFuncoes(funcoes);
  }, [funcoes]);

  const [busca, setBusca] = useState("");
  const [filtroFuncao, setFiltroFuncao] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Colaborador | null>(null);
  const [form, setForm] = useState({
    nome: "",
    funcao: "",
    telefone: "",
  });
  const [formError, setFormError] = useState("");

  const [excluindo, setExcluindo] = useState<Colaborador | null>(null);

  // Importação CSV
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<CsvRow[]>([]);
  const [importFile, setImportFile] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const colaboradoresFiltrados = listaColaboradores.filter((c) => {
    const b = busca.toLowerCase();
    const matchBusca =
      !busca ||
      c.nome.toLowerCase().includes(b) ||
      c.funcao.toLowerCase().includes(b);
    const matchFuncao = !filtroFuncao || c.funcao === filtroFuncao;
    return matchBusca && matchFuncao;
  });

  /* ---------------- Formulário ---------------- */

  const abrirFormNovo = () => {
    setEditando(null);
    setForm({ nome: "", funcao: "", telefone: "" });
    setFormError("");
    setFormOpen(true);
  };

  const abrirFormEditar = (col: Colaborador) => {
    setEditando(col);
    setForm({
      nome: col.nome,
      funcao: col.funcao,
      telefone: col.telefone ?? "",
    });
    setFormError("");
    setFormOpen(true);
  };

  const salvar = async () => {
    if (!form.nome.trim() || !form.funcao.trim()) {
      setFormError("Nome e função são obrigatórios.");
      return;
    }

    try {
      // Garante que funções novas apareçam no filtro sem recarregar a página
      const adicionarFuncoes = (fns: string[]) => {
        setListaFuncoes((prev) => {
          const novas = fns.filter((f) => !prev.includes(f));
          return novas.length ? [...prev, ...novas] : prev;
        });
      };

      if (editando) {
        const data = await atualizarColaborador(editando.id, {
          nome: form.nome.trim(),
          funcao: form.funcao.trim(),
          telefone: form.telefone.trim() || null,
        });
        adicionarFuncoes([data.funcao]);
        // Atualiza na lista local: a edição aparece sem sair da tela
        setListaColaboradores((prev) =>
          prev.map((c) => (c.id === editando.id ? data : c))
        );
        toast("success", "Colaborador atualizado com sucesso.");
      } else {
        const data = await criarColaborador({
          nome: form.nome.trim(),
          funcao: form.funcao.trim(),
          telefone: form.telefone.trim() || null,
        });
        adicionarFuncoes([data.funcao]);
        // Adiciona na lista local: o novo colaborador aparece sem sair da tela
        setListaColaboradores((prev) => [...prev, data]);
        toast("success", "Colaborador criado com sucesso.");
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
      await excluirColaborador(excluindo.id);
      // Remove da lista local: some da tabela sem recarregar a página
      setListaColaboradores((prev) =>
        prev.filter((c) => c.id !== excluindo.id)
      );
      toast("success", "Colaborador excluído com sucesso.");
      setExcluindo(null);
    } catch {
      toast("error", "Erro ao excluir colaborador.");
    }
  };

  /* ---------------- Importação CSV ---------------- */

  interface LinhaValidada {
    row: CsvRow;
    index: number;
    erro?: string;
  }

  const validarLinhas = (rows: CsvRow[]): LinhaValidada[] => {
    const existentes = new Set(
      listaColaboradores.map((c) => `${norm(c.nome)}|${norm(c.funcao)}`),
    );
    const vistos = new Set<string>();

    return rows.map((row, index) => {
      const nome = getColumn(row, ["nome", "nome do colaborador", "colaborador"]);
      const funcao = getColumn(row, ["funcao", "função", "cargo"]);
      const telefone = getColumn(row, ["telefone", "tel", "contato"]);

      const key = `${norm(nome)}|${norm(funcao)}`;
      const duplicado =
        (nome && funcao && existentes.has(key)) || vistos.has(key);
      if (!duplicado && nome && funcao) vistos.add(key);

      if (!nome || !funcao) {
        return { row, index, erro: "Nome e função são obrigatórios." };
      }
      if (telefone && telefone.length > 30) {
        return { row, index, erro: "Telefone muito longo." };
      }
      if (duplicado) {
        return { row, index, erro: "Duplicado (nome + função já cadastrados)." };
      }
      return { row, index };
    });
  };

  const linhasValidadas = useCallback(
    () => validarLinhas(importRows),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [importRows, listaColaboradores],
  );

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast("error", "Formato inválido. Envie um arquivo .csv.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? "");
      const rows = parseCSV(text);
      if (rows.length === 0) {
        toast("error", "Arquivo vazio ou sem linhas de dados.");
        return;
      }
      setImportRows(rows);
      setImportFile(file.name);
    };
    reader.readAsText(file);
  };

  const confirmarImportacao = async () => {
    const linhas = linhasValidadas();
    const validas = linhas.filter((l) => !l.erro);
    const duplicados = linhas.filter((l) => l.erro?.startsWith("Duplicado")).length;

    if (validas.length === 0) {
      toast("warning", "Nenhum registro válido para importar.");
      return;
    }

    setImporting(true);
    try {
      const criados = await importarColaboradores(
        validas.map((l) => ({
          nome: getColumn(l.row, ["nome", "nome do colaborador", "colaborador"]),
          funcao: getColumn(l.row, ["funcao", "função", "cargo"]),
          telefone:
            getColumn(l.row, ["telefone", "tel", "contato"]) || null,
        })),
      );
      // Adiciona os importados na lista local: aparecem sem recarregar a página
      setListaColaboradores((prev) => [...prev, ...criados]);
      setListaFuncoes((prev) => {
        const novas = criados
          .map((c) => c.funcao)
          .filter((f) => !prev.includes(f));
        return novas.length ? [...prev, ...novas] : prev;
      });
      toast(
        "success",
        `Importação concluída: ${validas.length} criado(s), ${duplicados} ignorado(s).`,
      );
      setImportOpen(false);
      setImportRows([]);
      setImportFile(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao importar.";
      toast("error", `Erro na importação: ${msg}`);
    } finally {
      setImporting(false);
    }
  };

  /* ---------------- Tabela ---------------- */

  const funcoesOptions = listaFuncoes.map((f) => ({ value: f, label: f }));

  const colunas: Column<Colaborador>[] = [
    { key: "nome", header: "Nome" },
    {
      key: "funcao",
      header: "Função",
      render: (row) => (
        <span className="inline-flex rounded-full bg-surface-subtle px-2 py-0.5 text-caption font-medium text-fg-2">
          {row.funcao}
        </span>
      ),
    },
    {
      key: "telefone",
      header: "Telefone",
      render: (row) => row.telefone ?? "—",
    },
    ...(isAdmin
      ? ([
          {
            key: "acoes",
            header: "",
            className: "w-20",
            render: (row: Colaborador) => (
              <div className="flex justify-end gap-1">
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
              </div>
            ),
          },
        ] as Column<Colaborador>[])
      : []),
  ];

  return (
    <>
      {/* Barra de ações */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-4" />
            <input
              type="text"
              placeholder="Buscar por nome ou função…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-8 w-full rounded-md border border-stroke-strong bg-surface pl-8 pr-3 text-body text-fg placeholder:text-fg-4 focus-visible:border-brand focus-visible:outline-none"
            />
          </div>
          {funcoesOptions.length > 0 && (
            <select
              value={filtroFuncao}
              onChange={(e) => setFiltroFuncao(e.target.value)}
              className="h-8 rounded-md border border-stroke-strong bg-surface px-2 text-caption text-fg focus-visible:border-brand focus-visible:outline-none"
            >
              <option value="">Todas as funções</option>
              {funcoesOptions.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          )}
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" />
              Importar CSV
            </Button>
            <Button variant="primary" onClick={abrirFormNovo}>
              <Plus className="size-4" />
              Novo Colaborador
            </Button>
          </div>
        )}
      </div>

      {/* Tabela */}
      <DataTable
        columns={colunas}
        data={colaboradoresFiltrados}
        keyExtractor={(row) => row.id}
        emptyMessage="Nenhum colaborador cadastrado."
        onRowClick={isAdmin ? abrirFormEditar : undefined}
      />

      {/* Dialog de formulário */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editando ? "Editar Colaborador" : "Novo Colaborador"}
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
            label="Nome"
            placeholder="Nome completo"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            required
          />
          <Input
            label="Função"
            placeholder="Ex: Montador, Motorista, Responsável"
            value={form.funcao}
            onChange={(e) => setForm({ ...form, funcao: e.target.value })}
            required
          />
          <Input
            label="Telefone"
            placeholder="(11) 99999-9999"
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
          />
          {formError && (
            <p className="text-caption text-danger-fg" role="alert">
              {formError}
            </p>
          )}
        </div>
      </Dialog>

      {/* Dialog de importação CSV */}
      <Dialog
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          setImportRows([]);
          setImportFile(null);
        }}
        title="Importar Colaboradores via CSV"
        maxWidth="max-w-2xl"
        actions={
          <>
            <Button
              variant="subtle"
              onClick={() => {
                setImportOpen(false);
                setImportRows([]);
                setImportFile(null);
              }}
            >
              Cancelar
            </Button>
            {importRows.length > 0 && (
              <Button
                variant="primary"
                onClick={confirmarImportacao}
                disabled={importing}
              >
                <FileUp className="size-4" />
                {importing ? "Importando…" : "Confirmar importação"}
              </Button>
            )}
          </>
        }
      >
        {importRows.length === 0 ? (
          <div className="space-y-4">
            <div
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-stroke-strong bg-surface-dropzone px-6 py-10 text-center transition-colors hover:border-brand hover:bg-brand-tint/40"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files?.[0]);
              }}
            >
              <Upload className="size-8 text-fg-3" aria-hidden />
              <p className="text-body font-medium text-fg-2">
                Arraste o arquivo CSV aqui ou{" "}
                <span className="text-brand-fg underline">clique para selecionar</span>
              </p>
              <p className="text-caption text-fg-4">
                Colunas: nome, funcao, telefone (opcional)
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-caption text-fg-3">
              <span className="font-medium">{importFile}</span>
              <span>{importRows.length} linha(s) lida(s)</span>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border border-stroke">
              <table className="w-full text-left text-caption">
                <thead className="sticky top-0 bg-surface-subtle">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-fg-2">#</th>
                    <th className="px-3 py-2 font-semibold text-fg-2">Nome</th>
                    <th className="px-3 py-2 font-semibold text-fg-2">Função</th>
                    <th className="px-3 py-2 font-semibold text-fg-2">Telefone</th>
                    <th className="px-3 py-2 font-semibold text-fg-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasValidadas().map((l) => (
                    <tr key={l.index} className="border-t border-stroke-subtle">
                      <td className="px-3 py-1.5 text-fg-4">{l.index + 1}</td>
                      <td className="px-3 py-1.5 text-fg">
                        {getColumn(l.row, ["nome", "nome do colaborador", "colaborador"])}
                      </td>
                      <td className="px-3 py-1.5 text-fg">
                        {getColumn(l.row, ["funcao", "função", "cargo"])}
                      </td>
                      <td className="px-3 py-1.5 text-fg">
                        {getColumn(l.row, ["telefone", "tel", "contato"]) || "—"}
                      </td>
                      <td className="px-3 py-1.5">
                        {l.erro ? (
                          <span className="inline-flex items-center gap-1 text-danger-fg">
                            <XCircle className="size-3.5" aria-hidden />
                            {l.erro}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-success-fg">
                            <CheckCircle2 className="size-3.5" aria-hidden />
                            Válido
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(() => {
              const linhas = linhasValidadas();
              const validas = linhas.filter((l) => !l.erro).length;
              const comErro = linhas.filter(
                (l) => l.erro && !l.erro.startsWith("Duplicado"),
              ).length;
              const duplicadas = linhas.length - validas - comErro;
              return (
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-caption font-semibold text-success-fg">
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    {validas} válida(s)
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-caption font-semibold text-warning-fg">
                    <AlertTriangle className="size-3.5" aria-hidden />
                    {duplicadas} duplicada(s)
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-danger-bg px-2 py-0.5 text-caption font-semibold text-danger-fg">
                    <XCircle className="size-3.5" aria-hidden />
                    {comErro} com erro
                  </span>
                </div>
              );
            })()}
          </div>
        )}
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <ConfirmDialog
        open={!!excluindo}
        onClose={() => setExcluindo(null)}
        onConfirm={excluir}
        title="Excluir colaborador"
        message={`Tem certeza que deseja excluir "${excluindo?.nome}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
      />
    </>
  );
}