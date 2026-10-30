// Simula o mínimo do ambiente Supabase dentro do PGlite
const fs = require('fs');
const path = require('path');

const PRELUDE = `
create schema if not exists auth;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.jwt() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
`;

async function setup(pg, schemaPath) {
  await pg.exec(PRELUDE);
  await pg.exec(fs.readFileSync(schemaPath, 'utf8'));
}
module.exports = { setup };
