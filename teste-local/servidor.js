// Servidor de TESTE LOCAL: imita o Supabase no seu computador (dados em memória, somem ao fechar).
// Não é usado em produção. Veja LEIA-ME.md.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');
const { setup } = require('./prelude');

const ROOT = path.resolve(__dirname, '..');
const PORT = 5599;
const ADMIN = 'admin@teste.com';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = email => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', email, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 })}.sig`;
const user = email => ({ id: 'u1', aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });

const ident = s => '"' + s.replace(/"/g, '') + '"';

(async () => {
  const pg = new PGlite();
  await setup(pg, path.join(ROOT, 'supabase', 'schema.sql'));
  await pg.exec(`insert into admins values ('${ADMIN}') on conflict do nothing`);
  await seed(pg);

  http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Expose-Headers': '*' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    const body = await new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); });
    const send = (code, obj, extra = {}) => {
      res.writeHead(code, { 'Content-Type': 'application/json', ...cors, ...extra });
      res.end(obj === undefined ? '' : JSON.stringify(obj));
    };
    try {
      if (url.pathname.startsWith('/auth/v1/')) return auth(url, body, req, send);
      if (url.pathname.startsWith('/rest/v1/')) return await rest(pg, url, body, req, send);
      // estáticos
      let file = path.join(ROOT, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end('404'); }
      let content = fs.readFileSync(file);
      if (file.endsWith('config.js')) {
        // usa o config.js real (nome, cor, logo), trocando só o endereço do banco pelo servidor de teste
        content = content.toString()
          .replace(/SUPABASE_URL:\s*'[^']*'/, `SUPABASE_URL: 'http://localhost:${PORT}'`)
          .replace(/SUPABASE_ANON_KEY:\s*'[^']*'/, `SUPABASE_ANON_KEY: 'anon-teste'`);
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(content);
    } catch (e) {
      console.error(req.method, req.url, e.message);
      send(400, { code: e.code || 'P0001', message: e.message, details: null, hint: null });
    }
  }).listen(PORT, '127.0.0.1', () => {
    console.log('App de teste rodando! Abra no navegador:');
    console.log('  Inscrição: http://localhost:' + PORT + '/index.html?t=gestao-agil-de-projetos-ab12');
    console.log('  Painel:    http://localhost:' + PORT + '/admin.html');
    console.log('Para encerrar, feche esta janela.');
    if (process.env.ABRIR) {
      const { exec } = require('child_process');
      exec('start "" "http://localhost:' + PORT + '/admin.html"');
      exec('start "" "http://localhost:' + PORT + '/index.html?t=gestao-agil-de-projetos-ab12"');
    }
  });
})();

function auth(url, body, req, send) {
  const p = url.pathname.replace('/auth/v1/', '');
  if (p === 'token') {
    const { email, password } = JSON.parse(body || '{}');
    if (password !== 'senha123') return send(400, { error: 'invalid_grant', error_description: 'Invalid login credentials', message: 'Invalid login credentials', code: 'invalid_credentials' });
    return send(200, { access_token: jwt(email), token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, refresh_token: 'r', user: user(email) });
  }
  if (p === 'user') {
    const tok = (req.headers.authorization || '').split(' ')[1];
    const email = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url')).email;
    return send(200, user(email));
  }
  if (p === 'logout') return send(204);
  if (p === 'recover') return send(200, {});
  send(404, { message: 'nao implementado ' + p });
}

function claims(req) {
  const tok = (req.headers.authorization || '').split(' ')[1] || '';
  try { return JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()); } catch { return {}; }
}

async function comoUsuario(pg, req, fn) {
  const c = claims(req);
  return pg.transaction(async tx => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(c)]);
    await tx.query(`set local role ${c.email ? 'authenticated' : 'anon'}`);
    return fn(tx);
  });
}

function filtros(url, params) {
  const where = [];
  for (const [k, v] of url.searchParams) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
    const [op, ...resto] = v.split('.');
    const val = resto.join('.');
    if (op === 'eq') { params.push(val); where.push(`${ident(k)}::text = $${params.length}`); }
    else if (op === 'neq') { params.push(val); where.push(`${ident(k)}::text <> $${params.length}`); }
    else if (op === 'in') {
      const itens = val.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, ''));
      params.push(itens); where.push(`${ident(k)}::text = any($${params.length})`);
    } else if (op === 'is') { where.push(`${ident(k)} is ${val === 'null' ? 'null' : val}`); }
    else throw new Error('filtro nao suportado: ' + k + '=' + v);
  }
  return where.length ? ' where ' + where.join(' and ') : '';
}

async function rest(pg, url, body, req, send) {
  const alvo = url.pathname.replace('/rest/v1/', '');
  const prefer = req.headers['prefer'] || '';
  const single = (req.headers['accept'] || '').includes('vnd.pgrst.object');

  if (alvo.startsWith('rpc/')) {
    const fn = alvo.slice(4);
    const args = JSON.parse(body || '{}');
    const ks = Object.keys(args);
    const sql = `select public.${ident(fn)}(${ks.map((k, i) => `${ident(k)} => $${i + 1}`).join(', ')}) as r`;
    const rows = await comoUsuario(pg, req, tx => tx.query(sql, ks.map(k => args[k])));
    return send(200, rows.rows[0].r);
  }

  const tabela = 'public.' + ident(alvo);
  const params = [];
  let sql;
  if (req.method === 'GET') {
    const sel = url.searchParams.get('select') || '*';
    const cols = sel === '*' ? '*' : sel.split(',').map(ident).join(',');
    sql = `select ${cols} from ${tabela}` + filtros(url, params);
    const order = url.searchParams.get('order');
    if (order) sql += ' order by ' + order.split(',').map(o => { const [c, d] = o.split('.'); return ident(c) + (d === 'desc' ? ' desc' : ' asc'); }).join(',');
    if (url.searchParams.get('limit')) sql += ` limit ${+url.searchParams.get('limit')}`;
    if (url.searchParams.get('offset')) sql += ` offset ${+url.searchParams.get('offset')}`;
  } else if (req.method === 'POST') {
    let linhas = JSON.parse(body);
    if (!Array.isArray(linhas)) linhas = [linhas];
    const cols = Object.keys(linhas[0]);
    const values = linhas.map(l => '(' + cols.map(c => { params.push(l[c]); return '$' + params.length; }).join(',') + ')').join(',');
    sql = `insert into ${tabela} (${cols.map(ident).join(',')}) values ${values}`;
    const oc = url.searchParams.get('on_conflict');
    if (prefer.includes('resolution=ignore-duplicates')) sql += ` on conflict (${oc}) do nothing`;
    else if (prefer.includes('resolution=merge-duplicates')) {
      sql += ` on conflict (${oc}) do update set ` + cols.filter(c => !oc.split(',').includes(c)).map(c => `${ident(c)} = excluded.${ident(c)}`).join(',');
    }
    sql += ' returning *';
  } else if (req.method === 'PATCH') {
    const dados = JSON.parse(body);
    const sets = Object.keys(dados).map(c => { params.push(dados[c]); return `${ident(c)} = $${params.length}`; }).join(',');
    sql = `update ${tabela} set ${sets}` + filtros(url, params) + ' returning *';
  } else if (req.method === 'DELETE') {
    sql = `delete from ${tabela}` + filtros(url, params) + ' returning *';
  }
  const r = await comoUsuario(pg, req, tx => tx.query(sql, params));
  if (req.method !== 'GET' && !prefer.includes('return=representation')) return send(204);
  if (single) return send(200, r.rows[0] ?? null);
  return send(req.method === 'POST' ? 201 : 200, r.rows);
}

async function seed(pg) {
  const lojas = ['Sede', 'Unidade Norte', 'Unidade Sul'];
  const setores = ['Financeiro', 'Comercial', 'Operações', 'Pessoas e Cultura'];
  const nomes = ['Ana Paula Souza', 'Bruno Lima', 'Carla Dias', 'Davi Melo', 'Eduarda Rocha', 'Felipe Costa', 'Gabriela Nunes',
    'Henrique Alves', 'Isabela Martins', 'João Pedro Santos', 'Karen Oliveira', 'Lucas Ferreira', 'Mariana Ribeiro', 'Natália Gomes',
    'Otávio Barbosa', 'Paula Cardoso', 'Rafael Teixeira', 'Sabrina Moura', 'Thiago Araújo', 'Vanessa Pinto'];
  for (let i = 0; i < nomes.length; i++) {
    await pg.query(`insert into colaboradores (matricula,nome,loja,setor,cargo) values ($1,$2,$3,$4,$5)`,
      [String(1001 + i).padStart(5, '0'), nomes[i], lojas[i % 3], setores[i % 4], ['Analista', 'Coordenador(a)', 'Especialista'][i % 3]]);
  }
  const { rows: [t] } = await pg.query(`insert into treinamentos (slug,titulo,descricao,modo_identificacao,horas_limite_alteracao)
    values ('gestao-agil-de-projetos-ab12','Gestão Ágil de Projetos','Workshop prático de Scrum e Kanban aplicado aos projetos do dia a dia.\nTraga seu notebook.','nome_matricula',24) returning id`);
  const turma = async (dias, h, local, end, vagas) => (await pg.query(`insert into turmas (treinamento_id,inicio,fim,local,endereco,vagas)
    values ($1, date_trunc('day', now()) + make_interval(days => $2, hours => $3 + 4), date_trunc('day', now()) + make_interval(days => $2, hours => $3 + 8), $4, $5, $6) returning id`,
    [t.id, dias, h, local, end, vagas])).rows[0].id;
  const t1 = await turma(3, 8, 'Sede — Sala Inovação', 'Av. Paulista, 1000, Bela Vista, São Paulo', 3);
  await turma(5, 14, 'Unidade Norte — Auditório', 'Rua das Flores, 250, Santana, São Paulo', 10);
  await turma(8, 8, 'Online — Microsoft Teams', null, 15);
  await pg.query(`insert into convites select $1, id from colaboradores`, [t.id]);
  const ids = (await pg.query(`select id from colaboradores order by matricula limit 4`)).rows.map(r => r.id);
  for (const [i, id] of ids.entries()) {
    await pg.query(`insert into inscricoes (treinamento_id,turma_id,colaborador_id,status) values ($1,$2,$3,$4)`,
      [t.id, t1, id, i < 3 ? 'confirmada' : 'espera']);
  }
}
