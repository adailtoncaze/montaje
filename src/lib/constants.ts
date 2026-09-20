import type {
  PapelEquipe,
  PerfilUsuario,
  StatusAtividade,
  TipoAtividade,
  TipoEquipe,
} from "@/types/database";

export const PERFIL_LABEL: Record<PerfilUsuario, string> = {
  admin: "Admin",
  servidor_zona: "Servidor Zona",
};

export const TIPO_EQUIPE_LABEL: Record<TipoEquipe, string> = {
  instalacao: "Instalação de Urna",
  verificacao: "Montagem de Seção",
  recolhimento_midia: "Recolhimento de Mídia",
  recolhimento_urna: "Recolhimento de Urna",
};

export const PAPEL_EQUIPE_LABEL: Record<PapelEquipe, string> = {
  responsavel: "Responsável",
  membro: "Membro",
};

export const TIPO_ATIVIDADE_LABEL: Record<TipoAtividade, string> = {
  instalacao: "Instalação de Urna",
  verificacao: "Montagem de Seção",
  recolhimento_midia: "Recolhimento de Mídia",
  recolhimento_urna: "Recolhimento de Urna",
};

export const STATUS_ATIVIDADE_LABEL: Record<StatusAtividade, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  atrasado: "Atrasado",
};

/** Janela (minutos) para destacar atividades com horário próximo (PRD 4.6). */
export const ALERTA_PROXIMO_MINUTOS = 30;
