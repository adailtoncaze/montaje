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
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import {
  criarLocal,
  atualizarLocal,
  excluirLocal,
  importarLocais,
} from "@/lib/actions/locais";

type Local = Tables<"locais_votacao">;

interface LocaisClientProps {
  locais: Local[];
  isAdmin: boolean;
}

/* ------------------------------------------------------------------ */
/*  String utils                                                       */
/* ------------------------------------------------------------------ */

function norm(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/* ------------------------------------------------------------------ */
/*  Componente                                                         */
/* ------------------------------------------------------------------ */

export function LocaisClient({ locais, isAdmin }: LocaisClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Estado de busca
  const [busca, setBusca] = useState("");

  // Estado do formulário
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Local | null>(null);
  const [form, setForm] = useState({
    nome: "",
    municipio: "",
    qtd_secoes: "",
    endereco: "",
    lat_origem: "",
  });
  const [formError, setFormError] = useState("");

  // Estado de exclusão
  const [excluindo, setExcluindo] = useState<Local | null>(null);

  // Estado da importação CSV
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<CsvRow[]>([]);
  const [importFile, setImportFile] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  const locaisFiltrados = locais.filter((l) => {
    if (!busca) return true;
    const b = busca.toLowerCase();
    return (
      l.nome.toLowerCase().includes(b) || l.municipio.toLowerCase().includes(b)
    );
  });

  /* ---------------- Formulário ---------------- */

  const abrirFormNovo = () => {
    setEditando(null);
    setForm({ nome: "", municipio: "", qtd_secoes: "", endereco: "", lat_origem: "" });
    setFormError("");
    setFormOpen(true);
  };

  const abrirFormEditar = (local: Local) => {
    setEditando(local);
    setForm({
      nome: local.nome,
      municipio: local.municipio,
      qtd_secoes: String(local.qtd_secoes),
      endereco: local.endereco ?? "",
      lat_origem: local.lat_origem ?? "",
    });
    setFormError("");
    setFormOpen(true);
  };

  const salvar = async () => {
    if (!form.nome.trim() || !form.municipio.trim()) {
      setFormError("Nome e município são obrigatórios.");
      return;
    }
    const qtd = parseInt(form.qtd_secoes, 10);
    if (isNaN(qtd) || qtd < 0) {
      setFormError("Quantidade de seções deve ser um número ≥ 0.");
      return;
    }

    try {
      if (editando) {
        await atualizarLocal(editando.id, {
          nome: form.nome.trim(),
          municipio: form.municipio.trim(),
          qtd_secoes: qtd,
          endereco: form.endereco.trim() || null,
          lat_origem: form.lat_origem.trim() || null,
        });
        toast("success", "Local atualizado com sucesso.");
      } else {
        await criarLocal({
          nome: form.nome.trim(),
          municipio: form.municipio.trim(),
          qtd_secoes: qtd,
          endereco: form.endereco.trim() || null,
          lat_origem: form.lat_origem.trim() || null,
        });
        toast("success", "Local criado com sucesso.");
      }
      setFormOpen(false);
      refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar.";
      if (msg.includes("duplicate") || msg.includes("unique")) {
        setFormError("Já existe um local com esse nome neste município.");
      } else {
        setFormError(msg);
      }
    }
  };

  const excluir = async () => {
    if (!excluindo) return;
    try {
      await excluirLocal(excluindo.id);
      toast("success", "Local excluído com sucesso.");
      setExcluindo(null);
      refresh();
    } catch {
      toast("error", "Erro ao excluir local.");
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
      locais.map((l) => `${norm(l.nome)}|${norm(l.municipio)}`),
    );
    const vistos = new Set<string>();

    return rows.map((row, index) => {
      const nome = getColumn(row, ["nome", "nome do local", "local"]);
      const municipio = getColumn(row, ["municipio"]);
      const qtdRaw = getColumn(row, [
        "qtd_secoes",
        "qtd secoes",
        "quantidade de secoes",
        "quantidade de seções",
        "secoes",
        "seções",
      ]);
      const endereco = getColumn(row, ["endereco", "endereço", "endereco do local"]);

      const key = `${norm(nome)}|${norm(municipio)}`;
      const duplicado =
        (nome && municipio && existentes.has(key)) || vistos.has(key);
      if (!duplicado && nome && municipio) vistos.add(key);

      if (!nome || !municipio) {
        return { row, index, erro: "Nome e município são obrigatórios." };
      }
      const qtd = parseInt(qtdRaw, 10);
      if (qtdRaw === "" || isNaN(qtd) || qtd < 0) {
        return {
          row,
          index,
          erro: `Quantidade de seções inválida: "${qtdRaw || ""}".`,
        };
      }
      if (duplicado) {
        return {
          row,
          index,
          erro: "Duplicado (nome + município já cadastrados).",
        };
      }
      return { row, index };
    });
  };

  const linhasValidadas = useCallback(
    () => validarLinhas(importRows),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [importRows, locais],
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
    const totalErros = linhas.length - validas.length;
    const duplicados = linhas.filter((l) => l.erro?.startsWith("Duplicado")).length;

    if (validas.length === 0) {
      toast("warning", "Nenhum registro válido para importar.");
      return;
    }

    setImporting(true);
    try {
      await importarLocais(
        validas.map((l) => {
          const nome = getColumn(l.row, ["nome", "nome do local", "local"]);
          const municipio = getColumn(l.row, ["municipio"]);
          const qtdRaw = getColumn(l.row, [
            "qtd_secoes",
            "qtd secoes",
            "quantidade de secoes",
            "secoes",
            "seções",
          ]);
          const endereco = getColumn(l.row, [
            "endereco",
            "endereço",
            "endereco do local",
          ]);
          return {
            nome,
            municipio,
            qtd_secoes: parseInt(qtdRaw, 10),
            endereco: endereco || null,
          };
        }),
      );
      toast(
        "success",
        `Importação concluída: ${validas.length} criado(s), ${duplicados} ignorado(s), ${totalErros - duplicados} com erro.`,
      );
      setImportOpen(false);
      setImportRows([]);
      setImportFile(null);
      refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao importar.";
      toast("error", `Erro na importação: ${msg}`);
    } finally {
      setImporting(false);
    }
  };

  /* ---------------- Tabela ---------------- */

  const colunas: Column<Local>[] = [
    { key: "nome", header: "Nome" },
    { key: "municipio", header: "Município" },
    {
      key: "qtd_secoes",
      header: "Seções",
      className: "text-center",
      render: (row) => (
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-brand-tint text-caption font-semibold text-brand-fg">
          {row.qtd_secoes}
        </span>
      ),
    },
    { key: "endereco", header: "Endereço", render: (row) => row.endereco ?? "—" },
    ...(isAdmin
      ? ([
          {
            key: "acoes",
            header: "",
            className: "w-20",
            render: (row: Local) => (
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
        ] as Column<Local>[])
      : []),
  ];

  return (
    <>
      {/* Barra de ações */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-4" />
          <input
            type="text"
            placeholder="Buscar por nome ou município…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-8 w-full rounded-md border border-stroke-strong bg-surface pl-8 pr-3 text-body text-fg placeholder:text-fg-4 focus-visible:border-brand focus-visible:outline-none"
          />
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" />
              Importar CSV
            </Button>
            <Button variant="primary" onClick={abrirFormNovo}>
              <Plus className="size-4" />
              Novo Local
            </Button>
          </div>
        )}
      </div>

      {/* Tabela */}
      <DataTable
        columns={colunas}
        data={locaisFiltrados}
        keyExtractor={(row) => row.id}
        emptyMessage="Nenhum local de votação cadastrado."
        onRowClick={isAdmin ? abrirFormEditar : undefined}
      />

      {/* Dialog de formulário */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editando ? "Editar Local" : "Novo Local"}
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
            label="Nome do local"
            placeholder="Ex: Escola Municipal João Paulo"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            required
          />
          <Input
            label="Município"
            placeholder="Ex: São Paulo"
            value={form.municipio}
            onChange={(e) => setForm({ ...form, municipio: e.target.value })}
            required
          />
          <Input
            label="Quantidade de seções"
            type="number"
            min={0}
            placeholder="0"
            value={form.qtd_secoes}
            onChange={(e) => setForm({ ...form, qtd_secoes: e.target.value })}
            required
          />
          <Input
            label="Endereço"
            placeholder="Opcional"
            value={form.endereco}
            onChange={(e) => setForm({ ...form, endereco: e.target.value })}
          />
          <Input
            label="LAT de origem"
            placeholder="Opcional"
            helperText="Localização de origem do local (texto livre)."
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

      {/* Dialog de importação CSV */}
      <Dialog
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          setImportRows([]);
          setImportFile(null);
        }}
        title="Importar Locais via CSV"
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
                Colunas: nome, município, qtd_secoes, endereco (opcional)
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
              <span>
                {importRows.length} linha(s) lida(s)
              </span>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border border-stroke">
              <table className="w-full text-left text-caption">
                <thead className="sticky top-0 bg-surface-subtle">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-fg-2">#</th>
                    <th className="px-3 py-2 font-semibold text-fg-2">Nome</th>
                    <th className="px-3 py-2 font-semibold text-fg-2">Município</th>
                    <th className="px-3 py-2 font-semibold text-fg-2">Seções</th>
                    <th className="px-3 py-2 font-semibold text-fg-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasValidadas().map((l) => (
                    <tr key={l.index} className="border-t border-stroke-subtle">
                      <td className="px-3 py-1.5 text-fg-4">{l.index + 1}</td>
                      <td className="px-3 py-1.5 text-fg">
                        {getColumn(l.row, ["nome", "nome do local", "local"])}
                      </td>
                      <td className="px-3 py-1.5 text-fg">
                        {getColumn(l.row, ["municipio"])}
                      </td>
                      <td className="px-3 py-1.5 text-fg">
                        {getColumn(l.row, [
                          "qtd_secoes",
                          "qtd secoes",
                          "quantidade de secoes",
                          "secoes",
                          "seções",
                        ])}
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

            {/* Resumo */}
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
        title="Excluir local"
        message={`Tem certeza que deseja excluir "${excluindo?.nome}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
      />
    </>
  );
}