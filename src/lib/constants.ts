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

/** Valores legados do tipo de equipe (pré-migração 0003) → tipos atuais. */
const TIPO_EQUIPE_LEGADO: Record<string, TipoEquipe> = {
  montagem: "instalacao",
  recolhimento: "recolhimento_midia",
};

/** Normaliza o tipo de equipe: aceita os 4 tipos atuais e valores legados. */
export function normalizarTipoEquipe(tipo: string): TipoEquipe {
  return TIPO_EQUIPE_LEGADO[tipo] ?? (tipo as TipoEquipe);
}

/** Rótulo do tipo de equipe (com fallback para o valor cru). */
export function rotuloTipoEquipe(tipo: string): string {
  return TIPO_EQUIPE_LABEL[normalizarTipoEquipe(tipo)] ?? tipo;
}

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

/** Nome oficial do sistema (cabeçalho do PDF e título da aba). */
export const NOME_SISTEMA =
  "Sistema de Gerenciamento de Cronograma de Montagem e Recolhimento";
