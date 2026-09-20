-- MontaJE — Migração 0004: data_hora_planejada como horário de parede (sem timezone)
-- Data: 2026-09-20
-- Descrição: corrige o deslocamento de 1 dia nas datas do cronograma.
--
-- O problema: atividades tinham data_hora_planejada como timestamptz (UTC).
-- O frontend enviava "YYYY-MM-DDTHH:mm:ss" sem offset e o Postgres interpretava
-- como UTC. Como o Brasil é UTC-3, horários entre 00:00 e 02:59 (e datas digitadas
-- sem hora) eram exibidos no dia anterior (ex: 02/10 virava 01/10).
--
-- Solução: a coluna passa a ser `timestamp without time zone`, guardando
-- literalmente a data/hora escolhida no formulário (horário de parede),
-- sem conversões de fuso.
--
-- Observação: o Postgres não permite alterar o tipo de uma coluna usada por uma
-- view (rule _RETURN). Por isso a view atividades_com_status é DROPada ANTES do
-- ALTER TABLE e recriada DEPOIS, com a comparação já usando horário de São Paulo.

-- 1. Remove a view que depende da coluna (necessário antes de alterar o tipo)
drop view if exists atividades_com_status;

-- 2. Converte data_hora_planejada preservando o calendário/hora digitados
--    (valor UTC literal vira horário de parede).
alter table atividades
  alter column data_hora_planejada type timestamp using data_hora_planejada at time zone 'UTC';

-- 3. Recria a view atividades_com_status: compara horário de parede com "agora" em São Paulo
create view atividades_com_status with (security_invoker = true) as
select
  a.*,
  case
    when a.status in ('pendente', 'em_andamento') and a.data_hora_planejada < (now() at time zone 'America/Sao_Paulo')
      then 'atrasado'::status_atividade
    else a.status
  end as status_efetivo
from atividades a;

-- 4. Trigger de cálculo de horários: coluna agora é timestamp sem zona
--    (não há mais conversão via America/Sao_Paulo).
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
    new.inicio_planejado := new.data_hora_planejada::time;
    new.fim_planejado := new.inicio_planejado + (new.duracao_minutos || ' minutes')::interval;
  end if;

  return new;
end;
$$;