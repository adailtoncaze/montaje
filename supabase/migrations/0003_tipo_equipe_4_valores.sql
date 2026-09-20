-- MontaJE — Migração 0003: Atualiza tipo_equipe para 4 valores (match com tipo_atividade)
-- Data: 2026-09-20
-- Descrição: Altera tipo_equipe de 2 para 4 valores para corresponder aos tipos de atividade.
-- Abordagem segura: adiciona nova coluna, migra dados, remove coluna antiga.

-- ============================================================
-- 1. Cria novo enum com os 4 valores
-- ============================================================
create type tipo_equipe_novo as enum (
  'instalacao',
  'verificacao',
  'recolhimento_midia',
  'recolhimento_urna'
);

-- ============================================================
-- 2. Adiciona nova coluna temporária com o novo enum
-- ============================================================
alter table equipes add column tipo_novo tipo_equipe_novo;

-- ============================================================
-- 3. Migra dados existentes para a nova coluna
-- ============================================================
-- 'montagem' -> 'instalacao' (padrão para equipes de montagem)
-- 'recolhimento' -> 'recolhimento_midia' (padrão para equipes de recolhimento)
update equipes
set tipo_novo = case tipo
  when 'montagem' then 'instalacao'::tipo_equipe_novo
  when 'recolhimento' then 'recolhimento_midia'::tipo_equipe_novo
  else 'instalacao'::tipo_equipe_novo
end;

-- ============================================================
-- 4. Remove coluna antiga e renomeia a nova
-- ============================================================
alter table equipes drop column tipo;
alter table equipes rename column tipo_novo to tipo;

-- ============================================================
-- 5. Define NOT NULL e default se necessário
-- ============================================================
alter table equipes alter column tipo set not null;

-- ============================================================
-- 5. Remove enum antigo e renomeia o novo
-- ============================================================
drop type tipo_equipe;
alter type tipo_equipe_novo rename to tipo_equipe;

-- ============================================================
-- 6. Atualiza comentários
-- ============================================================
comment on type tipo_equipe is 'Tipo de equipe: instalacao (Instalação da Urna), verificacao (Montagem da Seção), recolhimento_midia (Recolhimento de Mídia), recolhimento_urna (Recolhimento de Urna)';