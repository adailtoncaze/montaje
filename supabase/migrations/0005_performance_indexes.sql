-- MontaJE — Migração 0005: índices de desempenho.
-- Os índices de atividades (local_id, equipe_id, data_hora_planejada) já
-- existem desde a 0001. Aqui entram os que faltam para filtros e listagens
-- ordenadas por nome. Todos usam IF NOT EXISTS (idempotentes).

-- Filtros de status/tipo no painel e relatórios
create index if not exists idx_atividades_status
  on atividades (status);

create index if not exists idx_atividades_tipo
  on atividades (tipo);

-- Listagens ordenadas por nome (equipes, locais, colaboradores)
create index if not exists idx_equipes_nome
  on equipes (nome);

create index if not exists idx_locais_votacao_nome
  on locais_votacao (nome);

create index if not exists idx_colaboradores_nome
  on colaboradores (nome);