"use client";

import { useState, type ChangeEvent } from "react";
import { ChevronDown, Filter, X, Calendar, Users, MapPin, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, type SelectOption } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TipoAtividade, StatusAtividade } from "@/types/database";
import { TIPO_ATIVIDADE_LABEL, STATUS_ATIVIDADE_LABEL, rotuloTipoEquipe } from "@/lib/constants";

export interface FiltrosCronograma {
  busca: string;
  status: StatusAtividade | "todos";
  tipo: TipoAtividade | "todos";
  equipeId: string | "todos";
  localId: string | "todos";
  dataInicio: string; // ISO date string (YYYY-MM-DD)
  dataFim: string;
}

interface FiltrosCronogramaProps {
  filtros: FiltrosCronograma;
  onChange: (f: Partial<FiltrosCronograma>) => void;
  onClear: () => void;
  temFiltrosAtivos: boolean;
  equipes: { id: string; nome: string; tipo: string }[];
  locais: { id: string; nome: string; municipio: string }[];
}

export function FiltrosCronograma({
  filtros,
  onChange,
  onClear,
  temFiltrosAtivos,
  equipes,
  locais,
}: FiltrosCronogramaProps) {
  const [buscaInput, setBuscaInput] = useState(filtros.busca);

  const handleBuscaChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBuscaInput(value);
    onChange({ busca: value });
  };

  const handleClearBusca = () => {
    setBuscaInput("");
    onChange({ busca: "" });
  };

  const statusOptions: SelectOption[] = [
    { value: "todos", label: "Todos" },
    { value: "pendente", label: "Pendente" },
    { value: "em_andamento", label: "Em andamento" },
    { value: "concluido", label: "Concluído" },
    { value: "atrasado", label: "Atrasado" },
  ];

  const tipoOptions: SelectOption[] = [
    { value: "todos", label: "Todos" },
    { value: "instalacao", label: TIPO_ATIVIDADE_LABEL.instalacao },
    { value: "verificacao", label: TIPO_ATIVIDADE_LABEL.verificacao },
    { value: "recolhimento_midia", label: TIPO_ATIVIDADE_LABEL.recolhimento_midia },
    { value: "recolhimento_urna", label: TIPO_ATIVIDADE_LABEL.recolhimento_urna },
  ];

  const equipeOptions: SelectOption[] = [
    { value: "todos", label: "Todas" },
    ...equipes.map((e) => ({
      value: e.id,
      label: `${e.nome} (${rotuloTipoEquipe(e.tipo)})`,
    })),
  ];

  const localOptions: SelectOption[] = [
    { value: "todos", label: "Todos" },
    ...locais.map((l) => ({
      value: l.id,
      label: `${l.nome} — ${l.municipio}`,
    })),
  ];

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end">
      {/* Busca */}
      <div className="relative flex-1 min-w-[200px]">
        <label htmlFor="busca" className="sr-only">
          Buscar atividade
        </label>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-fg-3" />
          <Input
            id="busca"
            value={buscaInput}
            onChange={handleBuscaChange}
            placeholder="Buscar por local, equipe, observações…"
            className="pl-9 pr-9"
          />
          {buscaInput && (
            <button
              type="button"
              onClick={handleClearBusca}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-3 hover:text-fg"
              aria-label="Limpar busca"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="w-full md:w-[160px]">
        <Select
          value={filtros.status}
          onChange={(e) => onChange({ status: e.target.value as StatusAtividade | "todos" })}
          options={statusOptions}
          placeholder="Todos os status"
        />
      </div>

      {/* Tipo de atividade */}
      <div className="w-full md:w-[200px]">
        <Select
          value={filtros.tipo}
          onChange={(e) => onChange({ tipo: e.target.value as TipoAtividade | "todos" })}
          options={tipoOptions}
          placeholder="Todos os tipos"
        />
      </div>

      {/* Equipe */}
      <div className="w-full md:w-[180px]">
        <Select
          value={filtros.equipeId}
          onChange={(e) => onChange({ equipeId: e.target.value })}
          options={equipeOptions}
          placeholder="Todas as equipes"
        />
      </div>

      {/* Local */}
      <div className="w-full md:w-[180px]">
        <Select
          value={filtros.localId}
          onChange={(e) => onChange({ localId: e.target.value })}
          options={localOptions}
          placeholder="Todos os locais"
        />
      </div>

      {/* Período */}
      <div className="flex gap-2 md:w-[320px]">
        <div className="flex-1">
          <label htmlFor="dataInicio" className="sr-only">
            Data inicial
          </label>
          <Input
            id="dataInicio"
            type="date"
            value={filtros.dataInicio}
            onChange={(e) => onChange({ dataInicio: e.target.value })}
            className="text-body"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="dataFim" className="sr-only">
            Data final
          </label>
          <Input
            id="dataFim"
            type="date"
            value={filtros.dataFim}
            onChange={(e) => onChange({ dataFim: e.target.value })}
            className="text-body"
          />
        </div>
      </div>

      {/* Limpar filtros */}
      {temFiltrosAtivos && (
        <Button variant="subtle" onClick={onClear} className="whitespace-nowrap">
          <X className="size-4 mr-1.5" />
          Limpar
        </Button>
      )}
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

/** Badge de tipo de atividade. */
export function TipoAtividadeBadge({ tipo }: { tipo: TipoAtividade }) {
  const tones: Record<TipoAtividade, "neutral" | "brand" | "success" | "warning" | "danger"> = {
    instalacao: "brand",
    verificacao: "success",
    recolhimento_midia: "warning",
    recolhimento_urna: "danger",
  };
  return <Badge tone={tones[tipo]}>{TIPO_ATIVIDADE_LABEL[tipo]}</Badge>;
}

/** Badge de status de atividade. */
export function StatusAtividadeBadge({ status }: { status: StatusAtividade }) {
  const tones: Record<StatusAtividade, "neutral" | "brand" | "success" | "warning" | "danger"> = {
    pendente: "neutral",
    em_andamento: "brand",
    concluido: "success",
    atrasado: "danger",
  };
  return <Badge tone={tones[status]}>{STATUS_ATIVIDADE_LABEL[status]}</Badge>;
}