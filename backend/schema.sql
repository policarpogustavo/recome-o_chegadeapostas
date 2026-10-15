-- Esquema do banco do Recomeço (Postgres 15+; testado para o Supabase).
-- Pode ser executado mais de uma vez: só cria o que ainda não existe.
--
-- As tabelas ficam no schema "recomeco", fora do "public", para não serem
-- expostas pela Data API do Supabase. Além disso, o RLS fica ligado sem
-- nenhuma política e os papéis anon/authenticated não têm acesso: só o
-- servidor Java, conectado como dono das tabelas, lê e grava.
--
-- A coluna "seq" guarda a ordem de inserção, usada pelo servidor.

create schema if not exists recomeco;

-- ---------------------------------------------------------------- contas

create table if not exists recomeco.usuarios (
    seq        bigint generated always as identity,
    id         uuid primary key,
    usuario    text not null unique check (usuario ~ '^[a-z0-9_.]{3,24}$'),
    algoritmo  text,                       -- null = formato antigo (PBKDF2WithHmacSHA256)
    sal        text not null,
    iteracoes  integer not null,
    hash       text not null,
    criado_em  timestamptz not null default now()
);

create table if not exists recomeco.sessoes (
    seq        bigint generated always as identity,
    token_hash text primary key,           -- SHA-256 do token; o token em si nunca é gravado
    usuario_id uuid not null references recomeco.usuarios (id) on delete cascade,
    criada_em  timestamptz,
    expira     timestamptz not null
);
create index if not exists sessoes_usuario_idx on recomeco.sessoes (usuario_id);

create table if not exists recomeco.dados_usuarios (
    seq           bigint generated always as identity,
    usuario_id    uuid primary key references recomeco.usuarios (id) on delete cascade,
    dados         jsonb not null,           -- jornada, diário, vontades vencidas e recordes
    atualizado_em timestamptz not null
);

-- ---------------------------------------------------------------- avaliações

create table if not exists recomeco.avaliacoes (
    seq             bigint generated always as identity,
    id              uuid primary key,
    usuario_id      uuid references recomeco.usuarios (id) on delete cascade,
    ip_hash         text not null,          -- HMAC do IP; o IP nunca é gravado
    data            timestamptz not null,
    faixa_etaria    text not null,
    origem          text not null,
    tempo           text not null,
    tipos           jsonb not null,
    frequencia      text not null,
    gasto_mensal    double precision not null,
    dividas         text not null,
    esconde_familia text not null,
    arrependimento  double precision not null,
    dia_a_dia       jsonb not null,
    quer_ajuda      text not null,
    pgsi            jsonb not null,
    score           integer not null,
    nivel           text not null
);
create index if not exists avaliacoes_usuario_idx on recomeco.avaliacoes (usuario_id);

-- ---------------------------------------------------------------- mural (anônimo, sem ligação com contas)

create table if not exists recomeco.depoimentos (
    seq              bigint generated always as identity,
    id               uuid primary key,
    apelido          text not null,
    texto            text not null,
    tipo             text not null,
    dias_sem_apostar integer not null default 0,
    equipe           boolean not null default false,
    data             timestamptz not null
);

-- ---------------------------------------------------------------- acesso

alter table recomeco.usuarios       enable row level security;
alter table recomeco.sessoes        enable row level security;
alter table recomeco.dados_usuarios enable row level security;
alter table recomeco.avaliacoes     enable row level security;
alter table recomeco.depoimentos    enable row level security;

revoke all on schema recomeco from public;
revoke all on all tables in schema recomeco from public;

-- Papéis da Data API do Supabase (não existem num Postgres comum).
do $$
declare papel text;
begin
    foreach papel in array array['anon', 'authenticated'] loop
        if exists (select 1 from pg_roles where rolname = papel) then
            execute format('revoke all on schema recomeco from %I', papel);
            execute format('revoke all on all tables in schema recomeco from %I', papel);
            execute format('alter default privileges in schema recomeco revoke all on tables from %I', papel);
        end if;
    end loop;
end $$;
