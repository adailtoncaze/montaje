/**
 * Tipos gerados do schema Supabase (derivados de 0001_init.sql).
 * Para regenerar automaticamente:
 *   npx supabase gen types typescript --project-id <id> > src/types/supabase.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      perfis: {
        Row: {
          id: string;
          nome: string | null;
          perfil: "admin" | "servidor_zona";
          criado_em: string;
        };
        Insert: {
          id: string;
          nome?: string | null;
          perfil?: "admin" | "servidor_zona";
          criado_em?: string;
        };
        Update: {
          id?: string;
          nome?: string | null;
          perfil?: "admin" | "servidor_zona";
          criado_em?: string;
        };
      };
      configuracao_eleicao: {
        Row: {
          id: string;
          ano: number;
          turno: number;
          data_montagem_sexta: string;
          data_montagem_sabado: string;
          data_eleicao: string;
          zona_eleitoral: string;
          ativa: boolean;
          criado_em: string;
        };
        Insert: {
          id?: string;
          ano: number;
          turno: number;
          data_montagem_sexta: string;
          data_montagem_sabado: string;
          data_eleicao: string;
          zona_eleitoral: string;
          ativa?: boolean;
          criado_em?: string;
        };
        Update: {
          id?: string;
          ano?: number;
          turno?: number;
          data_montagem_sexta?: string;
          data_montagem_sabado?: string;
          data_eleicao?: string;
          zona_eleitoral?: string;
          ativa?: boolean;
          criado_em?: string;
        };
      };
      locais_votacao: {
        Row: {
          id: string;
          nome: string;
          municipio: string;
          qtd_secoes: number;
          endereco: string | null;
          lat_origem: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          nome: string;
          municipio: string;
          qtd_secoes: number;
          endereco?: string | null;
          lat_origem?: string | null;
          criado_em?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          municipio?: string;
          qtd_secoes?: number;
          endereco?: string | null;
          lat_origem?: string | null;
          criado_em?: string;
        };
      };
      colaboradores: {
        Row: {
          id: string;
          nome: string;
          funcao: string;
          telefone: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          nome: string;
          funcao: string;
          telefone?: string | null;
          criado_em?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          funcao?: string;
          telefone?: string | null;
          criado_em?: string;
        };
      };
      equipes: {
        Row: {
          id: string;
          nome: string;
          tipo: "instalacao" | "verificacao" | "recolhimento_midia" | "recolhimento_urna";
          lat_origem: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          nome: string;
          tipo: "instalacao" | "verificacao" | "recolhimento_midia" | "recolhimento_urna";
          lat_origem?: string | null;
          criado_em?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          tipo?: "instalacao" | "verificacao" | "recolhimento_midia" | "recolhimento_urna";
          lat_origem?: string | null;
          criado_em?: string;
        };
      };
      equipe_colaboradores: {
        Row: {
          equipe_id: string;
          colaborador_id: string;
          papel: "responsavel" | "membro";
        };
        Insert: {
          equipe_id: string;
          colaborador_id: string;
          papel?: "responsavel" | "membro";
        };
        Update: {
          equipe_id?: string;
          colaborador_id?: string;
          papel?: "responsavel" | "membro";
        };
      };
      atividades: {
        Row: {
          id: string;
          local_id: string;
          equipe_id: string;
          tipo:
            | "instalacao"
            | "verificacao"
            | "recolhimento_midia"
            | "recolhimento_urna";
          data_hora_planejada: string;
          data_hora_real: string | null;
          status: "pendente" | "em_andamento" | "concluido" | "atrasado";
          observacoes: string | null;
          atualizado_por: string | null;
          atualizado_em: string;
          sequencia: number | null;
          inicio_planejado: string | null; // time format HH:MM:SS
          fim_planejado: string | null; // time format HH:MM:SS
          duracao_minutos: number | null;
        };
        Insert: {
          id?: string;
          local_id: string;
          equipe_id: string;
          tipo:
            | "instalacao"
            | "verificacao"
            | "recolhimento_midia"
            | "recolhimento_urna";
          data_hora_planejada: string;
          data_hora_real?: string | null;
          status?: "pendente" | "em_andamento" | "concluido" | "atrasado";
          observacoes?: string | null;
          atualizado_por?: string | null;
          atualizado_em?: string;
          sequencia?: number | null;
          inicio_planejado?: string | null;
          fim_planejado?: string | null;
          duracao_minutos?: number | null;
        };
        Update: {
          id?: string;
          local_id?: string;
          equipe_id?: string;
          tipo?:
            | "instalacao"
            | "verificacao"
            | "recolhimento_midia"
            | "recolhimento_urna";
          data_hora_planejada?: string;
          data_hora_real?: string | null;
          status?: "pendente" | "em_andamento" | "concluido" | "atrasado";
          observacoes?: string | null;
          atualizado_por?: string | null;
          atualizado_em?: string;
          sequencia?: number | null;
          inicio_planejado?: string | null;
          fim_planejado?: string | null;
          duracao_minutos?: number | null;
        };
      };
    };
    Views: {
      atividades_com_status: {
        Row: {
          id: string;
          local_id: string;
          equipe_id: string;
          tipo:
            | "instalacao"
            | "verificacao"
            | "recolhimento_midia"
            | "recolhimento_urna";
          data_hora_planejada: string;
          data_hora_real: string | null;
          status: "pendente" | "em_andamento" | "concluido" | "atrasado";
          observacoes: string | null;
          atualizado_por: string | null;
          atualizado_em: string;
          status_efetivo:
            | "pendente"
            | "em_andamento"
            | "concluido"
            | "atrasado";
        };
      };
    };
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      perfil_usuario: "admin" | "servidor_zona";
      tipo_equipe:
        | "instalacao"
        | "verificacao"
        | "recolhimento_midia"
        | "recolhimento_urna";
      papel_equipe: "responsavel" | "membro";
      tipo_atividade:
        | "instalacao"
        | "verificacao"
        | "recolhimento_midia"
        | "recolhimento_urna";
      status_atividade: "pendente" | "em_andamento" | "concluido" | "atrasado";
    };
  };
};

export type Tables<
  T extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<
  T extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<
  T extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][T]["Update"];

export type Views<
  T extends keyof Database["public"]["Views"],
> = Database["public"]["Views"][T]["Row"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
