import type { AtividadeCompleta } from "@/lib/actions/atividades";
import type { Tables } from "@/types/supabase";

/* ------------------------------------------------------------------ */
/*  Fábricas de dados para os testes                                   */
/* ------------------------------------------------------------------ */

export function makeLocal(
  over: Partial<Tables<"locais_votacao">> = {}
): Tables<"locais_votacao"> {
  return {
    id: "local-1",
    nome: "Escola Municipal Alpha",
    municipio: "João Pessoa",
    qtd_secoes: 10,
    endereco: "Rua A, 100",
    lat_origem: null,
    criado_em: "2026-01-01T00:00:00",
    ...over,
  };
}

export function makeEquipe(
  over: Partial<Tables<"equipes">> = {}
): Tables<"equipes"> {
  return {
    id: "equipe-1",
    nome: "Equipe Alpha",
    tipo: "instalacao",
    lat_origem: "GPS 1",
    criado_em: "2026-01-01T00:00:00",
    ...over,
  };
}

export function makeAtividade(
  over: Partial<AtividadeCompleta> = {}
): AtividadeCompleta {
  return {
    id: "atv-1",
    local_id: "local-1",
    equipe_id: "equipe-1",
    tipo: "instalacao",
    data_hora_planejada: "2026-10-02T08:00:00",
    data_hora_real: null,
    status: "pendente",
    observacoes: null,
    atualizado_por: null,
    atualizado_em: "2026-01-01T00:00:00",
    sequencia: 1,
    inicio_planejado: "08:00:00",
    fim_planejado: "10:00:00",
    duracao_minutos: 120,
    local: makeLocal(),
    equipe: makeEquipe(),
    ...over,
  };
}
