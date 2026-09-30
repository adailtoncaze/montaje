-- MontaJE — Migração 0006: recalcula a duração ao editar Início/Fim
-- Data: 2026-09-29
-- Descrição: corrige a coluna "Tempo" (duracao_minutos) dos relatórios.
--
-- O problema: o trigger `atividades_calcula_horarios` só calculava a duração
-- quando `new.duracao_minutos is null`. Num UPDATE, colunas omitidas no
-- payload mantêm o valor antigo — ou seja, ao editar só o Início/Fim a
-- duração NÃO era recalculada e continuava com o valor anterior. O relatório
-- mostrava, por exemplo, "09:00 – 12:00" com "2h" de tempo.
--
-- A aplicação (src/lib/utils/atividades.ts → montaPayloadAtividade) passou a
-- enviar `duracao_minutos` sempre, mesmo quando null. Esta migração deixa o
-- banco consistente também para quem editar por fora do app (SQL Editor,
-- scripts, integrações) e repara as durações já divergentes.

-- ============================================================
-- 1. Trigger que sempre reconcilia início / fim / duração
-- ============================================================
create or replace function atividades_calcula_horarios() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Início e fim informados: a duração é SEMPRE derivada deles.
  if new.inicio_planejado is not null and new.fim_planejado is not null then
    new.duracao_minutos :=
      floor(extract(epoch from (new.fim_planejado - new.inicio_planejado)) / 60)
      + case
          when extract(epoch from (new.fim_planejado - new.inicio_planejado)) / 60 < 0
            then 1440
          else 0
        end;

  -- Só o início informado: deriva o fim da duração gravada (padrão 120 min).
  elsif new.inicio_planejado is not null then
    if new.duracao_minutos is null or new.duracao_minutos <= 0 then
      new.duracao_minutos := 120;
    end if;
    new.fim_planejado := new.inicio_planejado + (new.duracao_minutos || ' minutes')::interval;

  -- Só a duração informada: deriva o início/fim a partir da data planejada.
  elsif new.duracao_minutos is not null then
    if new.duracao_minutos <= 0 then
      new.duracao_minutos := 120;
    end if;
    new.inicio_planejado := new.data_hora_planejada::time;
    new.fim_planejado := new.inicio_planejado + (new.duracao_minutos || ' minutes')::interval;
  end if;

  return new;
end;
$$;

-- ============================================================
-- 2. Recalcula as durações já gravadas (dados inconsistentes)
--
-- O trigger de auditoria (atividades_audit) exige is_admin() e lançaria
-- exceção nesta sessão de migração (sem auth.uid()). Ele é desativado
-- durante o backfill para não selar dados com um autor fictício — o
-- registro de quem editou é justamente o que não pode ser forjado aqui.
-- ============================================================
alter table atividades disable trigger atividades_audit;

update atividades a
set duracao_minutos = case
      when a.fim_planejado is null then coalesce(nullif(a.duracao_minutos, 0), 120)
      else floor(extract(epoch from (a.fim_planejado - a.inicio_planejado)) / 60)
           + case
               when extract(epoch from (a.fim_planejado - a.inicio_planejado)) / 60 < 0
                 then 1440
               else 0
             end
    end
where a.inicio_planejado is not null
  and coalesce(a.duracao_minutos, -1) <> case
        when a.fim_planejado is null then coalesce(nullif(a.duracao_minutos, 0), 120)
        else floor(extract(epoch from (a.fim_planejado - a.inicio_planejado)) / 60)
             + case
                 when extract(epoch from (a.fim_planejado - a.inicio_planejado)) / 60 < 0
                   then 1440
                 else 0
               end
      end;

alter table atividades enable trigger atividades_audit;
