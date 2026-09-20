-- MontaJE — schema inicial (PRD v1.0, seções 2, 3 e 6)

-- ---------- Enums ----------
create type perfil_usuario   as enum ('admin', 'servidor_zona');
create type tipo_equipe      as enum ('montagem', 'recolhimento');
create type papel_equipe     as enum ('responsavel', 'membro');
create type tipo_atividade   as enum ('instalacao', 'verificacao', 'recolhimento_midia', 'recolhimento_urna');
create type status_atividade as enum ('pendente', 'em_andamento', 'concluido', 'atrasado');

-- ---------- Tabelas ----------
create table perfis (
  id        uuid primary key references auth.users (id) on delete cascade,
  nome      text,
  perfil    perfil_usuario not null default 'servidor_zona',
  criado_em timestamptz not null default now()
);

create table configuracao_eleicao (
  id                   uuid primary key default gen_random_uuid(),
  ano                  int  not null,
  turno                int  not null check (turno in (1, 2)),
  data_montagem_sexta  date not null,
  data_montagem_sabado date not null,
  data_eleicao         date not null,
  zona_eleitoral       text not null,
  ativa                boolean not null default true,
  criado_em            timestamptz not null default now()
);
create unique index configuracao_eleicao_unica_ativa on configuracao_eleicao (ativa) where ativa;

create table locais_votacao (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  municipio  text not null,
  qtd_secoes int  not null check (qtd_secoes >= 0),
  endereco   text,
  lat_origem text,
  criado_em  timestamptz not null default now()
);
-- Duplicidade por nome + município (PRD 4.1)
create unique index locais_votacao_nome_municipio on locais_votacao (lower(nome), lower(municipio));

create table colaboradores (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  funcao    text not null,
  telefone  text,
  criado_em timestamptz not null default now()
);

create table equipes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  tipo       tipo_equipe not null,
  lat_origem text,
  criado_em  timestamptz not null default now()
);

create table equipe_colaboradores (
  equipe_id      uuid not null references equipes (id) on delete cascade,
  colaborador_id uuid not null references colaboradores (id) on delete cascade,
  papel          papel_equipe not null default 'membro',
  primary key (equipe_id, colaborador_id)
);
-- No máximo um responsável por equipe
create unique index equipe_um_responsavel on equipe_colaboradores (equipe_id) where papel = 'responsavel';

create table atividades (
  id                  uuid primary key default gen_random_uuid(),
  local_id            uuid not null references locais_votacao (id) on delete cascade,
  equipe_id           uuid not null references equipes (id) on delete restrict,
  tipo                tipo_atividade not null,
  data_hora_planejada timestamptz not null,
  data_hora_real      timestamptz,
  status              status_atividade not null default 'pendente',
  observacoes         text,
  atualizado_por      uuid references auth.users (id),
  atualizado_em       timestamptz not null default now()
);
create index atividades_local  on atividades (local_id);
create index atividades_equipe on atividades (equipe_id);
create index atividades_planejada on atividades (data_hora_planejada);

-- Status "Atrasado" calculado (PRD 4.3)
create view atividades_com_status with (security_invoker = true) as
select
  a.*,
  case
    when a.status in ('pendente', 'em_andamento') and a.data_hora_planejada < now()
      then 'atrasado'::status_atividade
    else a.status
  end as status_efetivo
from atividades a;

-- ---------- Funções e triggers ----------
create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and perfil = 'admin');
$$;

-- Todo usuário novo entra como servidor_zona; promoção a admin é manual.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, nome) values (new.id, new.raw_user_meta_data ->> 'nome');
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Auditoria simples + servidor_zona só altera status/hora real/observações (PRD 6)
create function atividades_before_update() returns trigger
language plpgsql as $$
begin
  if not is_admin() then
    if (new.local_id, new.equipe_id, new.tipo, new.data_hora_planejada)
       is distinct from (old.local_id, old.equipe_id, old.tipo, old.data_hora_planejada) then
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
create trigger atividades_audit
  before update on atividades
  for each row execute function atividades_before_update();

-- ---------- RLS ----------
alter table perfis                enable row level security;
alter table configuracao_eleicao  enable row level security;
alter table locais_votacao        enable row level security;
alter table colaboradores         enable row level security;
alter table equipes               enable row level security;
alter table equipe_colaboradores  enable row level security;
alter table atividades            enable row level security;

-- perfis: cada um lê o próprio; admin lê e altera todos
create policy perfis_select on perfis for select to authenticated
  using (id = auth.uid() or is_admin());
create policy perfis_admin_update on perfis for update to authenticated
  using (is_admin()) with check (is_admin());

-- Dados mestres: leitura para autenticados, escrita só admin
do $$
declare t text;
begin
  foreach t in array array['configuracao_eleicao','locais_votacao','colaboradores','equipes','equipe_colaboradores']
  loop
    execute format('create policy %I on %I for select to authenticated using (true)', t || '_select', t);
    execute format('create policy %I on %I for all to authenticated using (is_admin()) with check (is_admin())', t || '_admin_all', t);
  end loop;
end $$;

-- Atividades: leitura para autenticados; admin faz tudo; servidor_zona atualiza
-- (colunas protegidas pelo trigger atividades_before_update)
create policy atividades_select on atividades for select to authenticated using (true);
create policy atividades_admin_all on atividades for all to authenticated
  using (is_admin()) with check (is_admin());
create policy atividades_servidor_update on atividades for update to authenticated
  using (true) with check (true);

-- ---------- Realtime ----------
alter publication supabase_realtime add table atividades;
