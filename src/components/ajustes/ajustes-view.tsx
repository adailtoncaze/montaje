"use client";

import { useState, useMemo } from "react";
import { Calendar, Users, Shield, Save, AlertCircle, ChevronDown, ChevronUp, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { formatLocalDate, daysUntil, formatTimestamp } from "@/lib/utils/date";
import { atualizarConfiguracaoEleicao, criarConfiguracaoEleicao, promoverParaAdmin, rebaixarParaServidor, listarUsuarios } from "@/lib/actions/auth-mutations";
import type { Tables } from "@/types/supabase";

type ConfigEleicao = Tables<"configuracao_eleicao">;
type Perfil = Tables<"perfis">;
type Usuario = Perfil & { email: string };

interface AjustesViewProps {
  config: ConfigEleicao | null;
  usuarios: Usuario[];
  perfil: Perfil | null;
}

export function AjustesView({
  config,
  usuarios,
  perfil,
}: AjustesViewProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"eleicao" | "usuarios">("eleicao");

  // Form config eleição
  const [formConfig, setFormConfig] = useState({
    id: config?.id ?? "",
    ano: config?.ano ?? new Date().getFullYear(),
    turno: config?.turno ?? 1,
    data_montagem_sexta: config?.data_montagem_sexta ?? "",
    data_montagem_sabado: config?.data_montagem_sabado ?? "",
    data_eleicao: config?.data_eleicao ?? "",
    zona_eleitoral: config?.zona_eleitoral ?? "",
    ativa: config?.ativa ?? true,
  });
  const [configError, setConfigError] = useState("");
  const [configSaving, setConfigSaving] = useState(false);

  // Usuários
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [promovendo, setPromovendo] = useState<string | null>(null);
  const [rebaixando, setRebaixando] = useState<string | null>(null);
  const [excluindoUsuario, setExcluindoUsuario] = useState<string | null>(null);

  const handleConfigChange = (campo: string, valor: string | number | boolean) => {
    setFormConfig((prev) => ({ ...prev, [campo]: valor }));
  };

  const salvarConfig = async () => {
    if (!formConfig.ano || !formConfig.turno || !formConfig.data_montagem_sexta || !formConfig.data_montagem_sabado || !formConfig.data_eleicao || !formConfig.zona_eleitoral) {
      setConfigError("Preencha todos os campos obrigatórios.");
      return;
    }

    setConfigSaving(true);
    setConfigError("");

    try {
      if (formConfig.id) {
        const { error } = await atualizarConfiguracaoEleicao(formConfig);
        if (error) throw new Error(error);
      } else {
        const { error } = await criarConfiguracaoEleicao(formConfig);
        if (error) throw new Error(error);
      }
      toast("success", "Configuração salva com sucesso.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar.";
      setConfigError(msg);
      toast("error", msg);
    } finally {
      setConfigSaving(false);
    }
  };

  const handlePromover = async (userId: string) => {
    setPromovendo(userId);
    try {
      const { error } = await promoverParaAdmin(userId);
      if (error) throw new Error(error);
      toast("success", "Usuário promovido a administrador.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao promover.";
      toast("error", msg);
    } finally {
      setPromovendo(null);
    }
  };

  const handleRebaixar = async (userId: string) => {
    // Impede auto-rebaixamento
    if (userId === perfil?.id) {
      toast("warning", "Você não pode rebaixar a si mesmo.");
      return;
    }
    setRebaixando(userId);
    try {
      const { error } = await rebaixarParaServidor(userId);
      if (error) throw new Error(error);
      toast("success", "Usuário rebaixado para servidor zona.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao rebaixar.";
      toast("error", msg);
    } finally {
      setRebaixando(null);
    }
  };

  const toggleExpand = (userId: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const usuariosOrdenados = useMemo(() => {
    return [...usuarios].sort((a, b) => {
      // Admins primeiro, depois por nome
      if (a.perfil === "admin" && b.perfil !== "admin") return -1;
      if (b.perfil === "admin" && a.perfil !== "admin") return 1;
      return (a.nome ?? "").localeCompare(b.nome ?? "");
    });
  }, [usuarios]);

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex border-b border-stroke">
        <button
          onClick={() => setActiveTab("eleicao")}
          className={cn(
            "px-4 py-2 text-caption font-semibold border-b-2 transition-colors",
            activeTab === "eleicao"
              ? "border-brand text-brand"
              : "border-transparent text-fg-3 hover:text-fg"
          )}
        >
          <Calendar className="size-4 mr-1.5 inline" />
          Eleição
        </button>
        <button
          onClick={() => setActiveTab("usuarios")}
          className={cn(
            "px-4 py-2 text-caption font-semibold border-b-2 transition-colors",
            activeTab === "usuarios"
              ? "border-brand text-brand"
              : "border-transparent text-fg-3 hover:text-fg"
          )}
        >
          <Users className="size-4 mr-1.5 inline" />
          Usuários
        </button>
      </div>

      {activeTab === "eleicao" && (
        <div className="space-y-6">
          {/* Configuração da eleição ativa */}
          <Card>
            <CardHeader
              title={config ? "Eleição ativa" : "Nova eleição"}
              description={config ? "Edite os dados da eleição atual" : "Configure a primeira eleição do sistema"}
            />
            <div className="px-5 pb-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Ano"
                  type="number"
                  min={2020}
                  max={2030}
                  value={formConfig.ano}
                  onChange={(e) => handleConfigChange("ano", parseInt(e.target.value) || 0)}
                  required
                />
                <Input
                  label="Turno"
                  type="number"
                  min={1}
                  max={2}
                  value={formConfig.turno}
                  onChange={(e) => handleConfigChange("turno", parseInt(e.target.value) || 0)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Montagem (Sexta)"
                  type="date"
                  value={formConfig.data_montagem_sexta}
                  onChange={(e) => handleConfigChange("data_montagem_sexta", e.target.value)}
                  required
                />
                <Input
                  label="Montagem (Sábado)"
                  type="date"
                  value={formConfig.data_montagem_sabado}
                  onChange={(e) => handleConfigChange("data_montagem_sabado", e.target.value)}
                  required
                />
                <Input
                  label="Eleição (Domingo)"
                  type="date"
                  value={formConfig.data_eleicao}
                  onChange={(e) => handleConfigChange("data_eleicao", e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Zona Eleitoral"
                  placeholder="Ex: 123ª Zona Eleitoral - João Pessoa/PB"
                  value={formConfig.zona_eleitoral}
                  onChange={(e) => handleConfigChange("zona_eleitoral", e.target.value)}
                  required
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="checkbox"
                    id="ativa"
                    checked={formConfig.ativa}
                    onChange={(e) => handleConfigChange("ativa", e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="ativa" className="text-caption text-fg-2 cursor-pointer">
                    Eleição ativa (apenas uma por vez)
                  </label>
                </div>
              </div>

              {configError && (
                <div className="rounded-md bg-danger-bg p-3 text-danger-fg text-caption flex items-center gap-2">
                  <AlertCircle className="size-4" />
                  {configError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="primary" onClick={salvarConfig} disabled={configSaving}>
                  <Save className="size-4 mr-2" />
                  {configSaving ? "Salvando…" : config ? "Salvar alterações" : "Criar eleição"}
                </Button>
              </div>
            </div>
          </Card>

          {/* Resumo das datas */}
          {config && (
            <Card>
              <CardHeader title="Datas da eleição" />
              <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                <DateInfoCard
                  label="Montagem (Sexta)"
                  date={config.data_montagem_sexta}
                  iconColor="brand"
                />
                <DateInfoCard
                  label="Montagem (Sábado)"
                  date={config.data_montagem_sabado}
                  iconColor="warning"
                />
                <DateInfoCard
                  label="Eleição (Domingo)"
                  date={config.data_eleicao}
                  iconColor="danger"
                />
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === "usuarios" && (
        <Card>
          <CardHeader
            title="Gerenciar usuários"
            description={`${usuarios.length} usuário(s) cadastrado(s)`}
          />
          <div className="px-5 pb-5">
            {usuarios.length === 0 ? (
              <p className="py-8 text-center text-body text-fg-3">Nenhum usuário cadastrado.</p>
            ) : (
              <div className="space-y-2">
                {usuariosOrdenados.map((u: typeof usuariosOrdenados[0]) => (
                  <UsuarioCard
                    key={u.id}
                    usuario={u}
                    isCurrentUser={u.id === perfil?.id}
                    expandido={expandidos.has(u.id)}
                    onToggle={() => toggleExpand(u.id)}
                    onPromover={() => handlePromover(u.id)}
                    onRebaixar={() => handleRebaixar(u.id)}
                    promovendo={promovendo === u.id}
                    rebaixando={rebaixando === u.id}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function DateInfoCard({ label, date, iconColor }: { label: string; date: string; iconColor: "brand" | "warning" | "danger" }) {
  const dataFormatada = formatLocalDate(date, "EEEE, d 'de' MMMM");
  const dias = daysUntil(date);

  let statusTexto = "";
  if (dias < 0) statusTexto = "Já passou";
  else if (dias === 0) statusTexto = "Hoje!";
  else if (dias === 1) statusTexto = "Amanhã";
  else statusTexto = `${dias} dias`;

  const cores = {
    brand: "bg-brand-tint text-brand-fg border-brand/30",
    warning: "bg-warning-bg text-warning-fg border-warning-stroke",
    danger: "bg-danger-bg/20 text-danger-fg border-danger-stroke",
  };

  return (
    <div className={cn("rounded-lg border p-4", cores[iconColor])}>
      <p className="text-caption text-fg-4">{label}</p>
      <p className="text-body font-semibold mt-1">{dataFormatada}</p>
      <p className="text-caption font-medium mt-1">{statusTexto}</p>
    </div>
  );
}

function UsuarioCard({
  usuario,
  isCurrentUser,
  expandido,
  onToggle,
  onPromover,
  onRebaixar,
  promovendo,
  rebaixando,
}: {
  usuario: Usuario;
  isCurrentUser: boolean;
  expandido: boolean;
  onToggle: () => void;
  onPromover: () => void;
  onRebaixar: () => void;
  promovendo: boolean;
  rebaixando: boolean;
}) {
  const isAdmin = usuario.perfil === "admin";

  return (
    <div className="rounded-lg border border-stroke bg-surface overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-surface-subtle transition-colors"
        aria-expanded={expandido}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="size-10 rounded-full bg-brand-tint flex items-center justify-center text-brand-fg font-semibold">
            {usuario.nome?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-body truncate">{usuario.nome ?? "Sem nome"}</p>
            <p className="text-caption text-fg-3 truncate">{usuario.email ?? "Sem email"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={isAdmin ? "warning" : "neutral"} className="text-caption">
            {isAdmin ? <Shield className="size-3 mr-1" /> : ""}
            {isAdmin ? "Admin" : "Servidor Zona"}
          </Badge>
          {expandido ? <ChevronUp className="size-5 text-fg-3" /> : <ChevronDown className="size-5 text-fg-3" />}
        </div>
      </button>

      {expandido && (
        <div className="border-t border-stroke px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-caption text-fg-3">
            <div>
              <p>Perfil</p>
              <p className="font-medium text-fg">{usuario.perfil}</p>
            </div>
            <div>
              <p>Criado em</p>
              <p className="font-medium text-fg">{usuario.criado_em ? formatTimestamp(usuario.criado_em) : "—"}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {isAdmin ? (
              <>
                {!isCurrentUser && (
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={onRebaixar}
                    disabled={rebaixando}
                    className="gap-1.5 text-danger-fg hover:bg-danger-bg hover:text-danger-fg"
                  >
                    <Users className="size-3.5" />
                    {rebaixando ? "Rebaixando…" : "Rebaixar para Servidor"}
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onPromover}
                  disabled={promovendo}
                  className="gap-1.5"
                >
                  <Shield className="size-3.5" />
                  {promovendo ? "Promovendo…" : "Promover a Admin"}
                </Button>
              </>
            )}
            {isCurrentUser && (
              <Badge tone="neutral" className="text-caption">Você</Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}