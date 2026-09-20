/**
 * Tipos de domínio derivados do PRD (seção 3).
 * Depois de aplicar a migration, gere os tipos reais com:
 *   npx supabase gen types typescript --project-id <id> > src/types/supabase.ts
 */

export type PerfilUsuario = "admin" | "servidor_zona";
export type TipoEquipe =
  | "instalacao"
  | "verificacao"
  | "recolhimento_midia"
  | "recolhimento_urna";
export type PapelEquipe = "responsavel" | "membro";
export type TipoAtividade =
  | "instalacao"
  | "verificacao"
  | "recolhimento_midia"
  | "recolhimento_urna";
export type StatusAtividade =
  | "pendente"
  | "em_andamento"
  | "concluido"
  | "atrasado";

export interface Perfil {
  id: string;
  nome: string | null;
  perfil: PerfilUsuario;
}

export interface ConfiguracaoEleicao {
  id: string;
  ano: number;
  turno: 1 | 2;
  data_montagem_sexta: string; // ISO date
  data_montagem_sabado: string;
  data_eleicao: string;
  zona_eleitoral: string;
  ativa: boolean;
}

export interface LocalVotacao {
  id: string;
  nome: string;
  municipio: string;
  qtd_secoes: number;
  endereco: string | null;
  lat_origem: string | null;
}

export interface Colaborador {
  id: string;
  nome: string;
  funcao: string;
  telefone: string | null;
}

export interface Equipe {
  id: string;
  nome: string;
  tipo: TipoEquipe;
  lat_origem: string | null;
}

export interface EquipeColaborador {
  equipe_id: string;
  colaborador_id: string;
  papel: PapelEquipe;
}

export interface Atividade {
  id: string;
  local_id: string;
  equipe_id: string;
  tipo: TipoAtividade;
  data_hora_planejada: string; // ISO timestamptz
  data_hora_real: string | null;
  status: StatusAtividade;
  observacoes: string | null;
  atualizado_por: string | null;
  atualizado_em: string;
}

/** Linha da view `atividades_com_status` (status_efetivo calcula "atrasado"). */
export interface AtividadeComStatus extends Atividade {
  status_efetivo: StatusAtividade;
}
