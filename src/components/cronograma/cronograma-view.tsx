"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Calendar, Filter, ChevronDown, ChevronUp, Plus, Play, CheckCircle, MessageSquare, AlertTriangle, Clock, Trash2, Pencil, X, GripVertical, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, type SelectOption } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FiltrosCronograma, TipoAtividadeBadge, StatusAtividadeBadge } from "./filtros";
import { AtividadeRow } from "./atividade-row";
import type { AtividadeCompleta } from "@/lib/actions/atividades";
import type { FiltrosCronograma as FiltrosCronogramaType } from "./filtros";
import { getStatusEfetivo } from "@/lib/utils/atividades";
import { getLocalDateFromTimestamp, parseLocalDate, hasTimezone } from "@/lib/utils/date";
import { criarAtividade, atualizarAtividade, excluirAtividade, iniciarAtividade, concluirAtividade, atualizarObservacoes } from "@/lib/actions/atividades-mutations";
import { useToast } from "@/components/ui/toast";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { TIPO_ATIVIDADE_LABEL, rotuloTipoEquipe } from "@/lib/constants";
import type { Tables } from "@/types/supabase";

interface CronogramaViewProps {
  atividades: AtividadeCompleta[];
  equipes: { id: string; nome: string; tipo: string }[];
  locais: { id: string; nome: string; municipio: string }[];
  defaultDataInicio: string;
  defaultDataFim: string;
  isAdmin: boolean;
}

export function CronogramaView({
  atividades: todasAtividades,
  equipes,
  locais,
  defaultDataInicio,
  defaultDataFim,
  isAdmin,
}: CronogramaViewProps) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  // Estado local para atualizações otimistas
  const [optimisticAtividades, setOptimisticAtividades] = useState<AtividadeCompleta[]>(todasAtividades);

  useEffect(() => {
    setOptimisticAtividades(todasAtividades);
  }, [todasAtividades]);

  // Filtros
  const [filtros, setFiltros] = useState<FiltrosCronogramaType>({
    busca: "",
    status: "todos",
    tipo: "todos",
    equipeId: "todos",
    localId: "todos",
    dataInicio: defaultDataInicio,
    dataFim: defaultDataFim,
  });
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // Formulário Nova/Editar Atividade (Admin)
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<AtividadeCompleta | null>(null);
  const [form, setForm] = useState({
    local_id: "",
    equipe_id: "",
    tipo: "instalacao" as "instalacao" | "verificacao" | "recolhimento_midia" | "recolhimento_urna",
    data_hora_planejada: "",
    sequencia: "",
    inicio_planejado: "",
    fim_planejado: "",
    observacoes: "",
  });
  const [formError, setFormError] = useState("");

  // Exclusão
  const [excluindo, setExcluindo] = useState<AtividadeCompleta | null>(null);

  // Observações
  const [obsModal, setObsModal] = useState<{ open: boolean; atividade: AtividadeCompleta | null }>({ open: false, atividade: null });
  const [obsText, setObsText] = useState("");

  // Aplica filtros
  const atividadesFiltradas = useMemo(() => {
    return optimisticAtividades.filter((a) => {
      if (filtros.busca) {
        const termo = filtros.busca.toLowerCase();
        const localNome = a.local?.nome.toLowerCase() ?? "";
        const localMunicipio = a.local?.municipio.toLowerCase() ?? "";
        const equipeNome = a.equipe?.nome.toLowerCase() ?? "";
        const obs = a.observacoes?.toLowerCase() ?? "";
        if (!localNome.includes(termo) && !localMunicipio.includes(termo) && !equipeNome.includes(termo) && !obs.includes(termo)) {
          return false;
        }
      }
      const statusEfetivo = getStatusEfetivo(a);
      if (filtros.status !== "todos" && statusEfetivo !== filtros.status) return false;
      if (filtros.tipo !== "todos" && a.tipo !== filtros.tipo) return false;
      if (filtros.equipeId !== "todos" && a.equipe_id !== filtros.equipeId) return false;
      if (filtros.localId !== "todos" && a.local_id !== filtros.localId) return false;

      const dataLocal = getLocalDateFromTimestamp(a.data_hora_planejada);
      const inicio = filtros.dataInicio ? new Date(filtros.dataInicio + "T00:00:00") : null;
      const fim = filtros.dataFim ? new Date(filtros.dataFim + "T23:59:59") : null;
      // Compara apenas a parte da data (local)
      const dataPlaneadaLocal = parseLocalDate(dataLocal);
      if (inicio && dataPlaneadaLocal < inicio) return false;
      if (fim && dataPlaneadaLocal > fim) return false;

      return true;
    });
  }, [optimisticAtividades, filtros]);

  // Agrupa por data E ordena por sequência dentro de cada dia
  const gruposPorData = useMemo(() => {
    const grupos: Record<string, AtividadeCompleta[]> = {};
    for (const a of atividadesFiltradas) {
      const dataKey = getLocalDateFromTimestamp(a.data_hora_planejada);
      if (!grupos[dataKey]) grupos[dataKey] = [];
      grupos[dataKey].push(a);
    }
    // Ordena por sequência dentro de cada dia
    Object.keys(grupos).forEach(key => {
      grupos[key].sort((a, b) => (a.sequencia ?? 999) - (b.sequencia ?? 999));
    });
    return grupos;
  }, [atividadesFiltradas]);

  const datasOrdenadas = useMemo(() => Object.keys(gruposPorData).sort(), [gruposPorData]);

  const temFiltrosAtivos = useMemo(() => {
    return (
      filtros.busca !== "" ||
      filtros.status !== "todos" ||
      filtros.tipo !== "todos" ||
      filtros.equipeId !== "todos" ||
      filtros.localId !== "todos" ||
      filtros.dataInicio !== defaultDataInicio ||
      filtros.dataFim !== defaultDataFim
    );
  }, [filtros, defaultDataInicio, defaultDataFim]);

  const handleChange = (parciais: Partial<FiltrosCronogramaType>) => {
    setFiltros((prev: FiltrosCronogramaType) => ({ ...prev, ...parciais }));
  };

  const handleClear = () => {
    setFiltros({
      busca: "",
      status: "todos",
      tipo: "todos",
      equipeId: "todos",
      localId: "todos",
      dataInicio: defaultDataInicio,
      dataFim: defaultDataFim,
    });
  };

  const toggleDate = (dataKey: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) next.delete(dataKey);
      else next.add(dataKey);
      return next;
    });
  };

  const isExpanded = (dataKey: string) => expandedDates.has(dataKey);

  // Options para selects do formulário
  const tipoOptions: SelectOption[] = [
    { value: "instalacao", label: TIPO_ATIVIDADE_LABEL.instalacao },
    { value: "verificacao", label: TIPO_ATIVIDADE_LABEL.verificacao },
    { value: "recolhimento_midia", label: TIPO_ATIVIDADE_LABEL.recolhimento_midia },
    { value: "recolhimento_urna", label: TIPO_ATIVIDADE_LABEL.recolhimento_urna },
  ];

  const localOptions: SelectOption[] = [
    { value: "", label: "Selecione o local" },
    ...locais.map((l) => ({ value: l.id, label: `${l.nome} — ${l.municipio}` })),
  ];

  // Rótulo com o tipo cadastrado da equipe (dinâmico — 4 tipos possíveis)
  const equipeOptions: SelectOption[] = [
    { value: "", label: "Selecione a equipe" },
    ...equipes.map((e) => ({
      value: e.id,
      label: `${e.nome} (${rotuloTipoEquipe(e.tipo)})`,
    })),
  ];

  // Form handlers
  const abrirFormNovo = () => {
    setEditando(null);
    const now = new Date();
    // Usa a data/hora local diretamente (sem conversão UTC)
    const dtLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const timeStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toTimeString().slice(0, 5);
    setForm({
      local_id: "",
      equipe_id: "",
      tipo: "instalacao",
      data_hora_planejada: dtLocal,
      sequencia: "",
      inicio_planejado: timeStr,
      fim_planejado: "",
      observacoes: "",
    });
    setFormError("");
    setFormOpen(true);
  };

  const abrirFormEditar = (atividade: AtividadeCompleta) => {
    setEditando(atividade);
    // data_hora_planejada é horário de parede (timestamp sem zona). Extrai a
    // data/hora literal da string (funciona também se vier com fuso "Z").
    const raw = atividade.data_hora_planejada;
    const dtLocal = hasTimezone(raw)
      ? (() => {
          const dt = new Date(raw);
          const year = dt.getFullYear();
          const month = String(dt.getMonth() + 1).padStart(2, "0");
          const day = String(dt.getDate()).padStart(2, "0");
          const hours = String(dt.getHours()).padStart(2, "0");
          const minutes = String(dt.getMinutes()).padStart(2, "0");
          return `${year}-${month}-${day}T${hours}:${minutes}`;
        })()
      : raw.slice(0, 16);
    setForm({
      local_id: atividade.local_id,
      equipe_id: atividade.equipe_id,
      tipo: atividade.tipo,
      data_hora_planejada: dtLocal,
      sequencia: atividade.sequencia?.toString() ?? "",
      inicio_planejado: atividade.inicio_planejado?.slice(0, 5) ?? "",
      fim_planejado: atividade.fim_planejado?.slice(0, 5) ?? "",
      observacoes: atividade.observacoes ?? "",
    });
    setFormError("");
    setFormOpen(true);
  };

  /** Monta a atividade completa a partir da linha retornada pelo servidor,
   * preservando equipe/local já carregados ou buscando nas props locais. */
  const montarAtividadeCompleta = (
    row: Tables<"atividades">,
    prev?: AtividadeCompleta
  ): AtividadeCompleta => {
    const equipe = (prev?.equipe ??
      equipes.find((e) => e.id === row.equipe_id) ??
      null) as Tables<"equipes"> | null;
    const local = (prev?.local ??
      locais.find((l) => l.id === row.local_id) ??
      null) as Tables<"locais_votacao"> | null;
    return { ...row, equipe, local };
  };

  const salvarForm = async () => {
    if (!form.local_id || !form.equipe_id || !form.tipo || !form.data_hora_planejada) {
      setFormError("Preencha todos os campos obrigatórios.");
      return;
    }

    try {
      // A coluna data_hora_planejada é `timestamp without time zone` (horário de
      // parede): envia a data/hora literal digitada no formulário, sem offset.
      const payload = {
        local_id: form.local_id,
        equipe_id: form.equipe_id,
        tipo: form.tipo,
        data_hora_planejada: form.data_hora_planejada + ":00",
        sequencia: form.sequencia ? parseInt(form.sequencia, 10) : null,
        inicio_planejado: form.inicio_planejado ? form.inicio_planejado + ":00" : null,
        fim_planejado: form.fim_planejado ? form.fim_planejado + ":00" : null,
        observacoes: form.observacoes || null,
      };

      if (editando) {
        const { error, data } = await atualizarAtividade(editando.id, payload);
        if (error) throw new Error(error);
        if (data) {
          // Atualização otimista: reflete a edição sem recarregar a página
          setOptimisticAtividades((prev) =>
            prev.map((a) => (a.id === editando.id ? montarAtividadeCompleta(data, a) : a))
          );
        }
        toast("success", "Atividade atualizada com sucesso.");
      } else {
        const { error, data } = await criarAtividade(payload);
        if (error) throw new Error(error);
        if (data) {
          // Inserção otimista: a nova atividade aparece sem sair da tela
          setOptimisticAtividades((prev) => [...prev, montarAtividadeCompleta(data)]);
        }
        toast("success", "Atividade criada com sucesso.");
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
      await excluirAtividade(excluindo.id);
      toast("success", "Atividade excluída com sucesso.");
      setExcluindo(null);
      setOptimisticAtividades((prev) => prev.filter((a) => a.id !== excluindo.id));
    } catch {
      toast("error", "Erro ao excluir atividade.");
    }
  };

  // Ações de execução (todos os perfis)
  const handleIniciar = (atividade: AtividadeCompleta) => {
    const statusEfetivo = getStatusEfetivo(atividade);
    if (statusEfetivo !== "pendente" && statusEfetivo !== "atrasado") return;

    startTransition(async () => {
      setOptimisticAtividades((prev) => prev.map((a) =>
        a.id === atividade.id ? { ...a, status: "em_andamento", data_hora_real: new Date().toISOString() } : a
      ));
      const { error } = await iniciarAtividade(atividade.id);
      if (error) {
        toast("error", `Erro ao iniciar: ${error}`);
        setOptimisticAtividades((prev) => prev.map((a) => (a.id === atividade.id ? { ...a, ...atividade } : a)));
      } else {
        toast("success", "Atividade marcada como em andamento");
      }
    });
  };

  const handleConcluir = (atividade: AtividadeCompleta, observacoes?: string) => {
    const statusEfetivo = getStatusEfetivo(atividade);
    if (statusEfetivo !== "em_andamento" && statusEfetivo !== "pendente" && statusEfetivo !== "atrasado") return;

    startTransition(async () => {
      const now = new Date().toISOString();
      setOptimisticAtividades((prev) => prev.map((a) =>
        a.id === atividade.id ? { ...a, status: "concluido", data_hora_real: now, observacoes: observacoes ?? a.observacoes } : a
      ));
      const { error } = await concluirAtividade(atividade.id, observacoes);
      if (error) {
        toast("error", `Erro ao concluir: ${error}`);
        setOptimisticAtividades((prev) => prev.map((a) => (a.id === atividade.id ? { ...a, ...atividade } : a)));
      } else {
        toast("success", "Atividade finalizada com sucesso");
      }
    });
  };

  const handleObservacoesChange = (atividade: AtividadeCompleta, observacoes: string) => {
    startTransition(async () => {
      setOptimisticAtividades((prev) => prev.map((a) =>
        a.id === atividade.id ? { ...a, observacoes } : a
      ));
      const { error } = await atualizarObservacoes(atividade.id, observacoes);
      if (error) {
        toast("error", `Erro ao salvar: ${error}`);
        setOptimisticAtividades((prev) => prev.map((a) => (a.id === atividade.id ? { ...a, ...atividade } : a)));
      }
    });
  };

  const openObsModal = (atividade: AtividadeCompleta) => {
    setObsText(atividade.observacoes ?? "");
    setObsModal({ open: true, atividade });
  };

  const closeObsModal = () => {
    setObsModal({ open: false, atividade: null });
    setObsText("");
  };

  const saveObs = () => {
    if (obsModal.atividade) {
      handleObservacoesChange(obsModal.atividade, obsText);
    }
    closeObsModal();
  };

  const isProximo = (atividade: AtividadeCompleta) => {
    if (atividade.status !== "pendente") return false;
    const agora = new Date();
    const planejada = new Date(atividade.data_hora_planejada);
    const diffMin = (planejada.getTime() - agora.getTime()) / 60000;
    return diffMin > 0 && diffMin <= 30;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="size-5 text-brand" />
          <h2 className="text-title font-semibold text-fg">Cronograma de Atividades</h2>
          {temFiltrosAtivos && (
            <Badge tone="brand" dot className="text-caption">Filtrado</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="subtle" onClick={handleClear} disabled={!temFiltrosAtivos} className="whitespace-nowrap">
            <Filter className="size-4 mr-1.5" />
            Limpar filtros
          </Button>
          {isAdmin && (
            <Button variant="primary" onClick={abrirFormNovo} className="whitespace-nowrap">
              <Plus className="size-4 mr-1.5" />
              Nova Atividade
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <FiltrosCronograma
        filtros={filtros}
        onChange={handleChange}
        onClear={handleClear}
        temFiltrosAtivos={temFiltrosAtivos}
        equipes={equipes}
        locais={locais}
      />

      {/* Lista agrupada por data */}
      {atividadesFiltradas.length === 0 ? (
        <div className="rounded-lg border border-stroke bg-surface p-8 text-center">
          <Calendar className="mx-auto mb-2 size-10 text-fg-2" />
          <p className="text-body text-fg-3">
            {temFiltrosAtivos ? "Nenhuma atividade encontrada com os filtros atuais." : "Nenhuma atividade cadastrada."}
          </p>
          {temFiltrosAtivos && (
            <Button variant="subtle" onClick={handleClear} className="mt-3">
              Limpar filtros
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {datasOrdenadas.map((dataKey) => {
            const atividadesDoDia = gruposPorData[dataKey];
            const data = new Date(dataKey + "T12:00:00");
            const expandido = isExpanded(dataKey);

            return (
              <div key={dataKey} className="rounded-lg border border-stroke bg-surface overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleDate(dataKey)}
                  className="w-full flex items-center justify-between gap-3 border-b border-stroke bg-surface-subtle p-4 text-left transition-colors hover:bg-stroke"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="size-5 text-brand" />
                    <div>
                      <p className="text-subtitle font-semibold text-fg">
                        {data.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
                      </p>
                      <p className="text-caption text-fg-3">
                        {atividadesDoDia.length} {atividadesDoDia.length === 1 ? "atividade" : "atividades"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral" className="text-caption">
                      {atividadesDoDia.filter((a) => getStatusEfetivo(a) === "pendente").length} pendentes
                    </Badge>
                    <Badge tone="brand" className="text-caption">
                      {atividadesDoDia.filter((a) => getStatusEfetivo(a) === "em_andamento").length} and.
                    </Badge>
                    <Badge tone="success" className="text-caption">
                      {atividadesDoDia.filter((a) => getStatusEfetivo(a) === "concluido").length} concl.
                    </Badge>
                    <Badge tone="danger" className="text-caption">
                      {atividadesDoDia.filter((a) => getStatusEfetivo(a) === "atrasado").length} atras.
                    </Badge>
                    {expandido ? <ChevronUp className="size-5 text-fg-3" /> : <ChevronDown className="size-5 text-fg-3" />}
                  </div>
                </button>

                {expandido && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-body">
                      <thead>
                        <tr className="border-b border-stroke bg-surface-subtle">
                          <th className="px-4 py-2.5 text-caption font-semibold text-fg-2">Local</th>
                          <th className="px-4 py-2.5 text-caption font-semibold text-fg-2 whitespace-nowrap">Tipo</th>
                          <th className="px-4 py-2.5 text-caption font-semibold text-fg-2">Equipe</th>
                          <th className="px-4 py-2.5 text-caption font-semibold text-fg-2 whitespace-nowrap">Status</th>
                          <th className="px-4 py-2.5 text-caption font-semibold text-fg-2">Observações</th>
                          <th className="px-4 py-2.5 text-caption font-semibold text-fg-2 whitespace-nowrap text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {atividadesDoDia.map((a) => (
                          <CronogramaAtividadeRow
                            key={a.id}
                            atividade={a}
                            onIniciar={handleIniciar}
                            onConcluir={handleConcluir}
                            onObservacoes={openObsModal}
                            onEditar={isAdmin ? abrirFormEditar : undefined}
                            onExcluir={isAdmin ? (a) => setExcluindo(a) : undefined}
                            isProximo={isProximo(a)}
                            disabled={pending}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog Form Nova/Editar */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editando ? "Editar Atividade" : "Nova Atividade"}
        maxWidth="max-w-lg"
        actions={
          <>
            <Button variant="subtle" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={salvarForm} disabled={pending}>
              {editando ? "Salvar" : "Criar"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Local de Votação"
            value={form.local_id}
            onChange={(e) => setForm({ ...form, local_id: e.target.value })}
            options={localOptions}
            required
          />
          <Select
            label="Equipe"
            value={form.equipe_id}
            onChange={(e) => setForm({ ...form, equipe_id: e.target.value })}
            options={equipeOptions}
            required
          />
          <Select
            label="Tipo de Atividade"
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value as typeof form.tipo })}
            options={tipoOptions}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Sequência"
              type="number"
              placeholder="1"
              value={form.sequencia}
              onChange={(e) => setForm({ ...form, sequencia: e.target.value })}
              min="1"
            />
            <Input
              label="Data"
              type="date"
              value={form.data_hora_planejada.split("T")[0]}
              onChange={(e) => setForm({ ...form, data_hora_planejada: e.target.value + "T" + form.data_hora_planejada.split("T")[1] })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Início"
              type="time"
              value={form.inicio_planejado}
              onChange={(e) => setForm({ ...form, inicio_planejado: e.target.value })}
            />
            <Input
              label="Fim"
              type="time"
              value={form.fim_planejado}
              onChange={(e) => setForm({ ...form, fim_planejado: e.target.value })}
            />
          </div>
          <Textarea
            label="Observações (opcional)"
            placeholder="Observações sobre a atividade..."
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            rows={3}
          />
          {formError && <p className="text-caption text-danger-fg" role="alert">{formError}</p>}
        </div>
      </Dialog>

      {/* Dialog Observações */}
      <Dialog
        open={obsModal.open}
        onClose={closeObsModal}
        title="Observações"
        maxWidth="max-w-md"
        actions={
          <>
            <Button variant="subtle" onClick={closeObsModal}>Cancelar</Button>
            <Button onClick={saveObs} disabled={pending}>Salvar</Button>
          </>
        }
      >
        <Textarea
          value={obsText}
          onChange={(e) => setObsText(e.target.value)}
          placeholder="Adicione observações sobre esta atividade..."
          className="min-h-[120px] mb-4"
          rows={4}
        />
      </Dialog>

      {/* Dialog Confirmar Exclusão */}
      <ConfirmDialog
        open={!!excluindo}
        onClose={() => setExcluindo(null)}
        onConfirm={excluir}
        title="Excluir atividade"
        message={`Tem certeza que deseja excluir esta atividade? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </div>
  );
}

interface CronogramaAtividadeRowProps {
  atividade: AtividadeCompleta;
  onIniciar: (a: AtividadeCompleta) => void;
  onConcluir: (a: AtividadeCompleta, obs?: string) => void;
  onObservacoes: (a: AtividadeCompleta) => void;
  onEditar?: (a: AtividadeCompleta) => void;
  onExcluir?: (a: AtividadeCompleta) => void;
  isProximo: boolean;
  disabled: boolean;
}

function CronogramaAtividadeRow({
  atividade,
  onIniciar,
  onConcluir,
  onObservacoes,
  onEditar,
  onExcluir,
  isProximo,
  disabled,
}: CronogramaAtividadeRowProps) {
  const { local, equipe, tipo, data_hora_planejada, data_hora_real, status, observacoes, sequencia, inicio_planejado, fim_planejado, duracao_minutos } = atividade;
  const statusEfetivo = getStatusEfetivo(atividade);
  const isAtrasado = statusEfetivo === "atrasado";
  const temObservacoes = observacoes && observacoes.trim() !== "";

  const podeIniciar = (statusEfetivo === "pendente" || statusEfetivo === "atrasado") && !disabled;
  const podeConcluir = (statusEfetivo === "em_andamento" || statusEfetivo === "pendente" || statusEfetivo === "atrasado") && !disabled;

  return (
    <tr className="border-b border-stroke-subtle last:border-b-0">
      {/* Local (primeira coluna) - com horário */}
      <td className="px-4 py-3 text-fg">
        <div className="flex items-start gap-2">
          <MapPin className="size-4 text-fg-3 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-body truncate">{local?.nome ?? "—"}</p>
            <p className="text-micro text-fg-4 truncate">{local?.endereco ? `${local.endereco} — ${local.municipio}` : local?.municipio ?? ""}</p>
          </div>
        </div>
      </td>

      {/* Tipo */}
      <td className="px-4 py-3 text-fg whitespace-nowrap">
        <TipoAtividadeBadge tipo={tipo} />
      </td>

      {/* Equipe */}
      <td className="px-4 py-3 text-fg">
        {equipe ? (
          <div className="flex items-center gap-2">
            <Users className="size-4 text-fg-3 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-body truncate">{equipe.nome}</p>
              <p className="text-caption text-fg-3">
                {rotuloTipoEquipe(equipe.tipo)}
              </p>
            </div>
          </div>
        ) : (
          <span className="text-caption text-fg-3">—</span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3 text-fg whitespace-nowrap">
        <StatusAtividadeBadge status={statusEfetivo} />
        {isAtrasado && (
          <Badge tone="danger" dot className="mt-1.5 text-micro">Atrasado</Badge>
        )}
      </td>

      {/* Observações */}
      <td className="px-4 py-3 text-fg">
        {observacoes ? (
          <p className="text-body truncate max-w-xs" title={observacoes}>{observacoes}</p>
        ) : (
          <span className="text-caption text-fg-3">—</span>
        )}
        {temObservacoes && (
          <Button
            variant="subtle"
            size="sm"
            className="ml-2 h-6 w-6 p-0"
            onClick={() => onObservacoes(atividade)}
            aria-label="Ver/editar observações"
          >
            <MessageSquare className="size-4" />
          </Button>
        )}
      </td>

      {/* Ações */}
      <td className="px-4 py-3 text-fg text-right">
        <div className="flex items-center justify-end gap-1.5">
          {podeIniciar && (
            <Button
              size="sm"
              onClick={() => onIniciar(atividade)}
              disabled={disabled}
              className="gap-1.5"
            >
              <Play className="size-3.5" />
              Iniciar
            </Button>
          )}
          {podeConcluir && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => onConcluir(atividade)}
              disabled={disabled}
              className="gap-1.5"
            >
              <CheckCircle className="size-3.5" />
              Concluir
            </Button>
          )}
          {onEditar && (
            <Button
              variant="subtle"
              size="sm"
              onClick={() => onEditar!(atividade)}
              disabled={disabled}
              className="gap-1.5"
            >
              <Pencil className="size-3.5" />
              Editar
            </Button>
          )}
          {onExcluir && (
            <Button
              variant="subtle"
              size="sm"
              onClick={() => onExcluir!(atividade)}
              disabled={disabled}
              className="gap-1.5 text-danger-fg hover:bg-danger-bg hover:text-danger-fg"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
          {!podeIniciar && !podeConcluir && !onEditar && !onExcluir && (
            <Badge tone="neutral" className="text-caption">—</Badge>
          )}
        </div>
      </td>
    </tr>
  );
}

