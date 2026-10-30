-- =====================================================================
--  App de Agendamento de Treinamentos — estrutura do banco (Supabase)
--
--  Como usar: copie este arquivo inteiro, cole no "SQL Editor" do
--  Supabase e clique em "Run". Pode ser executado mais de uma vez.
--
--  No FINAL do arquivo, troque o e-mail do administrador.
-- =====================================================================


-- ---------------------------------------------------------------------
--  TABELAS
-- ---------------------------------------------------------------------

-- Quem pode entrar no painel administrativo (e-mails do Supabase Auth)
create table if not exists public.admins (
  email text primary key
);

-- Cadastro geral de colaboradores (importado por planilha)
create table if not exists public.colaboradores (
  id         uuid primary key default gen_random_uuid(),
  matricula  text not null unique,
  nome       text not null,
  loja       text,
  setor      text,
  cargo      text,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

-- Treinamentos (cada um tem um link próprio: ?t=<slug>)
--   modo_identificacao:
--     'nome'           -> colaborador escolhe o nome na lista
--     'matricula'      -> colaborador digita a matrícula
--     'nome_matricula' -> escolhe o nome e confirma com a matrícula
--     'livre'          -> digita nome e telefone (sem cadastro prévio)
create table if not exists public.treinamentos (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique,
  titulo                 text not null,
  descricao              text,
  modo_identificacao     text not null default 'nome_matricula'
                         check (modo_identificacao in ('nome', 'matricula', 'nome_matricula', 'livre')),
  somente_convidados     boolean not null default true,
  horas_limite_alteracao integer not null default 24 check (horas_limite_alteracao >= 0),
  lista_espera           boolean not null default true,
  ativo                  boolean not null default true,
  criado_em              timestamptz not null default now()
);

-- Turmas (datas/horários/locais de cada treinamento)
create table if not exists public.turmas (
  id             uuid primary key default gen_random_uuid(),
  treinamento_id uuid not null references public.treinamentos(id) on delete cascade,
  inicio         timestamptz not null,
  fim            timestamptz,
  local          text not null,
  endereco       text,
  vagas          integer not null check (vagas >= 0),
  observacao     text,
  criado_em      timestamptz not null default now()
);
create index if not exists turmas_treinamento_idx on public.turmas (treinamento_id, inicio);

-- Quem foi convidado/convocado para cada treinamento
create table if not exists public.convites (
  treinamento_id uuid not null references public.treinamentos(id) on delete cascade,
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  criado_em      timestamptz not null default now(),
  primary key (treinamento_id, colaborador_id)
);

-- Inscrições. Nunca são apagadas pelo app: ao cancelar/trocar, o status
-- vira 'cancelada' (fica o histórico).
create table if not exists public.inscricoes (
  id             uuid primary key default gen_random_uuid(),
  treinamento_id uuid not null references public.treinamentos(id) on delete cascade,
  turma_id       uuid not null references public.turmas(id) on delete cascade,
  colaborador_id uuid references public.colaboradores(id) on delete cascade,
  nome_livre     text,
  contato        text,            -- telefone, só dígitos (modo 'livre')
  status         text not null default 'confirmada'
                 check (status in ('confirmada', 'espera', 'cancelada')),
  presenca       boolean,         -- null = não marcado
  origem         text not null default 'link' check (origem in ('link', 'admin')),
  criado_em      timestamptz not null default now(),
  cancelado_em   timestamptz,
  check (colaborador_id is not null or (nome_livre is not null and contato is not null))
);
-- Cada pessoa só pode ter UMA inscrição ativa por treinamento
create unique index if not exists inscricoes_ativa_colaborador
  on public.inscricoes (treinamento_id, colaborador_id)
  where status <> 'cancelada' and colaborador_id is not null;
create unique index if not exists inscricoes_ativa_contato
  on public.inscricoes (treinamento_id, contato)
  where status <> 'cancelada' and colaborador_id is null;
create index if not exists inscricoes_turma_idx on public.inscricoes (turma_id, status);
create index if not exists inscricoes_treinamento_idx on public.inscricoes (treinamento_id);


-- ---------------------------------------------------------------------
--  SEGURANÇA (Row Level Security)
--  O público NÃO lê as tabelas diretamente: só usa as funções pub_*.
--  O painel lê/grava tudo, desde que o e-mail logado esteja em "admins".
-- ---------------------------------------------------------------------

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

alter table public.admins        enable row level security;
alter table public.colaboradores enable row level security;
alter table public.treinamentos  enable row level security;
alter table public.turmas        enable row level security;
alter table public.convites      enable row level security;
alter table public.inscricoes    enable row level security;

drop policy if exists admins_select on public.admins;
create policy admins_select on public.admins for select to authenticated using (public.is_admin());

drop policy if exists admin_all on public.colaboradores;
create policy admin_all on public.colaboradores for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.treinamentos;
create policy admin_all on public.treinamentos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.turmas;
create policy admin_all on public.turmas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.convites;
create policy admin_all on public.convites for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all on public.inscricoes;
create policy admin_all on public.inscricoes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());


-- ---------------------------------------------------------------------
--  LISTA DE ESPERA: promoção automática
--  Sempre que uma vaga confirmada é liberada (cancelamento, troca de
--  turma) ou o número de vagas aumenta, o primeiro da fila é confirmado.
-- ---------------------------------------------------------------------

create or replace function public.promover_espera(p_turma uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_vagas    integer;
  v_ocupadas integer;
  v_id       uuid;
begin
  select vagas into v_vagas from turmas where id = p_turma for update;
  if not found then
    return;
  end if;
  loop
    select count(*) into v_ocupadas from inscricoes where turma_id = p_turma and status = 'confirmada';
    exit when v_ocupadas >= v_vagas;
    select id into v_id from inscricoes
      where turma_id = p_turma and status = 'espera'
      order by criado_em, id
      limit 1;
    exit when v_id is null;
    update inscricoes set status = 'confirmada' where id = v_id;
  end loop;
end $$;

create or replace function public.trg_inscricoes_antes() returns trigger
language plpgsql as $$
begin
  if new.status = 'cancelada' and old.status <> 'cancelada' then
    new.cancelado_em := now();
  elsif new.status <> 'cancelada' then
    new.cancelado_em := null;
  end if;
  return new;
end $$;

create or replace function public.trg_inscricoes_depois() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'confirmada' and (new.status <> 'confirmada' or new.turma_id <> old.turma_id) then
    perform promover_espera(old.turma_id);
  end if;
  return null;
end $$;

create or replace function public.trg_turmas_vagas() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.vagas > old.vagas then
    perform promover_espera(new.id);
  end if;
  return null;
end $$;

drop trigger if exists inscricoes_antes on public.inscricoes;
create trigger inscricoes_antes before update on public.inscricoes
  for each row execute function public.trg_inscricoes_antes();

drop trigger if exists inscricoes_depois on public.inscricoes;
create trigger inscricoes_depois after update on public.inscricoes
  for each row execute function public.trg_inscricoes_depois();

drop trigger if exists turmas_vagas on public.turmas;
create trigger turmas_vagas after update of vagas on public.turmas
  for each row execute function public.trg_turmas_vagas();


-- ---------------------------------------------------------------------
--  FUNÇÕES INTERNAS (usadas pelas funções públicas)
-- ---------------------------------------------------------------------

-- Normaliza matrícula: sem espaços, maiúscula, sem zeros à esquerda
create or replace function public._norm_mat(p text) returns text
language sql immutable as $$
  select ltrim(upper(regexp_replace(coalesce(p, ''), '\s', '', 'g')), '0');
$$;

create or replace function public._pub_treinamento(p_slug text) returns public.treinamentos
language plpgsql security definer set search_path = public as $$
declare
  t treinamentos;
begin
  select * into t from treinamentos where slug = p_slug and ativo;
  if not found then
    raise exception 'Treinamento não encontrado ou encerrado.';
  end if;
  return t;
end $$;

-- Valida a identificação da pessoa de acordo com o modo do treinamento
create or replace function public._pub_pessoa(
  t public.treinamentos, p_colaborador uuid, p_matricula text, p_nome text, p_contato text,
  out r_colaborador uuid, out r_nome text, out r_contato text)
language plpgsql security definer set search_path = public as $$
declare
  c colaboradores;
begin
  if t.modo_identificacao = 'livre' then
    r_nome := nullif(regexp_replace(trim(coalesce(p_nome, '')), '\s+', ' ', 'g'), '');
    r_contato := regexp_replace(coalesce(p_contato, ''), '\D', '', 'g');
    if r_nome is null or length(r_nome) < 3 then
      raise exception 'Informe seu nome completo.';
    end if;
    if length(r_contato) < 10 then
      raise exception 'Informe um telefone válido, com DDD.';
    end if;
    return;
  end if;

  if t.modo_identificacao in ('matricula', 'nome_matricula') and _norm_mat(p_matricula) = '' then
    raise exception 'Informe sua matrícula.';
  end if;

  if t.modo_identificacao = 'matricula' then
    select * into c from colaboradores
      where ativo and _norm_mat(matricula) = _norm_mat(p_matricula)
      order by (matricula = trim(p_matricula)) desc
      limit 1;
  else
    if p_colaborador is null then
      raise exception 'Selecione o seu nome na lista.';
    end if;
    select * into c from colaboradores where id = p_colaborador and ativo;
  end if;

  if not found then
    raise exception 'Colaborador não encontrado. Confira os dados ou procure o responsável pelo treinamento.';
  end if;
  if t.modo_identificacao = 'nome_matricula' and _norm_mat(c.matricula) <> _norm_mat(p_matricula) then
    raise exception 'A matrícula não confere com o nome selecionado.';
  end if;
  if t.somente_convidados and not exists (
       select 1 from convites v where v.treinamento_id = t.id and v.colaborador_id = c.id) then
    raise exception 'Você não está na lista de participantes deste treinamento. Procure o responsável.';
  end if;

  r_colaborador := c.id;
  r_nome := c.nome;
end $$;

create or replace function public._pub_inscricao_ativa(p_treinamento uuid, p_colaborador uuid, p_contato text)
returns public.inscricoes
language sql security definer set search_path = public as $$
  select * from inscricoes
  where treinamento_id = p_treinamento
    and status <> 'cancelada'
    and ((p_colaborador is not null and colaborador_id = p_colaborador)
      or (p_colaborador is null and colaborador_id is null and contato = p_contato))
  limit 1;
$$;

create or replace function public._pub_turma_json(t public.treinamentos, tu public.turmas) returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'id', tu.id, 'inicio', tu.inicio, 'fim', tu.fim, 'local', tu.local,
    'endereco', tu.endereco, 'observacao', tu.observacao, 'vagas', tu.vagas,
    'ocupadas', (select count(*) from inscricoes i where i.turma_id = tu.id and i.status = 'confirmada'),
    'espera',   (select count(*) from inscricoes i where i.turma_id = tu.id and i.status = 'espera'),
    'aberta',   tu.inicio > now(),
    'alteravel', tu.inicio - make_interval(hours => t.horas_limite_alteracao) > now()
  );
$$;

-- Monta a resposta padrão: quem é a pessoa e qual a inscrição atual dela
create or replace function public._pub_resposta(
  t public.treinamentos, p_colaborador uuid, p_nome text, p_contato text, p_mensagem text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  i       inscricoes;
  tu      turmas;
  v_pos   integer;
begin
  i := _pub_inscricao_ativa(t.id, p_colaborador, p_contato);
  if i.id is null then
    return jsonb_build_object('pessoa', jsonb_build_object('nome', p_nome),
                              'inscricao', null, 'mensagem', p_mensagem);
  end if;

  select * into tu from turmas where id = i.turma_id;
  if i.status = 'espera' then
    select count(*) into v_pos from inscricoes
      where turma_id = i.turma_id and status = 'espera' and (criado_em, id) <= (i.criado_em, i.id);
  end if;

  return jsonb_build_object(
    'pessoa', jsonb_build_object('nome', p_nome),
    'mensagem', p_mensagem,
    'inscricao', jsonb_build_object(
      'id', i.id,
      'status', i.status,
      'turma_id', i.turma_id,
      'posicao_espera', v_pos,
      'alteravel', i.status = 'espera'
                   or tu.inicio - make_interval(hours => t.horas_limite_alteracao) > now(),
      'turma', _pub_turma_json(t, tu)));
end $$;


-- ---------------------------------------------------------------------
--  FUNÇÕES PÚBLICAS (chamadas pela página de inscrição, sem login)
-- ---------------------------------------------------------------------

-- Lista os treinamentos ativos que têm turmas futuras
create or replace function public.pub_listar_treinamentos() returns jsonb
language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x ->> 'proxima'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'slug', t.slug, 'titulo', t.titulo, 'descricao', t.descricao,
      'proxima', min(tu.inicio), 'turmas', count(tu.id)) as x
    from treinamentos t
    join turmas tu on tu.treinamento_id = t.id and tu.inicio > now()
    where t.ativo
    group by t.id
  ) s;
$$;

-- Dados de um treinamento: turmas futuras, vagas e (se for o caso) a lista de nomes
create or replace function public.pub_treinamento(p_slug text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t        treinamentos;
  v_turmas jsonb;
  v_pessoas jsonb;
begin
  t := _pub_treinamento(p_slug);

  select coalesce(jsonb_agg(_pub_turma_json(t, tu) order by tu.inicio), '[]'::jsonb)
    into v_turmas
    from turmas tu
    where tu.treinamento_id = t.id and tu.inicio > now();

  if t.modo_identificacao in ('nome', 'nome_matricula') then
    select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'loja', c.loja, 'setor', c.setor)
                              order by c.nome), '[]'::jsonb)
      into v_pessoas
      from colaboradores c
      where c.ativo
        and (not t.somente_convidados
             or exists (select 1 from convites v where v.treinamento_id = t.id and v.colaborador_id = c.id));
  end if;

  return jsonb_build_object(
    'treinamento', jsonb_build_object(
      'titulo', t.titulo, 'descricao', t.descricao,
      'modo_identificacao', t.modo_identificacao,
      'horas_limite_alteracao', t.horas_limite_alteracao,
      'lista_espera', t.lista_espera),
    'turmas', v_turmas,
    'pessoas', v_pessoas);
end $$;

-- Identifica a pessoa e devolve a inscrição atual (se houver)
create or replace function public.pub_consultar(
  p_slug text, p_colaborador uuid default null, p_matricula text default null,
  p_nome text default null, p_contato text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t treinamentos;
  p record;
begin
  t := _pub_treinamento(p_slug);
  select * into p from _pub_pessoa(t, p_colaborador, p_matricula, p_nome, p_contato);
  return _pub_resposta(t, p.r_colaborador, p.r_nome, p.r_contato);
end $$;

-- Inscreve (ou troca de turma). Se a turma estiver lotada e o treinamento
-- tiver lista de espera, entra na fila.
create or replace function public.pub_inscrever(
  p_slug text, p_turma uuid, p_colaborador uuid default null, p_matricula text default null,
  p_nome text default null, p_contato text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t          treinamentos;
  p          record;
  tu         turmas;
  atual      inscricoes;
  v_inicio   timestamptz;
  v_ocupadas integer;
  v_status   text;
begin
  t := _pub_treinamento(p_slug);
  select * into p from _pub_pessoa(t, p_colaborador, p_matricula, p_nome, p_contato);

  -- trava a turma para não estourar as vagas com inscrições simultâneas
  select * into tu from turmas where id = p_turma and treinamento_id = t.id for update;
  if not found then
    raise exception 'Turma não encontrada.';
  end if;
  if tu.inicio <= now() then
    raise exception 'As inscrições para esta turma já foram encerradas.';
  end if;

  atual := _pub_inscricao_ativa(t.id, p.r_colaborador, p.r_contato);
  if atual.id is not null then
    if atual.turma_id = p_turma then
      return _pub_resposta(t, p.r_colaborador, p.r_nome, p.r_contato, 'Você já está nesta turma.');
    end if;
    if atual.status = 'confirmada' then
      select inicio into v_inicio from turmas where id = atual.turma_id;
      if v_inicio - make_interval(hours => t.horas_limite_alteracao) <= now() then
        raise exception 'O prazo para trocar de turma terminou (até % horas antes do início). Procure o responsável pelo treinamento.',
          t.horas_limite_alteracao;
      end if;
    end if;
  end if;

  select count(*) into v_ocupadas from inscricoes where turma_id = tu.id and status = 'confirmada';
  if v_ocupadas >= tu.vagas then
    if not t.lista_espera then
      raise exception 'Esta turma está lotada. Escolha outra turma.';
    end if;
    v_status := 'espera';
  else
    v_status := 'confirmada';
  end if;

  if atual.id is not null then
    update inscricoes set status = 'cancelada' where id = atual.id;
  end if;

  insert into inscricoes (treinamento_id, turma_id, colaborador_id, nome_livre, contato, status, origem)
  values (t.id, tu.id, p.r_colaborador,
          case when p.r_colaborador is null then p.r_nome end,
          p.r_contato, v_status, 'link');

  return _pub_resposta(t, p.r_colaborador, p.r_nome, p.r_contato,
    case when v_status = 'confirmada' then 'Inscrição confirmada!'
         else 'Turma lotada: você entrou na lista de espera.' end);
end $$;

-- Cancela a inscrição atual (respeitando o prazo)
create or replace function public.pub_cancelar(
  p_slug text, p_colaborador uuid default null, p_matricula text default null,
  p_nome text default null, p_contato text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t        treinamentos;
  p        record;
  atual    inscricoes;
  v_inicio timestamptz;
begin
  t := _pub_treinamento(p_slug);
  select * into p from _pub_pessoa(t, p_colaborador, p_matricula, p_nome, p_contato);
  atual := _pub_inscricao_ativa(t.id, p.r_colaborador, p.r_contato);
  if atual.id is null then
    raise exception 'Você não possui inscrição ativa neste treinamento.';
  end if;
  if atual.status = 'confirmada' then
    select inicio into v_inicio from turmas where id = atual.turma_id;
    if v_inicio - make_interval(hours => t.horas_limite_alteracao) <= now() then
      raise exception 'O prazo para cancelar terminou (até % horas antes do início). Procure o responsável pelo treinamento.',
        t.horas_limite_alteracao;
    end if;
  end if;
  update inscricoes set status = 'cancelada' where id = atual.id;
  return _pub_resposta(t, p.r_colaborador, p.r_nome, p.r_contato, 'Inscrição cancelada.');
end $$;


-- ---------------------------------------------------------------------
--  PERMISSÕES DAS FUNÇÕES
-- ---------------------------------------------------------------------

revoke all on function public.promover_espera(uuid) from public, anon, authenticated;
revoke all on function public._pub_treinamento(text) from public, anon, authenticated;
revoke all on function public._pub_pessoa(public.treinamentos, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public._pub_inscricao_ativa(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public._pub_turma_json(public.treinamentos, public.turmas) from public, anon, authenticated;
revoke all on function public._pub_resposta(public.treinamentos, uuid, text, text, text) from public, anon, authenticated;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.pub_listar_treinamentos() to anon, authenticated;
grant execute on function public.pub_treinamento(text) to anon, authenticated;
grant execute on function public.pub_consultar(text, uuid, text, text, text) to anon, authenticated;
grant execute on function public.pub_inscrever(text, uuid, uuid, text, text, text) to anon, authenticated;
grant execute on function public.pub_cancelar(text, uuid, text, text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
--  ADMINISTRADOR
--  Troque pelo(s) e-mail(s) que vão acessar o painel. O usuário também
--  precisa ser criado em Authentication > Users (veja o README).
-- ---------------------------------------------------------------------

insert into public.admins (email) values ('SEU-EMAIL-AQUI@exemplo.com')
on conflict do nothing;
