-- MontaJE — Migração 0002: Detalhamento de atividades (sequência, horários, duração)
-- Data: 2026-09-19
-- Descrição: Adiciona campos de planejamento detalhado às atividades:
--   - sequencia: ordem de execução da atividade dentro do cronograma da equipe/dia
--   - inicio_planejado: horário de início planejado (time without time zone)
--   - fim_planejado: horário de fim planejado (time without time zone)
--   - duracao_minutos: duração estimada em minutos
-- Também renomeia os labels dos tipos de atividade para melhor clareza.

-- ============================================================
-- 1. Atualiza enum tipo_atividade (apenas labels, valores mantidos)
-- ============================================================
-- No PostgreSQL, não é possível renomear valores de enum diretamente.
-- Mantemos os valores originais ('instalacao', 'verificacao', 'recolhimento_midia', 'recolhimento_urna')
-- e atualizamos apenas os labels na aplicação (constants.ts).

-- ============================================================
-- 2. Adiciona novas colunas à tabela atividades
-- ============================================================
alter table atividades
  add column if not exists sequencia integer,
  add column if not exists inicio_planejado time,
  add column if not exists fim_planejado time,
  add column if not exists duracao_minutos integer;

-- Comentários para documentação
comment on column atividades.sequencia is 'Ordem de execução da atividade no cronograma da equipe/dia (1, 2, 3...)';
comment on column atividades.inicio_planejado is 'Horário de início planejado (ex: 08:00)';
comment on column atividades.fim_planejado is 'Horário de fim planejado (ex: 10:00)';
comment on column atividades.duracao_minutos is 'Duração estimada em minutos (ex: 120)';

-- Índice para ordenação por equipe + data + sequência
create index if not exists atividades_equipe_data_sequencia
  on atividades (equipe_id, data_hora_planejada, sequencia);

-- ============================================================
-- 3. Atualiza a view atividades_com_status (mantém compatibilidade)
-- ============================================================
drop view if exists atividades_com_status;

create view atividades_com_status with (security_invoker = true) as
select
  a.*,
  case
    when a.status in ('pendente', 'em_andamento') and a.data_hora_planejada < now()
      then 'atrasado'::status_atividade
    else a.status
  end as status_efetivo
from atividades a;

-- ============================================================
-- 4. Trigger: calcula fim_planejado e duracao_minutos automaticamente se não informados
-- ============================================================
create or replace function atividades_calcula_horarios() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Se inicio_planejado informado mas fim_planejado não, calcula fim com base na duração (padrão 120 min)
  if new.inicio_planejado is not null and new.fim_planejado is null and new.duracao_minutos is not null then
    new.fim_planejado := new.inicio_planejado + (new.duracao_minutos || ' minutes')::interval;
  end if;

  -- Se inicio_planejado e fim_planejado informados mas duracao não, calcula duração
  if new.inicio_planejado is not null and new.fim_planejado is not null and new.duracao_minutos is null then
    new.duracao_minutos := floor(extract(epoch from (new.fim_planejado - new.inicio_planejado)) / 60);
  end if;

  -- Se duracao informada mas inicio não, usa data_hora_planejada como referência
  if new.duracao_minutos is not null and new.inicio_planejado is null and new.fim_planejado is null then
    new.inicio_planejado := (new.data_hora_planejada at time zone 'America/Sao_Paulo')::time;
    new.fim_planejado := new.inicio_planejado + (new.duracao_minutos || ' minutes')::interval;
  end if;

  return new;
end;
$$;

drop trigger if exists atividades_calcula_horarios on atividades;
create trigger atividades_calcula_horarios
  before insert or update on atividades
  for each row execute function atividades_calcula_horarios();

-- ============================================================
-- 5. Trigger atualizado: protege também os novos campos de planejamento
-- ============================================================
create or replace function atividades_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    -- Protege campos de planejamento (incluindo novos)
    if (new.local_id, new.equipe_id, new.tipo, new.data_hora_planejada,
        new.sequencia, new.inicio_planejado, new.fim_planejado, new.duracao_minutos)
       is distinct from
       (old.local_id, old.equipe_id, old.tipo, old.data_hora_planejada,
        old.sequencia, old.inicio_planejado, old.fim_planejado, old.duracao_minutos) then
      raise exception 'Somente administradores podem alterar o planejamento da atividade.';
    end if;
  end if;

  if new.status = 'concluido' and new.data_hora_real is null then
    new.data_hora_real := now();
  end if;

  new.atualizado_por := auth.uid();
  new.atualizado_em  := now();
  return new;
end;
$$;

-- O trigger já existe, mas recriamos para pegar a nova versão da função
drop trigger if exists atividades_audit on atividades;
create trigger atividades_audit
  before update on atividades
  for each row execute function atividades_before_update();

-- ============================================================
-- 6. Realtime: já configurado na migração inicial
-- ============================================================