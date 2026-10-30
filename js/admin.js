// Painel administrativo
import {
  sb, aplicarMarca, iniciarTema, marcaHtml, configurado, esc, normalizar, erroMsg, toast, abrirModal, confirmar,
  seletorPessoa, copiarTexto, icone, pessoaHtml, barraHtml, vagasInfo, fmtData, fmtDataCurta, fmtSemana,
  fmtDiaSemana, fmtPeriodo, fmtTurma, separarDataHora, juntarDataHora,
} from './common.js';

const raiz = document.getElementById('raiz');
let app = null; // área de conteúdo do painel
const CARREGANDO = '<div class="carregando"><div class="giro"></div></div>';
const EMPRESA = window.APP_CONFIG.EMPRESA;

const MODOS = {
  nome_matricula: { rotulo: 'Nome + matrícula', desc: 'Seleciona o nome e confirma com a matrícula. Mais seguro.' },
  nome: { rotulo: 'Selecionar o nome', desc: 'Procura e seleciona o próprio nome. Mais rápido.' },
  matricula: { rotulo: 'Digitar a matrícula', desc: 'Digita a matrícula; a lista de nomes não aparece.' },
  livre: { rotulo: 'Nome livre', desc: 'Qualquer pessoa digita nome e telefone. Sem cadastro.' },
};
const STATUS = {
  confirmada: '<span class="selo ok">Confirmado</span>',
  espera: '<span class="selo alerta">Lista de espera</span>',
  cancelada: '<span class="selo">Cancelado</span>',
};

let colaboradoresCache = null;
let ctx = null; // dados do treinamento aberto

aplicarMarca();
iniciar();

// ==================================================================
//  Autenticação e estrutura
// ==================================================================
async function iniciar() {
  if (!configurado()) {
    raiz.innerHTML = `<div class="conteudo" style="margin-top:60px"><div class="card vazio"><span class="icone-bola erro">${icone('alerta')}</span>
      <strong>App ainda não configurado</strong>Edite o arquivo <code>js/config.js</code> com os dados do Supabase (veja o README).</div></div>`;
    return;
  }
  sb.auth.onAuthStateChange(evento => { if (evento === 'PASSWORD_RECOVERY') definirNovaSenha(); });
  const { data: { session } } = await sb.auth.getSession();
  if (session) await entrou(session.user); else telaLogin();
}

function telaLogin(erro = '') {
  raiz.innerHTML = `
    <div class="login">
      <section class="login-arte">
        <div class="marca">${marcaHtml()}</div>
        <div>
          <h2>Treinamentos organizados, do convite à presença.</h2>
          <p>Crie turmas, compartilhe um link e acompanhe inscrições, lista de espera e frequência em tempo real.</p>
          <div class="login-recursos">
            <div>${icone('link')} Um link para cada treinamento</div>
            <div>${icone('ampulheta')} Lista de espera automática</div>
            <div>${icone('checklist')} Presença e relatórios em Excel</div>
          </div>
        </div>
        <div class="pequeno" style="opacity:.7">© ${new Date().getFullYear()} ${esc(EMPRESA)}</div>
      </section>
      <section class="login-form" style="position:relative">
        <button type="button" class="btn-icone tema-canto" data-tema></button>
        <div>
          <span class="icone-bola">${icone('cadeado')}</span>
          <h1 style="font-size:1.75rem;margin:16px 0 6px">Bem-vindo de volta</h1>
          <p class="suave">Entre para gerenciar seus treinamentos.</p>
          <div id="erro">${erro ? `<div class="aviso erro">${icone('alerta')}<span>${esc(erro)}</span></div>` : ''}</div>
          <div class="campo"><label for="email">E-mail</label>
            <div class="com-icone">${icone('pessoa')}<input type="email" id="email" autocomplete="username" placeholder="voce@empresa.com"></div></div>
          <div class="campo"><label for="senha">Senha</label>
            <div class="com-icone">${icone('cadeado')}<input type="password" id="senha" autocomplete="current-password" placeholder="••••••••"></div></div>
          <button type="button" class="primario grande-btn largura-total" id="entrar">Entrar ${icone('seta')}</button>
          <p class="centro mt"><button type="button" class="link" id="esqueci">Esqueci minha senha</button></p>
        </div>
      </section>
    </div>`;
  iniciarTema();
  const email = raiz.querySelector('#email');
  const senha = raiz.querySelector('#senha');
  const btn = raiz.querySelector('#entrar');
  const mostrar = (m, tipo = 'erro') => { raiz.querySelector('#erro').innerHTML = `<div class="aviso ${tipo}">${icone(tipo === 'ok' ? 'ok' : 'alerta')}<span>${esc(m)}</span></div>`; };
  const entrar = async () => {
    btn.disabled = true;
    const { data, error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: senha.value });
    btn.disabled = false;
    if (error) return mostrar(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : erroMsg(error));
    await entrou(data.user);
  };
  btn.addEventListener('click', entrar);
  senha.addEventListener('keydown', e => { if (e.key === 'Enter') entrar(); });
  email.addEventListener('keydown', e => { if (e.key === 'Enter') senha.focus(); });
  raiz.querySelector('#esqueci').addEventListener('click', async () => {
    if (!email.value.trim()) return mostrar('Digite seu e-mail acima e clique novamente em "Esqueci minha senha".');
    const { error } = await sb.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: location.origin + location.pathname });
    if (error) return mostrar(erroMsg(error));
    mostrar('Enviamos um link para redefinir a senha no seu e-mail.', 'ok');
  });
  email.focus();
}

async function entrou(user) {
  const { data: admin, error } = await sb.rpc('is_admin');
  if (error || !admin) {
    await sb.auth.signOut();
    return telaLogin(error ? erroMsg(error) : `O e-mail ${user.email} não está autorizado como administrador.`);
  }
  const nav = `
    <a class="nav-item" data-rota="treinamentos" href="#/treinamentos">${icone('capelo')} Treinamentos</a>
    <a class="nav-item" data-rota="colaboradores" href="#/colaboradores">${icone('pessoas')} Colaboradores</a>`;
  raiz.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <a class="marca" href="#/treinamentos">${marcaHtml()}</a>
        <div class="nav-titulo">Gestão</div>
        ${nav}
        <div class="sidebar-rodape">
          <div class="linha entre" style="padding:0 4px"><span class="pequeno suave">Aparência</span><button type="button" class="btn-icone" data-tema></button></div>
          <div class="usuario-card">${pessoaHtml(user.email.split('@')[0], user.email)}
            <button type="button" class="btn-icone" data-sair title="Sair" aria-label="Sair">${icone('sair')}</button></div>
        </div>
      </aside>
      <div style="min-width:0">
        <header class="topbar topo-mobile">
          <div class="topbar-inner"><a class="marca" href="#/treinamentos">${marcaHtml()}</a>
            <button type="button" class="btn-icone empurra" data-tema></button>
            <button type="button" class="btn-icone" data-sair aria-label="Sair">${icone('sair')}</button></div>
          <nav>${nav}</nav>
        </header>
        <main class="main"><div class="main-inner" id="app"></div></main>
      </div>
    </div>`;
  app = raiz.querySelector('#app');
  iniciarTema();
  raiz.querySelectorAll('[data-sair]').forEach(b => b.addEventListener('click', async () => {
    await sb.auth.signOut();
    location.hash = '';
    location.reload();
  }));
  window.addEventListener('hashchange', rotear);
  rotear();
}

function definirNovaSenha() {
  abrirModal({
    titulo: 'Definir nova senha',
    icone: 'cadeado',
    corpo: `<div class="campo"><label for="nova">Nova senha (mínimo 6 caracteres)</label><input type="password" id="nova" autocomplete="new-password"></div>`,
    botoes: [{
      texto: 'Salvar senha', classe: 'primario',
      acao: async m => {
        const { error } = await sb.auth.updateUser({ password: m.$('#nova').value });
        if (error) throw error;
        toast('Senha alterada!', 'ok');
      },
    }],
  });
}

// ==================================================================
//  Utilidades
// ==================================================================
function rotear() {
  const [, rota = 'treinamentos', id] = location.hash.match(/^#\/(\w+)\/?([\w-]*)/) || [];
  raiz.querySelectorAll('.nav-item').forEach(a =>
    a.classList.toggle('ativo', a.dataset.rota === rota || (rota === 'treinamento' && a.dataset.rota === 'treinamentos')));
  const tela = rota === 'treinamento' && id ? () => telaTreinamento(id)
    : rota === 'colaboradores' ? telaColaboradores
    : telaTreinamentos;
  // reinicia a animação de entrada do conteúdo
  app.style.animation = 'none';
  void app.offsetWidth;
  app.style.animation = '';
  window.scrollTo(0, 0);
  seguro(tela);
}

async function seguro(fn) {
  try {
    await fn();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="card vazio"><span class="icone-bola erro">${icone('alerta')}</span>
      <strong>Não foi possível carregar</strong>${esc(erroMsg(e))}</div>`;
  }
}

// O Supabase devolve no máximo 1000 linhas por consulta: busca em páginas
async function buscarTudo(montarConsulta) {
  const todos = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await montarConsulta().range(de, de + 999);
    if (error) throw error;
    todos.push(...data);
    if (data.length < 1000) return todos;
  }
}

async function exec(consulta) {
  const { data, error } = await consulta;
  if (error) throw error;
  return data;
}

async function emLotes(itens, tamanho, fn) {
  for (let i = 0; i < itens.length; i += tamanho) await fn(itens.slice(i, i + tamanho));
}

async function carregarColaboradores(forcar = false) {
  if (!colaboradoresCache || forcar) {
    colaboradoresCache = await buscarTudo(() => sb.from('colaboradores').select('*').order('nome'));
  }
  return colaboradoresCache;
}

const linkPublico = slug => new URL('index.html?t=' + encodeURIComponent(slug), location.href).href;
const normMat = m => String(m ?? '').replace(/\s/g, '').toUpperCase().replace(/^0+/, '');
const unicos = lista => [...new Set(lista.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
const opcoes = (lista, sel = '') => lista.map(v => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
const kpi = (ic, tom, valor, rotulo, i = 0) => `<div class="kpi" style="--i:${i}"><span class="icone-bola ${tom}">${icone(ic)}</span>
  <div><div class="kpi-valor">${valor}</div><div class="kpi-rotulo">${rotulo}</div></div></div>`;
const vazio = (ic, titulo, texto, extra = '') => `<div class="card vazio"><span class="icone-bola">${icone(ic)}</span>
  <strong>${titulo}</strong>${texto}${extra ? `<div class="mt">${extra}</div>` : ''}</div>`;
const btnIcone = (ic, titulo, attrs, cls = '') => `<button type="button" class="btn-icone ${cls}" title="${titulo}" aria-label="${titulo}" ${attrs}>${icone(ic)}</button>`;

function slugify(texto) {
  const base = normalizar(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return (base || 'treinamento') + '-' + Math.random().toString(36).slice(2, 6);
}

function baixarExcel(nomeArquivo, abas) {
  const wb = XLSX.utils.book_new();
  for (const [nome, linhas] of Object.entries(abas)) {
    const ws = XLSX.utils.json_to_sheet(linhas.length ? linhas : [{ '': 'Sem registros' }]);
    const cab = Object.keys(linhas[0] || {});
    ws['!cols'] = cab.map(c => ({ wch: Math.min(45, Math.max(c.length, ...linhas.map(l => String(l[c] ?? '').length)) + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, nome.slice(0, 31));
  }
  XLSX.writeFile(wb, nomeArquivo);
  toast('Planilha gerada.', 'ok');
}

// ==================================================================
//  Lista de treinamentos
// ==================================================================
const filtroTreinos = { busca: '', status: 'todos' };

async function telaTreinamentos() {
  app.innerHTML = CARREGANDO;
  const [treinos, turmas, insc] = await Promise.all([
    buscarTudo(() => sb.from('treinamentos').select('*').order('criado_em', { ascending: false })),
    buscarTudo(() => sb.from('turmas').select('id,treinamento_id,inicio,vagas')),
    buscarTudo(() => sb.from('inscricoes').select('treinamento_id,status').neq('status', 'cancelada')),
  ]);
  const agora = new Date();
  const futuras = turmas.filter(x => new Date(x.inicio) > agora);
  app.innerHTML = `
    <div class="pagina-topo">
      <div><div class="eyebrow">${icone('grafico', 'p')} Visão geral</div><h1>Treinamentos</h1>
        <p class="sub">Crie treinamentos, cadastre turmas e acompanhe as inscrições.</p></div>
      <div class="acoes"><button type="button" class="primario" id="novo">${icone('mais')} Novo treinamento</button></div>
    </div>
    <div class="kpis">
      ${kpi('capelo', '', treinos.filter(t => t.ativo).length, 'Treinamentos abertos', 0)}
      ${kpi('calendario', '', futuras.length, 'Turmas futuras', 1)}
      ${kpi('pessoaOk', 'ok', insc.filter(i => i.status === 'confirmada').length, 'Inscrições confirmadas', 2)}
      ${kpi('ampulheta', 'alerta', insc.filter(i => i.status === 'espera').length, 'Na lista de espera', 3)}
    </div>
    ${treinos.length ? `<div class="ferramentas">
      <div class="com-icone">${icone('busca')}<input type="search" id="busca" placeholder="Buscar treinamento..." value="${esc(filtroTreinos.busca)}"></div>
      <div class="abas" style="margin:0">${[['todos', 'Todos'], ['abertos', 'Abertos'], ['encerrados', 'Encerrados']].map(([k, r]) =>
        `<button type="button" data-status="${k}" class="${filtroTreinos.status === k ? 'ativo' : ''}">${r}</button>`).join('')}</div>
    </div>` : ''}
    <div class="cards-treino" id="grade"></div>`;

  const grade = app.querySelector('#grade');
  const desenharGrade = () => {
    const busca = normalizar(filtroTreinos.busca);
    const lista = treinos.filter(t => (!busca || normalizar(t.titulo).includes(busca))
      && (filtroTreinos.status === 'todos' || (filtroTreinos.status === 'abertos') === t.ativo));
    if (!treinos.length) {
      grade.innerHTML = `<div style="grid-column:1/-1">${vazio('capelo', 'Nenhum treinamento ainda',
        'Comece importando os colaboradores e depois crie o primeiro treinamento.',
        `<a class="botao" href="#/colaboradores">${icone('pessoas')} Colaboradores</a> <button type="button" class="primario" data-novo>${icone('mais')} Criar treinamento</button>`)}</div>`;
    } else {
      grade.innerHTML = lista.map((t, n) => {
        const ts = turmas.filter(x => x.treinamento_id === t.id);
        const prox = ts.filter(x => new Date(x.inicio) > agora).sort((a, b) => a.inicio.localeCompare(b.inicio))[0];
        const vagas = ts.reduce((s, x) => s + x.vagas, 0);
        const conf = insc.filter(i => i.treinamento_id === t.id && i.status === 'confirmada').length;
        const esp = insc.filter(i => i.treinamento_id === t.id && i.status === 'espera').length;
        return `<article class="card card-treino ${t.ativo ? '' : 'encerrado'}" style="--i:${n}">
          <div class="linha entre"><span class="icone-bola">${icone('capelo')}</span>
            ${t.ativo ? '<span class="selo ok">Aberto</span>' : '<span class="selo">Encerrado</span>'}</div>
          <h3>${esc(t.titulo)}</h3>
          <div class="meta">
            <span>${icone('calendario')} ${ts.length} turma(s)</span>
            <span>${icone('relogio')} ${prox ? 'Próxima ' + fmtDataCurta(prox.inicio).slice(0, 5) : 'Sem turmas futuras'}</span>
            <span>${icone('pessoa')} ${esc(MODOS[t.modo_identificacao].rotulo)}</span>
          </div>
          <div class="ocupacao"><div class="ocupacao-texto"><span>Ocupação${esp ? ` · ${esp} na espera` : ''}</span><strong>${conf}/${vagas}</strong></div>
            ${barraHtml(vagas, conf)}</div>
          <div class="acoes">
            <a class="botao primario pequeno-btn" href="#/treinamento/${t.id}">Abrir ${icone('seta')}</a>
            <button type="button" class="pequeno-btn" data-link="${esc(t.slug)}">${icone('link')} Copiar link</button>
          </div>
        </article>`;
      }).join('') + `<button type="button" class="card-novo" data-novo>${icone('mais', 'g')} Novo treinamento</button>`;
    }
    grade.querySelectorAll('[data-novo]').forEach(b => b.addEventListener('click', () => formTreinamento(null)));
    grade.querySelectorAll('[data-link]').forEach(b => b.addEventListener('click', () => copiarTexto(linkPublico(b.dataset.link), 'Link copiado!')));
  };
  desenharGrade();
  app.querySelector('#novo').addEventListener('click', () => formTreinamento(null));
  app.querySelector('#busca')?.addEventListener('input', e => { filtroTreinos.busca = e.target.value; desenharGrade(); });
  app.querySelectorAll('[data-status]').forEach(b => b.addEventListener('click', () => {
    filtroTreinos.status = b.dataset.status;
    app.querySelectorAll('[data-status]').forEach(x => x.classList.toggle('ativo', x === b));
    desenharGrade();
  }));
}

function formTreinamento(t) {
  const v = t || { titulo: '', descricao: '', modo_identificacao: 'nome_matricula', somente_convidados: true,
    horas_limite_alteracao: 24, lista_espera: true, ativo: true };
  const interruptor = (id, marcado, titulo, texto) => `<label class="interruptor" id="l-${id}"><input type="checkbox" id="${id}" ${marcado ? 'checked' : ''}>
    <span><strong>${titulo}</strong><small>${texto}</small></span></label>`;
  const corpo = `
    <div class="campo"><label for="f-titulo">Nome do treinamento</label><input type="text" id="f-titulo" value="${esc(v.titulo)}" placeholder="Ex.: Gestão de Riscos em Projetos"></div>
    <div class="campo"><label for="f-desc">Descrição e orientações</label>
      <textarea id="f-desc" placeholder="Ex.: Traga seu notebook. Material enviado por e-mail.">${esc(v.descricao)}</textarea>
      <div class="ajuda">Aparece no topo da página de inscrição.</div></div>
    <div class="campo"><label>Como o participante se identifica</label>
      <div class="modo-opcoes">${Object.entries(MODOS).map(([k, m]) => `
        <label><input type="radio" name="f-modo" value="${k}" ${k === v.modo_identificacao ? 'checked' : ''}>
          <span>${esc(m.rotulo)}<small>${esc(m.desc)}</small></span></label>`).join('')}</div></div>
    <div class="campo"><label for="f-horas">Prazo para trocar ou cancelar</label>
      <div class="linha"><input type="number" id="f-horas" min="0" step="1" value="${v.horas_limite_alteracao}" style="max-width:110px">
        <span class="suave pequeno">horas antes do início</span></div>
      <div class="ajuda">Depois desse prazo, só o administrador altera. Use 0 para permitir até o início.</div></div>
    ${interruptor('f-conv', v.somente_convidados, 'Somente convidados', 'Desligado: qualquer colaborador ativo do cadastro pode se inscrever.')}
    ${interruptor('f-espera', v.lista_espera, 'Lista de espera', 'Quando a turma lota, a pessoa entra na fila e é confirmada ao liberar vaga.')}
    ${interruptor('f-ativo', v.ativo, 'Inscrições abertas', 'Desligue para fechar o link de inscrição.')}`;

  const botoes = [];
  if (t) botoes.push({ texto: 'Excluir', icone: 'lixo', classe: 'perigo', acao: () => excluirTreinamento(t) });
  botoes.push({ texto: 'Cancelar' }, {
    texto: t ? 'Salvar alterações' : 'Criar treinamento', classe: 'primario',
    acao: async m => {
      const dados = {
        titulo: m.$('#f-titulo').value.trim(),
        descricao: m.$('#f-desc').value.trim() || null,
        modo_identificacao: m.$('input[name=f-modo]:checked').value,
        somente_convidados: m.$('#f-conv').checked,
        horas_limite_alteracao: Math.max(0, parseInt(m.$('#f-horas').value, 10) || 0),
        lista_espera: m.$('#f-espera').checked,
        ativo: m.$('#f-ativo').checked,
      };
      if (!dados.titulo) { toast('Informe o nome do treinamento.', 'erro'); return false; }
      if (t) {
        await exec(sb.from('treinamentos').update(dados).eq('id', t.id));
        toast('Treinamento salvo.', 'ok');
        await recarregarTreinamento();
      } else {
        const [novo] = await exec(sb.from('treinamentos').insert({ ...dados, slug: slugify(dados.titulo) }).select());
        toast('Treinamento criado! Agora cadastre as turmas.', 'ok');
        location.hash = '#/treinamento/' + novo.id;
      }
    },
  });
  const m = abrirModal({ titulo: t ? 'Editar treinamento' : 'Novo treinamento', icone: 'capelo', corpo, botoes });
  const ajustar = () => { m.$('#l-f-conv').hidden = m.$('input[name=f-modo]:checked').value === 'livre'; };
  m.corpo.querySelectorAll('input[name=f-modo]').forEach(r => r.addEventListener('change', ajustar));
  ajustar();
  m.$('#f-titulo').focus();
}

async function excluirTreinamento(t) {
  const ok = await confirmar('Excluir treinamento?',
    `<p>Excluir <strong>${esc(t.titulo)}</strong>?</p><div class="aviso erro">${icone('alerta')}<span>Todas as turmas, convites e inscrições deste treinamento serão apagados definitivamente. Para apenas fechar as inscrições, desligue "Inscrições abertas".</span></div>`,
    { textoOk: 'Excluir definitivamente', perigo: true });
  if (!ok) return false;
  await exec(sb.from('treinamentos').delete().eq('id', t.id));
  toast('Treinamento excluído.', 'ok');
  location.hash = '#/treinamentos';
}

// ==================================================================
//  Detalhe do treinamento
// ==================================================================
async function telaTreinamento(id) {
  if (ctx?.t?.id !== id) {
    app.innerHTML = CARREGANDO;
    ctx = { aba: 'turmas', filtroTurma: '', mostrarCanc: false, buscaConv: '', filtroPend: '' };
  }
  await carregarTreinamento(id);
  if (!ctx.t) { app.innerHTML = vazio('alerta', 'Treinamento não encontrado', 'Ele pode ter sido excluído.'); return; }
  desenharTreinamento();
}

async function carregarTreinamento(id) {
  const [ts, turmas, insc, convites, colabs] = await Promise.all([
    exec(sb.from('treinamentos').select('*').eq('id', id)),
    buscarTudo(() => sb.from('turmas').select('*').eq('treinamento_id', id).order('inicio')),
    buscarTudo(() => sb.from('inscricoes').select('*').eq('treinamento_id', id).order('criado_em')),
    buscarTudo(() => sb.from('convites').select('colaborador_id').eq('treinamento_id', id)),
    carregarColaboradores(),
  ]);
  const ativas = insc.filter(i => i.status !== 'cancelada');
  Object.assign(ctx, {
    t: ts[0], turmas, insc,
    convites: new Set(convites.map(c => c.colaborador_id)),
    colabs,
    colabPorId: new Map(colabs.map(c => [c.id, c])),
    turmaPorId: new Map(turmas.map(x => [x.id, x])),
    ativaPorColab: new Map(ativas.filter(i => i.colaborador_id).map(i => [i.colaborador_id, i])),
  });
}

async function recarregarTreinamento() {
  if (!ctx?.t) return;
  const y = window.scrollY;
  await carregarTreinamento(ctx.t.id);
  desenharTreinamento();
  window.scrollTo(0, y);
}

const livre = () => ctx.t.modo_identificacao === 'livre';
const contagem = turmaId => {
  const doTurma = ctx.insc.filter(i => i.turma_id === turmaId);
  return {
    conf: doTurma.filter(i => i.status === 'confirmada').length,
    esp: doTurma.filter(i => i.status === 'espera').length,
    pres: doTurma.filter(i => i.status === 'confirmada' && i.presenca === true).length,
    falt: doTurma.filter(i => i.status === 'confirmada' && i.presenca === false).length,
  };
};
const nomeInsc = i => i.colaborador_id ? ctx.colabPorId.get(i.colaborador_id)?.nome ?? '(removido)' : i.nome_livre;
const fmtTel = t => String(t || '').replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
const unidadeSetor = c => [c?.loja, c?.setor].filter(Boolean).join(' · ');

function pendentes() {
  if (livre()) return [];
  return [...ctx.convites].map(id => ctx.colabPorId.get(id))
    .filter(c => c && c.ativo && ctx.ativaPorColab.get(c.id)?.status !== 'confirmada')
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function desenharTreinamento() {
  const t = ctx.t;
  const link = linkPublico(t.slug);
  const vagas = ctx.turmas.reduce((s, x) => s + x.vagas, 0);
  const conf = ctx.insc.filter(i => i.status === 'confirmada').length;
  const esp = ctx.insc.filter(i => i.status === 'espera').length;
  const pend = pendentes().length;
  const abas = [['turmas', 'Turmas', ctx.turmas.length], ['inscritos', 'Inscritos e presença', conf + esp]];
  if (!livre()) abas.push(['convidados', 'Convidados', ctx.convites.size], ['pendentes', 'Pendentes', pend]);
  if (!abas.some(a => a[0] === ctx.aba)) ctx.aba = 'turmas';

  app.innerHTML = `
    <a class="voltar" href="#/treinamentos">${icone('voltar', 'p')} Treinamentos</a>
    <div class="pagina-topo">
      <div><h1>${esc(t.titulo)}</h1>${t.descricao ? `<p class="sub">${esc(t.descricao.split('\n')[0])}</p>` : ''}</div>
      <div class="acoes">
        <button type="button" id="b-qr">${icone('qr')} QR Code</button>
        <button type="button" id="b-editar">${icone('editar')} Editar</button>
        <button type="button" class="primario" id="b-excel">${icone('planilha')} Exportar Excel</button>
      </div>
    </div>
    <div class="link-box">${icone('link')}<a href="${esc(link)}" target="_blank" rel="noopener">${esc(link)}</a>
      <button type="button" class="suave-btn pequeno-btn" id="b-link">${icone('copiar')} Copiar link</button></div>
    <div class="config-chips">
      ${t.ativo ? '<span class="selo ok">Inscrições abertas</span>' : '<span class="selo">Encerrado</span>'}
      <span class="chip">${icone('pessoa')} ${esc(MODOS[t.modo_identificacao].rotulo)}</span>
      ${!livre() ? `<span class="chip">${icone('escudo')} ${t.somente_convidados ? 'Somente convidados' : 'Aberto a todos'}</span>` : ''}
      <span class="chip">${icone('relogio')} Trocas até ${t.horas_limite_alteracao}h antes</span>
      <span class="chip">${icone('ampulheta')} Lista de espera ${t.lista_espera ? 'ativa' : 'desligada'}</span>
    </div>
    <div class="kpis">
      ${kpi('calendario', '', ctx.turmas.length, 'Turmas', 0)}
      ${kpi('camadas', '', vagas, 'Vagas no total', 1)}
      ${kpi('pessoaOk', 'ok', conf, 'Confirmados', 2)}
      ${kpi('ampulheta', 'alerta', esp, 'Lista de espera', 3)}
      ${!livre() ? kpi('alerta', 'erro', pend, 'Pendentes', 4) : ''}
    </div>
    <div class="abas" role="tablist">${abas.map(([k, r, n]) =>
      `<button type="button" role="tab" data-aba="${k}" class="${k === ctx.aba ? 'ativo' : ''}">${r} <span class="contador">${n}</span></button>`).join('')}</div>
    <div id="aba"></div>`;

  app.querySelector('#b-link').addEventListener('click', () => copiarTexto(link, 'Link copiado!'));
  app.querySelector('#b-qr').addEventListener('click', () => mostrarQr(link));
  app.querySelector('#b-editar').addEventListener('click', () => formTreinamento(t));
  app.querySelector('#b-excel').addEventListener('click', exportarTreinamento);
  app.querySelectorAll('[data-aba]').forEach(b => b.addEventListener('click', () => {
    ctx.aba = b.dataset.aba;
    app.querySelectorAll('[data-aba]').forEach(x => x.classList.toggle('ativo', x === b));
    desenharAba();
  }));
  desenharAba();
}

function desenharAba() {
  ({ turmas: abaTurmas, inscritos: abaInscritos, convidados: abaConvidados, pendentes: abaPendentes })[ctx.aba]();
}

function mostrarQr(link) {
  const m = abrirModal({
    titulo: 'QR Code de inscrição',
    icone: 'qr',
    corpo: `<div id="qrcode"></div><p class="centro pequeno suave" style="word-break:break-all">${esc(link)}</p>
      <p class="centro pequeno" style="margin:0">Imprima e fixe em murais, ou envie a imagem por WhatsApp e e-mail.</p>`,
    botoes: [
      { texto: 'Fechar' },
      { texto: 'Baixar imagem', icone: 'baixar', classe: 'primario', acao: m => {
        const el = m.$('#qrcode canvas') || m.$('#qrcode img');
        const a = document.createElement('a');
        a.href = el.tagName === 'CANVAS' ? el.toDataURL('image/png') : el.src;
        a.download = `qrcode-${ctx.t.slug}.png`;
        a.click();
        return false;
      } },
    ],
  });
  new QRCode(m.$('#qrcode'), { text: link, width: 240, height: 240, correctLevel: QRCode.CorrectLevel.M });
}

// ------------------------------------------------------------------
//  Aba: Turmas
// ------------------------------------------------------------------
function abaTurmas() {
  const box = app.querySelector('#aba');
  const agora = new Date();
  box.innerHTML = `
    <div class="ferramentas"><h2 style="margin:0">Turmas</h2>
      <button type="button" class="primario empurra" id="nova-turma">${icone('mais')} Nova turma</button></div>
    ${ctx.turmas.length ? `<div class="tabela-wrap"><table>
      <thead><tr><th>Data</th><th>Horário</th><th>Local</th><th>Ocupação</th><th>Espera</th><th></th></tr></thead>
      <tbody>${ctx.turmas.map(tu => {
        const c = contagem(tu.id);
        const passou = new Date(tu.inicio) < agora;
        return `<tr class="${passou ? 'passada' : ''}">
          <td class="cel-data"><strong>${fmtDataCurta(tu.inicio)}</strong><span>${esc(fmtDiaSemana(tu.inicio))}${passou ? ' · realizada' : ''}</span></td>
          <td>${esc(fmtPeriodo(tu.inicio, tu.fim))}</td>
          <td><strong>${esc(tu.local)}</strong>${tu.endereco ? `<br><span class="pequeno suave">${esc(tu.endereco)}</span>` : ''}
            ${tu.observacao ? `<br><span class="pequeno suave">${esc(tu.observacao)}</span>` : ''}</td>
          <td style="min-width:160px"><div class="ocupacao"><div class="ocupacao-texto"><span>${c.conf > tu.vagas ? '<span class="selo erro sem-ponto">acima do limite</span>' : ''}</span>
            <strong>${c.conf}/${tu.vagas}</strong></div>${barraHtml(tu.vagas, c.conf)}</div></td>
          <td>${c.esp ? `<span class="selo alerta">${c.esp}</span>` : '<span class="suave">—</span>'}</td>
          <td class="acoes">
            ${btnIcone('editar', 'Editar', `data-editar="${tu.id}"`)}
            ${btnIcone('copiar', 'Duplicar', `data-duplicar="${tu.id}"`)}
            ${btnIcone('lixo', 'Excluir', `data-excluir="${tu.id}"`, 'link vermelho')}
          </td></tr>`;
      }).join('')}</tbody></table></div>`
    : vazio('calendario', 'Nenhuma turma ainda', 'Cadastre as datas, horários, locais e vagas deste treinamento.',
      `<button type="button" class="primario" data-nova>${icone('mais')} Cadastrar primeira turma</button>`)}`;

  box.querySelectorAll('#nova-turma, [data-nova]').forEach(b => b.addEventListener('click', () => formTurma(null)));
  box.querySelectorAll('[data-editar]').forEach(b => b.addEventListener('click', () => formTurma(ctx.turmaPorId.get(b.dataset.editar))));
  box.querySelectorAll('[data-duplicar]').forEach(b => b.addEventListener('click', () => formTurma(ctx.turmaPorId.get(b.dataset.duplicar), true)));
  box.querySelectorAll('[data-excluir]').forEach(b => b.addEventListener('click', () => excluirTurma(ctx.turmaPorId.get(b.dataset.excluir))));
}

function formTurma(tu, duplicar = false) {
  const editando = tu && !duplicar;
  const ini = separarDataHora(tu?.inicio);
  const fim = separarDataHora(tu?.fim);
  const locais = unicos([...ctx.turmas.map(x => x.local), ...ctx.colabs.map(c => c.loja)]);
  const corpo = `
    ${duplicar ? `<div class="aviso info">${icone('copiar')}<span>Copiamos os dados da turma. Escolha a nova data.</span></div>` : ''}
    <div class="grid3">
      <div class="campo"><label for="t-data">Data</label><input type="date" id="t-data" value="${duplicar ? '' : ini.data}"></div>
      <div class="campo"><label for="t-ini">Início</label><input type="time" id="t-ini" value="${ini.hora}"></div>
      <div class="campo"><label for="t-fim">Término</label><input type="time" id="t-fim" value="${fim.hora}"></div>
    </div>
    <div class="grid2">
      <div class="campo"><label for="t-local">Local</label>
        <input type="text" id="t-local" list="t-locais" value="${esc(tu?.local ?? '')}" placeholder="Ex.: Sede — Sala 3 ou Online (Teams)">
        <datalist id="t-locais">${locais.map(l => `<option value="${esc(l)}">`).join('')}</datalist></div>
      <div class="campo"><label for="t-vagas">Vagas</label><input type="number" id="t-vagas" min="0" value="${tu?.vagas ?? 20}"></div>
    </div>
    <div class="campo"><label for="t-end">Endereço ou link</label><input type="text" id="t-end" value="${esc(tu?.endereco ?? '')}" placeholder="Rua, número, bairro, cidade">
      <div class="ajuda">Vira um link para o Google Maps na página de inscrição.</div></div>
    <div class="campo" style="margin-bottom:0"><label for="t-obs">Observação</label><input type="text" id="t-obs" value="${esc(tu?.observacao ?? '')}" placeholder="Ex.: Instrutora: Ana · Levar notebook"></div>`;

  const m = abrirModal({
    titulo: editando ? 'Editar turma' : duplicar ? 'Duplicar turma' : 'Nova turma',
    icone: 'calendario',
    corpo,
    botoes: [{ texto: 'Cancelar' }, {
      texto: 'Salvar turma', classe: 'primario',
      acao: async m => {
        const data = m.$('#t-data').value, hIni = m.$('#t-ini').value, hFim = m.$('#t-fim').value;
        const local = m.$('#t-local').value.trim();
        const vagas = parseInt(m.$('#t-vagas').value, 10);
        if (!data || !hIni || !local || !(vagas >= 0)) { toast('Preencha data, início, local e vagas.', 'erro'); return false; }
        if (hFim && hFim <= hIni) { toast('O término deve ser depois do início.', 'erro'); return false; }
        const dados = {
          inicio: juntarDataHora(data, hIni),
          fim: hFim ? juntarDataHora(data, hFim) : null,
          local, vagas,
          endereco: m.$('#t-end').value.trim() || null,
          observacao: m.$('#t-obs').value.trim() || null,
        };
        if (editando) {
          const conf = contagem(tu.id).conf;
          if (vagas < conf && !await confirmar('Reduzir vagas?',
            `<p>Esta turma já tem <strong>${conf}</strong> confirmados. Com ${vagas} vagas ela ficará acima do limite (ninguém é removido automaticamente).</p>`)) return false;
          await exec(sb.from('turmas').update(dados).eq('id', tu.id));
        } else {
          await exec(sb.from('turmas').insert({ ...dados, treinamento_id: ctx.t.id }));
        }
        toast('Turma salva.', 'ok');
        await recarregarTreinamento();
      },
    }],
  });
  // ao escolher um local já usado, preenche o endereço
  m.$('#t-local').addEventListener('change', () => {
    const anterior = ctx.turmas.find(x => x.local === m.$('#t-local').value && x.endereco);
    if (anterior && !m.$('#t-end').value) m.$('#t-end').value = anterior.endereco;
  });
  m.$('#t-data').focus();
}

async function excluirTurma(tu) {
  const c = contagem(tu.id);
  const ok = await confirmar('Excluir turma?',
    `<p>${esc(fmtTurma(tu))}</p>${c.conf + c.esp
      ? `<div class="aviso erro">${icone('alerta')}<span>Esta turma tem <strong>${c.conf + c.esp}</strong> inscrito(s). As inscrições serão apagadas e essas pessoas precisarão escolher outra turma.</span></div>` : ''}`,
    { textoOk: 'Excluir turma', perigo: true });
  if (!ok) return;
  try {
    await exec(sb.from('turmas').delete().eq('id', tu.id));
    toast('Turma excluída.', 'ok');
  } catch (e) { toast(erroMsg(e), 'erro'); }
  await recarregarTreinamento();
}

// ------------------------------------------------------------------
//  Aba: Inscritos e presença
// ------------------------------------------------------------------
function abaInscritos() {
  const box = app.querySelector('#aba');
  const turmas = ctx.turmas.filter(tu => !ctx.filtroTurma || tu.id === ctx.filtroTurma);
  const ordem = { confirmada: 0, espera: 1, cancelada: 2 };
  box.innerHTML = `
    <div class="ferramentas">
      <select id="f-turma" style="max-width:380px"><option value="">Todas as turmas</option>
        ${ctx.turmas.map(tu => `<option value="${tu.id}" ${tu.id === ctx.filtroTurma ? 'selected' : ''}>${esc(fmtTurma(tu))}</option>`).join('')}</select>
      <label class="check" style="margin:0"><input type="checkbox" id="f-canc" ${ctx.mostrarCanc ? 'checked' : ''}> Mostrar cancelados</label>
      <button type="button" class="primario empurra" id="add-insc" ${ctx.turmas.length ? '' : 'disabled'}>${icone('pessoaMais')} Adicionar inscrito</button>
    </div>
    ${!ctx.turmas.length ? vazio('calendario', 'Sem turmas', 'Cadastre turmas primeiro na aba Turmas.') : ''}
    ${turmas.map(tu => {
      const c = contagem(tu.id);
      const lista = ctx.insc.filter(i => i.turma_id === tu.id && (ctx.mostrarCanc || i.status !== 'cancelada'))
        .sort((a, b) => ordem[a.status] - ordem[b.status]
          || (a.status === 'espera' ? a.criado_em.localeCompare(b.criado_em) : nomeInsc(a).localeCompare(nomeInsc(b), 'pt-BR')));
      let pos = 0;
      return `<section class="grupo-turma">
        <div class="grupo-cab">
          <h3>${icone('calendario', 'p')} ${esc(fmtTurma(tu))}</h3>
          <span class="selo ${c.conf >= tu.vagas ? 'erro' : 'ok'}">${c.conf}/${tu.vagas} confirmados</span>
          ${c.esp ? `<span class="selo alerta">${c.esp} na espera</span>` : ''}
          ${c.pres + c.falt ? `<span class="selo info">${c.pres} presentes · ${c.falt} faltas</span>` : ''}
          ${c.conf ? `<span class="empurra linha" style="gap:4px">
            <button type="button" class="link pequeno-btn" data-todos="${tu.id}">${icone('checklist')} Todos presentes</button>
            <button type="button" class="link pequeno-btn" data-imprimir="${tu.id}">${icone('impressora')} Lista de assinatura</button></span>` : ''}
        </div>
        ${lista.length ? `<div class="tabela-wrap"><table>
          <thead><tr><th>Participante</th>${livre() ? '' : '<th>Unidade / setor</th>'}<th>Situação</th><th>Presença</th><th></th></tr></thead>
          <tbody>${lista.map(i => {
            const col = ctx.colabPorId.get(i.colaborador_id);
            const situacao = i.status === 'espera' ? `<span class="selo alerta">Espera · ${++pos}º</span>` : STATUS[i.status];
            return `<tr>
              <td>${pessoaHtml(nomeInsc(i), (livre() ? fmtTel(i.contato) : col?.matricula ?? '') + (i.origem === 'admin' ? ' · adicionado pelo painel' : ''))}</td>
              ${livre() ? '' : `<td class="pequeno">${esc(unidadeSetor(col))}</td>`}
              <td>${situacao}</td>
              <td>${i.status === 'confirmada' ? `<div class="presenca">
                  <button type="button" class="${i.presenca === true ? 'sim' : ''}" data-presenca="${i.id}" data-valor="true">${icone('ok')} Presente</button>
                  <button type="button" class="${i.presenca === false ? 'nao' : ''}" data-presenca="${i.id}" data-valor="false">${icone('fechar')} Faltou</button>
                </div>` : ''}</td>
              <td class="acoes">${i.status === 'cancelada' ? `<span class="pequeno suave">${i.cancelado_em ? 'em ' + fmtDataCurta(i.cancelado_em) : ''}</span>` : `
                ${i.status === 'espera' ? btnIcone('pessoaOk', 'Confirmar vaga', `data-confirmar="${i.id}"`, 'link') : ''}
                ${btnIcone('mover', 'Mover para outra turma', `data-mover="${i.id}"`)}
                ${btnIcone('fechar', 'Cancelar inscrição', `data-cancelar="${i.id}"`, 'link vermelho')}`}</td>
            </tr>`;
          }).join('')}</tbody></table></div>` : '<p class="suave pequeno" style="padding-left:4px">Nenhum inscrito nesta turma ainda.</p>'}
      </section>`;
    }).join('')}`;

  box.querySelector('#f-turma').addEventListener('change', e => { ctx.filtroTurma = e.target.value; abaInscritos(); });
  box.querySelector('#f-canc').addEventListener('change', e => { ctx.mostrarCanc = e.target.checked; abaInscritos(); });
  box.querySelector('#add-insc').addEventListener('click', adicionarInscrito);
  const insc = id => ctx.insc.find(i => i.id === id);
  box.querySelectorAll('[data-presenca]').forEach(b => b.addEventListener('click', () => marcarPresenca(insc(b.dataset.presenca), b.dataset.valor === 'true')));
  box.querySelectorAll('[data-todos]').forEach(b => b.addEventListener('click', () => todosPresentes(b.dataset.todos)));
  box.querySelectorAll('[data-imprimir]').forEach(b => b.addEventListener('click', () => imprimirLista(ctx.turmaPorId.get(b.dataset.imprimir))));
  box.querySelectorAll('[data-confirmar]').forEach(b => b.addEventListener('click', () => confirmarEspera(insc(b.dataset.confirmar))));
  box.querySelectorAll('[data-mover]').forEach(b => b.addEventListener('click', () => moverInscrito(insc(b.dataset.mover))));
  box.querySelectorAll('[data-cancelar]').forEach(b => b.addEventListener('click', () => cancelarInscrito(insc(b.dataset.cancelar))));
}

async function marcarPresenca(i, valor) {
  const novo = i.presenca === valor ? null : valor; // clicar de novo desmarca
  try {
    await exec(sb.from('inscricoes').update({ presenca: novo }).eq('id', i.id));
    i.presenca = novo;
    abaInscritos();
  } catch (e) { toast(erroMsg(e), 'erro'); }
}

async function todosPresentes(turmaId) {
  try {
    await exec(sb.from('inscricoes').update({ presenca: true }).eq('turma_id', turmaId).eq('status', 'confirmada'));
    toast('Presença marcada para todos.', 'ok');
  } catch (e) { toast(erroMsg(e), 'erro'); }
  await recarregarTreinamento();
}

function imprimirLista(tu) {
  const lista = ctx.insc.filter(i => i.turma_id === tu.id && i.status === 'confirmada')
    .sort((a, b) => nomeInsc(a).localeCompare(nomeInsc(b), 'pt-BR'));
  const w = window.open('', '_blank');
  if (!w) return toast('Permita pop-ups para imprimir.', 'erro');
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Lista de presença</title>
    <style>body{font-family:Inter,Arial,sans-serif;margin:32px;color:#111}small{color:#666;text-transform:uppercase;letter-spacing:.08em;font-size:11px}
    h1{font-size:20px;margin:4px 0}p{margin:0 0 18px;font-size:13px;color:#444}
    table{width:100%;border-collapse:collapse;font-size:13px}th,td{border-bottom:1px solid #ccc;padding:10px 6px;text-align:left}
    th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#555;border-bottom:2px solid #111}td.ass{width:34%}</style></head><body>
    <small>${esc(EMPRESA)} · Lista de presença</small>
    <h1>${esc(ctx.t.titulo)}</h1>
    <p>${esc(fmtData(tu.inicio))} · ${esc(fmtPeriodo(tu.inicio, tu.fim))} · ${esc(tu.local)}${tu.endereco ? ' · ' + esc(tu.endereco) : ''}</p>
    <table><thead><tr><th>#</th><th>Nome</th><th>${livre() ? 'Telefone' : 'Matrícula'}</th>${livre() ? '' : '<th>Unidade / setor</th>'}<th>Assinatura</th></tr></thead><tbody>
    ${lista.map((i, n) => {
      const c = ctx.colabPorId.get(i.colaborador_id);
      return `<tr><td>${n + 1}</td><td>${esc(nomeInsc(i))}</td><td>${esc(livre() ? fmtTel(i.contato) : c?.matricula ?? '')}</td>
        ${livre() ? '' : `<td>${esc(unidadeSetor(c))}</td>`}<td class="ass"></td></tr>`;
    }).join('')}
    </tbody></table><script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}

async function confirmarEspera(i) {
  const tu = ctx.turmaPorId.get(i.turma_id);
  const c = contagem(tu.id);
  if (c.conf >= tu.vagas && !await confirmar('Turma lotada',
    `<p>A turma já tem ${c.conf}/${tu.vagas} confirmados. Confirmar <strong>${esc(nomeInsc(i))}</strong> mesmo assim, acima do limite?</p>`)) return;
  try {
    await exec(sb.from('inscricoes').update({ status: 'confirmada' }).eq('id', i.id));
    toast('Inscrição confirmada.', 'ok');
  } catch (e) { toast(erroMsg(e), 'erro'); }
  await recarregarTreinamento();
}

async function cancelarInscrito(i) {
  const ok = await confirmar('Cancelar inscrição?',
    `<p><strong>${esc(nomeInsc(i))}</strong><br>${esc(fmtTurma(ctx.turmaPorId.get(i.turma_id)))}</p>
     ${i.status === 'confirmada' && ctx.t.lista_espera ? '<p class="pequeno suave" style="margin:0">Se houver alguém na lista de espera, a vaga passa automaticamente para o próximo da fila.</p>' : ''}`,
    { textoOk: 'Cancelar inscrição', perigo: true });
  if (!ok) return;
  try {
    await exec(sb.from('inscricoes').update({ status: 'cancelada' }).eq('id', i.id));
    toast('Inscrição cancelada.', 'ok');
  } catch (e) { toast(erroMsg(e), 'erro'); }
  await recarregarTreinamento();
}

function opcoesTurmas(excluir) {
  return ctx.turmas.filter(tu => tu.id !== excluir).map(tu => {
    const c = contagem(tu.id);
    return `<option value="${tu.id}">${esc(fmtTurma(tu))} — ${c.conf}/${tu.vagas}${c.conf >= tu.vagas ? ' (lotada)' : ''}</option>`;
  }).join('');
}

async function verificarLotacao(turmaId) {
  const tu = ctx.turmaPorId.get(turmaId);
  const c = contagem(turmaId);
  return c.conf < tu.vagas || confirmar('Turma lotada',
    `<p>A turma escolhida já tem ${c.conf}/${tu.vagas} confirmados. Continuar mesmo assim, acima do limite?</p>`);
}

function moverInscrito(i) {
  if (ctx.turmas.length < 2) return toast('Não há outra turma para mover.', 'erro');
  abrirModal({
    titulo: 'Mover para outra turma',
    icone: 'mover',
    corpo: `<div class="resumo" style="margin:0 0 16px">${pessoaHtml(nomeInsc(i), 'Atual: ' + fmtTurma(ctx.turmaPorId.get(i.turma_id)))}</div>
      <div class="campo" style="margin:0"><label for="m-turma">Nova turma</label><select id="m-turma">${opcoesTurmas(i.turma_id)}</select></div>`,
    botoes: [{ texto: 'Cancelar' }, {
      texto: 'Mover', classe: 'primario',
      acao: async m => {
        const destino = m.$('#m-turma').value;
        if (!await verificarLotacao(destino)) return false;
        await exec(sb.from('inscricoes').update({ turma_id: destino, status: 'confirmada', presenca: null }).eq('id', i.id));
        toast('Inscrito movido.', 'ok');
        await recarregarTreinamento();
      },
    }],
  });
}

function adicionarInscrito() {
  let seletor = null;
  const m = abrirModal({
    titulo: 'Adicionar inscrito',
    icone: 'pessoaMais',
    corpo: `
      ${livre() ? `<div class="grid2">
        <div class="campo"><label for="a-nome">Nome completo</label><input type="text" id="a-nome"></div>
        <div class="campo"><label for="a-tel">Telefone</label><input type="tel" id="a-tel"></div></div>`
      : `<div class="campo"><label>Colaborador</label><div id="a-sel"></div><div id="a-info"></div></div>`}
      <div class="campo"><label for="a-turma">Turma</label><select id="a-turma">${opcoesTurmas(null)}</select></div>
      ${!livre() && ctx.t.somente_convidados ? '<p class="pequeno suave" style="margin:0">Se a pessoa não estiver convidada, ela também é adicionada aos convidados.</p>' : ''}`,
    botoes: [{ texto: 'Cancelar' }, {
      texto: 'Adicionar', classe: 'primario',
      acao: async m => {
        const turma = m.$('#a-turma').value;
        const novo = { treinamento_id: ctx.t.id, turma_id: turma, status: 'confirmada', origem: 'admin' };
        if (livre()) {
          novo.nome_livre = m.$('#a-nome').value.trim().replace(/\s+/g, ' ');
          novo.contato = m.$('#a-tel').value.replace(/\D/g, '');
          if (novo.nome_livre.length < 3 || novo.contato.length < 10) { toast('Informe nome e telefone com DDD.', 'erro'); return false; }
          if (ctx.insc.some(i => i.status !== 'cancelada' && i.contato === novo.contato)) {
            toast('Já existe inscrição ativa com este telefone. Use "Mover".', 'erro'); return false;
          }
        } else {
          const p = seletor.get();
          if (!p) { toast('Selecione o colaborador.', 'erro'); return false; }
          if (ctx.ativaPorColab.has(p.id)) { toast('Esta pessoa já está inscrita. Use "Mover" para trocar de turma.', 'erro'); return false; }
          novo.colaborador_id = p.id;
        }
        if (!await verificarLotacao(turma)) return false;
        if (novo.colaborador_id && !ctx.convites.has(novo.colaborador_id)) {
          await exec(sb.from('convites').upsert({ treinamento_id: ctx.t.id, colaborador_id: novo.colaborador_id },
            { onConflict: 'treinamento_id,colaborador_id', ignoreDuplicates: true }));
        }
        await exec(sb.from('inscricoes').insert(novo));
        toast('Inscrito adicionado.', 'ok');
        await recarregarTreinamento();
      },
    }],
  });
  if (ctx.filtroTurma) m.$('#a-turma').value = ctx.filtroTurma;
  if (!livre()) {
    seletor = seletorPessoa(m.$('#a-sel'), ctx.colabs.filter(c => c.ativo), {
      placeholder: 'Buscar por nome ou matrícula...',
      detalhe: c => [c.matricula, c.loja, c.setor].filter(Boolean).join(' · '),
      onChange: p => {
        const atual = p && ctx.ativaPorColab.get(p.id);
        m.$('#a-info').innerHTML = atual
          ? `<div class="aviso alerta mt">${icone('info')}<span>Já inscrito: ${esc(fmtTurma(ctx.turmaPorId.get(atual.turma_id)))}</span></div>` : '';
      },
    });
  }
}

// ------------------------------------------------------------------
//  Aba: Convidados
// ------------------------------------------------------------------
function abaConvidados() {
  const box = app.querySelector('#aba');
  const ativos = ctx.colabs.filter(c => c.ativo);
  const convidados = [...ctx.convites].map(id => ctx.colabPorId.get(id)).filter(Boolean)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const busca = normalizar(ctx.buscaConv);
  const visiveis = convidados.filter(c => !busca || normalizar(`${c.nome} ${c.matricula} ${c.loja} ${c.setor}`).includes(busca));

  box.innerHTML = `
    ${!ctx.t.somente_convidados ? `<div class="aviso info">${icone('info')}<span>Este treinamento está aberto a <strong>todos os colaboradores ativos</strong>.
      Os convites servem para acompanhar quem ainda está pendente.</span></div>` : ''}
    <div class="card">
      <div class="card-cab"><span class="icone-bola">${icone('pessoaMais')}</span>
        <div><h3>Adicionar convidados</h3><p class="suave pequeno" style="margin:0">Por filtro, por lista de matrículas ou um a um.</p></div></div>
      ${!ativos.length ? `<div class="aviso alerta">${icone('info')}<span>Nenhum colaborador cadastrado. Importe a planilha em <a href="#/colaboradores">Colaboradores</a>.</span></div>` : ''}
      <div class="grid3">
        <div class="campo"><label for="c-loja">Unidade</label><select id="c-loja"><option value="">Todas</option>${opcoes(unicos(ativos.map(c => c.loja)))}</select></div>
        <div class="campo"><label for="c-setor">Setor</label><select id="c-setor"><option value="">Todos</option>${opcoes(unicos(ativos.map(c => c.setor)))}</select></div>
        <div class="campo"><label for="c-cargo">Cargo</label><select id="c-cargo"><option value="">Todos</option>${opcoes(unicos(ativos.map(c => c.cargo)))}</select></div>
      </div>
      <div class="linha"><span id="c-qtd" class="pequeno suave"></span><button type="button" class="primario empurra" id="c-filtro">Convidar</button></div>
      <hr>
      <div class="grid2">
        <div class="campo"><label>Uma pessoa</label><div id="c-sel"></div></div>
        <div class="campo"><label for="c-mats">Colar lista de matrículas</label>
          <textarea id="c-mats" placeholder="Uma por linha (pode colar direto do Excel)" style="min-height:76px"></textarea>
          <button type="button" class="suave-btn pequeno-btn mt" id="c-mats-btn">${icone('mais')} Convidar matrículas</button></div>
      </div>
    </div>
    <div class="ferramentas">
      <h3 style="margin:0">Convidados <span class="contador">${convidados.length}</span></h3>
      <div class="com-icone empurra">${icone('busca')}<input type="search" id="c-busca" placeholder="Buscar convidado..." value="${esc(ctx.buscaConv)}"></div>
      ${convidados.length ? `<button type="button" class="perigo pequeno-btn" id="c-limpar">${icone('lixo')} Remover todos</button>` : ''}
    </div>
    ${convidados.length ? `<div class="tabela-wrap"><table>
      <thead><tr><th>Colaborador</th><th>Unidade</th><th>Setor</th><th>Situação</th><th></th></tr></thead>
      <tbody>${visiveis.slice(0, 500).map(c => {
        const i = ctx.ativaPorColab.get(c.id);
        const sit = !c.ativo ? '<span class="selo">Inativo</span>'
          : !i ? '<span class="selo erro">Pendente</span>'
          : `${STATUS[i.status]} <span class="pequeno suave">${fmtDataCurta(ctx.turmaPorId.get(i.turma_id).inicio).slice(0, 5)}</span>`;
        return `<tr><td>${pessoaHtml(c.nome, c.matricula)}</td><td>${esc(c.loja ?? '')}</td>
          <td>${esc(c.setor ?? '')}</td><td>${sit}</td>
          <td class="acoes">${btnIcone('fechar', 'Remover convite', `data-remover="${c.id}"`, 'link vermelho')}</td></tr>`;
      }).join('')}</tbody></table></div>
      ${visiveis.length > 500 ? `<p class="pequeno suave">Mostrando 500 de ${visiveis.length}. Use a busca para filtrar.</p>` : ''}`
    : vazio('pessoas', 'Nenhum convidado ainda', 'Use os filtros acima para convidar uma unidade ou setor inteiro.')}`;

  const filtrados = () => {
    const loja = box.querySelector('#c-loja').value, setor = box.querySelector('#c-setor').value, cargo = box.querySelector('#c-cargo').value;
    return ativos.filter(c => (!loja || c.loja === loja) && (!setor || c.setor === setor) && (!cargo || c.cargo === cargo));
  };
  const atualizarQtd = () => {
    const f = filtrados();
    const novos = f.filter(c => !ctx.convites.has(c.id)).length;
    box.querySelector('#c-qtd').textContent = `${f.length} no filtro · ${novos} ainda não convidado(s)`;
    box.querySelector('#c-filtro').innerHTML = `${icone('pessoaMais')} Convidar ${novos}`;
    box.querySelector('#c-filtro').disabled = !novos;
  };
  ['#c-loja', '#c-setor', '#c-cargo'].forEach(s => box.querySelector(s).addEventListener('change', atualizarQtd));
  atualizarQtd();
  box.querySelector('#c-filtro').addEventListener('click', () => convidar(filtrados().map(c => c.id)));
  box.querySelector('#c-mats-btn').addEventListener('click', () => {
    const porMat = new Map(ativos.map(c => [normMat(c.matricula), c.id]));
    const mats = box.querySelector('#c-mats').value.split(/[\s,;]+/).map(normMat).filter(Boolean);
    const achados = mats.map(m => porMat.get(m)).filter(Boolean);
    const faltando = mats.filter(m => !porMat.has(m));
    if (faltando.length) toast(`Não encontradas: ${faltando.slice(0, 10).join(', ')}${faltando.length > 10 ? '...' : ''}`, 'erro');
    if (achados.length) convidar(achados);
  });
  seletorPessoa(box.querySelector('#c-sel'), ativos.filter(c => !ctx.convites.has(c.id)), {
    placeholder: 'Buscar por nome ou matrícula...',
    detalhe: c => [c.matricula, c.loja, c.setor].filter(Boolean).join(' · '),
    onChange: p => { if (p) convidar([p.id]); },
  });
  const busca$ = box.querySelector('#c-busca');
  busca$.addEventListener('input', () => {
    ctx.buscaConv = busca$.value;
    abaConvidados();
    const novo = app.querySelector('#c-busca');
    novo.focus();
    novo.setSelectionRange(novo.value.length, novo.value.length);
  });
  box.querySelectorAll('[data-remover]').forEach(b => b.addEventListener('click', async () => {
    try {
      await exec(sb.from('convites').delete().eq('treinamento_id', ctx.t.id).eq('colaborador_id', b.dataset.remover));
    } catch (e) { toast(erroMsg(e), 'erro'); }
    await recarregarTreinamento();
  }));
  box.querySelector('#c-limpar')?.addEventListener('click', async () => {
    if (!await confirmar('Remover todos os convidados?', '<p>As inscrições já feitas não serão apagadas.</p>', { textoOk: 'Remover todos', perigo: true })) return;
    try { await exec(sb.from('convites').delete().eq('treinamento_id', ctx.t.id)); } catch (e) { toast(erroMsg(e), 'erro'); }
    await recarregarTreinamento();
  });
}

async function convidar(ids) {
  const novos = [...new Set(ids)].filter(id => !ctx.convites.has(id));
  if (!novos.length) return toast('Todos já estavam convidados.');
  try {
    await emLotes(novos, 500, lote => exec(sb.from('convites').upsert(
      lote.map(colaborador_id => ({ treinamento_id: ctx.t.id, colaborador_id })),
      { onConflict: 'treinamento_id,colaborador_id', ignoreDuplicates: true })));
    toast(`${novos.length} convidado(s) adicionado(s).`, 'ok');
  } catch (e) { toast(erroMsg(e), 'erro'); }
  await recarregarTreinamento();
}

// ------------------------------------------------------------------
//  Aba: Pendentes
// ------------------------------------------------------------------
function abaPendentes() {
  const box = app.querySelector('#aba');
  if (!ctx.convites.size) {
    box.innerHTML = vazio('pessoas', 'Sem convidados', 'Adicione convidados para acompanhar quem ainda não escolheu turma.');
    return;
  }
  const todos = pendentes();
  const lista = todos.filter(c => !ctx.filtroPend || c.loja === ctx.filtroPend);
  box.innerHTML = `
    <div class="ferramentas">
      <select id="p-loja" style="max-width:260px"><option value="">Todas as unidades</option>${opcoes(unicos(todos.map(c => c.loja)), ctx.filtroPend)}</select>
      <span class="pequeno suave">${lista.length} pendente(s)</span>
      <div class="linha empurra">
        <button type="button" id="p-copiar" ${lista.length ? '' : 'disabled'}>${icone('copiar')} Copiar lista</button>
        <button type="button" class="suave-btn" id="p-msg">${icone('mensagem')} Mensagem para WhatsApp</button>
        <button type="button" id="p-excel" ${lista.length ? '' : 'disabled'}>${icone('planilha')} Excel</button>
      </div>
    </div>
    ${lista.length ? `<div class="tabela-wrap"><table>
      <thead><tr><th>Colaborador</th><th>Unidade</th><th>Setor</th><th>Situação</th></tr></thead>
      <tbody>${lista.map(c => `<tr><td>${pessoaHtml(c.nome, c.matricula)}</td>
        <td>${esc(c.loja ?? '')}</td><td>${esc(c.setor ?? '')}</td>
        <td>${ctx.ativaPorColab.get(c.id)?.status === 'espera' ? '<span class="selo alerta">Na lista de espera</span>' : '<span class="selo erro">Sem turma</span>'}</td></tr>`).join('')}
      </tbody></table></div>`
    : `<div class="card vazio"><span class="icone-bola ok">${icone('ok')}</span><strong>Ninguém pendente</strong>Todos os convidados já escolheram a sua turma.</div>`}`;

  box.querySelector('#p-loja').addEventListener('change', e => { ctx.filtroPend = e.target.value; abaPendentes(); });
  box.querySelector('#p-copiar').addEventListener('click', () => {
    const porUnidade = new Map();
    lista.forEach(c => { const l = c.loja || 'Sem unidade'; porUnidade.set(l, [...(porUnidade.get(l) || []), c]); });
    const texto = `*${ctx.t.titulo}* — pendentes de inscrição\n` + [...porUnidade].map(([u, cs]) =>
      `\n*${u}*\n` + cs.map(c => `- ${c.nome} (${c.matricula})`).join('\n')).join('\n');
    copiarTexto(texto, 'Lista copiada!');
  });
  box.querySelector('#p-msg').addEventListener('click', () => copiarTexto(
    `Olá! Você ainda não escolheu a turma do treinamento *${ctx.t.titulo}*.\n` +
    `Acesse o link, escolha a melhor data e confirme sua vaga:\n${linkPublico(ctx.t.slug)}`, 'Mensagem copiada! Cole no WhatsApp.'));
  box.querySelector('#p-excel').addEventListener('click', () =>
    baixarExcel(`pendentes-${ctx.t.slug}.xlsx`, { Pendentes: linhasPendentes(lista) }));
}

const linhasPendentes = lista => lista.map(c => ({
  Matrícula: c.matricula, Nome: c.nome, Unidade: c.loja ?? '', Setor: c.setor ?? '', Cargo: c.cargo ?? '',
  Situação: ctx.ativaPorColab.get(c.id)?.status === 'espera' ? 'Na lista de espera' : 'Sem turma',
}));

function exportarTreinamento() {
  const linhaInsc = i => {
    const tu = ctx.turmaPorId.get(i.turma_id);
    const c = ctx.colabPorId.get(i.colaborador_id);
    return {
      Data: fmtDataCurta(tu.inicio), Dia: fmtSemana(tu.inicio), Horário: fmtPeriodo(tu.inicio, tu.fim), Local: tu.local,
      ...(livre() ? { Nome: i.nome_livre, Telefone: fmtTel(i.contato) }
        : { Matrícula: c?.matricula ?? '', Nome: c?.nome ?? '', Unidade: c?.loja ?? '', Setor: c?.setor ?? '', Cargo: c?.cargo ?? '' }),
      Situação: { confirmada: 'Confirmado', espera: 'Lista de espera', cancelada: 'Cancelado' }[i.status],
      Presença: i.presenca === true ? 'Presente' : i.presenca === false ? 'Faltou' : '',
      'Inscrito em': new Date(i.criado_em).toLocaleString('pt-BR'),
      Origem: i.origem === 'admin' ? 'Painel' : 'Link',
      ...(i.status === 'cancelada' ? { 'Cancelado em': i.cancelado_em ? new Date(i.cancelado_em).toLocaleString('pt-BR') : '' } : {}),
    };
  };
  const ordenar = (a, b) => a.turma_id === b.turma_id ? nomeInsc(a).localeCompare(nomeInsc(b), 'pt-BR')
    : ctx.turmaPorId.get(a.turma_id).inicio.localeCompare(ctx.turmaPorId.get(b.turma_id).inicio);
  const abas = {
    Turmas: ctx.turmas.map(tu => {
      const c = contagem(tu.id);
      return { Data: fmtDataCurta(tu.inicio), Dia: fmtSemana(tu.inicio), Horário: fmtPeriodo(tu.inicio, tu.fim), Local: tu.local,
        Endereço: tu.endereco ?? '', Vagas: tu.vagas, Confirmados: c.conf, 'Vagas livres': Math.max(0, tu.vagas - c.conf),
        'Lista de espera': c.esp, Presentes: c.pres, Faltas: c.falt };
    }),
    Inscritos: ctx.insc.filter(i => i.status !== 'cancelada').sort(ordenar).map(linhaInsc),
  };
  if (!livre() && ctx.convites.size) abas.Pendentes = linhasPendentes(pendentes());
  abas.Cancelamentos = ctx.insc.filter(i => i.status === 'cancelada').sort(ordenar).map(linhaInsc);
  baixarExcel(`${ctx.t.slug}.xlsx`, abas);
}

// ==================================================================
//  Colaboradores
// ==================================================================
const filtrosColab = { busca: '', loja: '', status: 'ativos', limite: 300 };

async function telaColaboradores() {
  app.innerHTML = CARREGANDO;
  await carregarColaboradores(true);
  desenharColaboradores();
}

function desenharColaboradores() {
  const todos = colaboradoresCache;
  const f = filtrosColab;
  const ativos = todos.filter(c => c.ativo);
  app.innerHTML = `
    <div class="pagina-topo">
      <div><div class="eyebrow">${icone('pessoas', 'p')} Cadastro</div><h1>Colaboradores</h1>
        <p class="sub">Lista usada para identificar participantes e enviar convites.</p></div>
      <div class="acoes">
        <button type="button" id="modelo">${icone('baixar')} Modelo</button>
        <button type="button" id="exportar" ${todos.length ? '' : 'disabled'}>${icone('planilha')} Exportar</button>
        <button type="button" class="suave-btn" id="importar">${icone('enviar')} Importar planilha</button>
        <button type="button" class="primario" id="novo">${icone('mais')} Novo</button>
      </div>
    </div>
    ${todos.length ? `<div class="kpis">
      ${kpi('pessoaOk', 'ok', ativos.length, 'Ativos', 0)}
      ${kpi('pessoa', '', todos.length - ativos.length, 'Inativos', 1)}
      ${kpi('predio', '', unicos(ativos.map(c => c.loja)).length, 'Unidades', 2)}
      ${kpi('camadas', '', unicos(ativos.map(c => c.setor)).length, 'Setores', 3)}
    </div>
    <div class="ferramentas">
      <div class="com-icone">${icone('busca')}<input type="search" id="busca" placeholder="Buscar nome, matrícula, setor..." value="${esc(f.busca)}"></div>
      <select id="loja"><option value="">Todas as unidades</option>${opcoes(unicos(todos.map(c => c.loja)), f.loja)}</select>
      <select id="status">
        <option value="ativos" ${f.status === 'ativos' ? 'selected' : ''}>Ativos</option>
        <option value="inativos" ${f.status === 'inativos' ? 'selected' : ''}>Inativos</option>
        <option value="todos" ${f.status === 'todos' ? 'selected' : ''}>Todos</option></select>
      <span class="pequeno suave" id="qtd"></span>
    </div>
    <div id="tabela"></div>`
    : vazio('pessoas', 'Nenhum colaborador cadastrado', 'Baixe o modelo, preencha no Excel e importe a planilha.',
      `<button type="button" class="primario" data-importar>${icone('enviar')} Importar planilha</button>`)}`;

  const desenharTabela = () => {
    const busca = normalizar(f.busca);
    const lista = todos.filter(c =>
      (f.status === 'todos' || (f.status === 'ativos') === c.ativo)
      && (!f.loja || c.loja === f.loja)
      && (!busca || normalizar(`${c.nome} ${c.matricula} ${c.setor} ${c.cargo}`).includes(busca)));
    app.querySelector('#qtd').textContent = `${lista.length} colaborador(es)`;
    const tabela = app.querySelector('#tabela');
    tabela.innerHTML = lista.length ? `<div class="tabela-wrap"><table>
      <thead><tr><th>Colaborador</th><th>Unidade</th><th>Setor</th><th>Cargo</th><th>Situação</th><th></th></tr></thead>
      <tbody>${lista.slice(0, f.limite).map(c => `<tr>
        <td>${pessoaHtml(c.nome, c.matricula)}</td><td>${esc(c.loja ?? '')}</td>
        <td>${esc(c.setor ?? '')}</td><td>${esc(c.cargo ?? '')}</td>
        <td>${c.ativo ? '<span class="selo ok">Ativo</span>' : '<span class="selo">Inativo</span>'}</td>
        <td class="acoes">${btnIcone('editar', 'Editar', `data-editar="${c.id}"`)}</td></tr>`).join('')}
      </tbody></table></div>
      ${lista.length > f.limite ? `<p class="centro mt"><button type="button" id="mais">Mostrar mais (${lista.length - f.limite} restantes)</button></p>` : ''}`
      : vazio('busca', 'Nada encontrado', 'Ajuste a busca ou os filtros.');
    tabela.querySelector('#mais')?.addEventListener('click', () => { f.limite += 300; desenharTabela(); });
    tabela.querySelectorAll('[data-editar]').forEach(b => b.addEventListener('click', () =>
      formColaborador(colaboradoresCache.find(c => c.id === b.dataset.editar))));
  };
  if (todos.length) {
    desenharTabela();
    app.querySelector('#busca').addEventListener('input', e => { f.busca = e.target.value; f.limite = 300; desenharTabela(); });
    app.querySelector('#loja').addEventListener('change', e => { f.loja = e.target.value; f.limite = 300; desenharTabela(); });
    app.querySelector('#status').addEventListener('change', e => { f.status = e.target.value; f.limite = 300; desenharTabela(); });
  }
  app.querySelector('#novo').addEventListener('click', () => formColaborador(null));
  app.querySelectorAll('#importar, [data-importar]').forEach(b => b.addEventListener('click', importarColaboradores));
  app.querySelector('#modelo').addEventListener('click', () => baixarExcel('modelo-colaboradores.xlsx', {
    Colaboradores: [
      { matricula: '1001', nome: 'Maria da Silva', unidade: 'Sede', setor: 'Financeiro', cargo: 'Analista' },
      { matricula: '1002', nome: 'João Pereira', unidade: 'Unidade Norte', setor: 'Operações', cargo: 'Coordenador' },
    ],
  }));
  app.querySelector('#exportar').addEventListener('click', () => baixarExcel('colaboradores.xlsx', {
    Colaboradores: todos.map(c => ({ matricula: c.matricula, nome: c.nome, unidade: c.loja ?? '', setor: c.setor ?? '',
      cargo: c.cargo ?? '', ativo: c.ativo ? 'sim' : 'não' })),
  }));
}

function formColaborador(c) {
  const v = c || { matricula: '', nome: '', loja: '', setor: '', cargo: '', ativo: true };
  const todos = colaboradoresCache;
  const lista = (id, campo) => `<datalist id="${id}">${unicos(todos.map(x => x[campo])).map(x => `<option value="${esc(x)}">`).join('')}</datalist>`;
  const botoes = [];
  if (c) botoes.push({ texto: 'Excluir', icone: 'lixo', classe: 'perigo', acao: async () => {
    const ok = await confirmar('Excluir colaborador?',
      `<p><strong>${esc(c.nome)}</strong></p><div class="aviso alerta">${icone('alerta')}<span>O histórico de inscrições e presença desta pessoa também será apagado.
        Para quem saiu da organização, prefira <strong>desligar "Ativo"</strong>.</span></div>`, { textoOk: 'Excluir', perigo: true });
    if (!ok) return false;
    await exec(sb.from('colaboradores').delete().eq('id', c.id));
    toast('Colaborador excluído.', 'ok');
    colaboradoresCache = colaboradoresCache.filter(x => x.id !== c.id);
    desenharColaboradores();
  } });
  botoes.push({ texto: 'Cancelar' }, {
    texto: 'Salvar', classe: 'primario',
    acao: async m => {
      const dados = {
        matricula: m.$('#c-mat').value.trim(),
        nome: m.$('#c-nome').value.trim().replace(/\s+/g, ' '),
        loja: m.$('#c-loja').value.trim() || null,
        setor: m.$('#c-setor').value.trim() || null,
        cargo: m.$('#c-cargo').value.trim() || null,
        ativo: m.$('#c-ativo').checked,
      };
      if (!dados.matricula || !dados.nome) { toast('Matrícula e nome são obrigatórios.', 'erro'); return false; }
      if (c) await exec(sb.from('colaboradores').update(dados).eq('id', c.id));
      else await exec(sb.from('colaboradores').insert(dados));
      toast('Colaborador salvo.', 'ok');
      await telaColaboradores();
    },
  });
  const m = abrirModal({
    titulo: c ? 'Editar colaborador' : 'Novo colaborador',
    icone: 'pessoa',
    corpo: `
      <div class="grid2">
        <div class="campo"><label for="c-mat">Matrícula</label><input type="text" id="c-mat" value="${esc(v.matricula)}"></div>
        <div class="campo"><label for="c-nome">Nome completo</label><input type="text" id="c-nome" value="${esc(v.nome)}"></div>
        <div class="campo"><label for="c-loja">Unidade</label><input type="text" id="c-loja" list="dl-loja" value="${esc(v.loja ?? '')}">${lista('dl-loja', 'loja')}</div>
        <div class="campo"><label for="c-setor">Setor</label><input type="text" id="c-setor" list="dl-setor" value="${esc(v.setor ?? '')}">${lista('dl-setor', 'setor')}</div>
        <div class="campo"><label for="c-cargo">Cargo</label><input type="text" id="c-cargo" list="dl-cargo" value="${esc(v.cargo ?? '')}">${lista('dl-cargo', 'cargo')}</div>
      </div>
      <label class="interruptor" style="margin:0"><input type="checkbox" id="c-ativo" ${v.ativo ? 'checked' : ''}>
        <span><strong>Ativo</strong><small>Aparece nas listas de inscrição e de convites.</small></span></label>`,
    botoes,
  });
  m.$(c ? '#c-nome' : '#c-mat').focus();
}

// Converte o cabeçalho da planilha para o campo do banco
const CABECALHOS = {
  matricula: ['matricula', 'mat', 'registro', 'chapa', 'codigo', 'cod', 're', 'id'],
  nome: ['nome', 'nomecompleto', 'colaborador', 'funcionario', 'participante'],
  loja: ['unidade', 'loja', 'filial', 'empresa', 'local'],
  setor: ['setor', 'departamento', 'depto', 'secao', 'area'],
  cargo: ['cargo', 'funcao'],
};
const campoDoCabecalho = h => {
  const k = normalizar(h).replace(/[^a-z]/g, '');
  return Object.keys(CABECALHOS).find(campo => CABECALHOS[campo].includes(k));
};

function lerPlanilha(arquivo) {
  return arquivo.arrayBuffer().then(buf => {
    let wb = XLSX.read(buf, { type: 'array' });
    let linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
    // CSV salvo pelo Excel em português usa ";" como separador
    if (linhas.length && Object.keys(linhas[0]).length === 1 && Object.keys(linhas[0])[0].includes(';')) {
      wb = XLSX.read(new TextDecoder().decode(buf), { type: 'string', FS: ';' });
      linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
    }
    return linhas;
  });
}

function importarColaboradores() {
  let preparado = null;
  const m = abrirModal({
    titulo: 'Importar colaboradores',
    icone: 'enviar',
    corpo: `
      <p>Envie uma planilha <strong>.xlsx</strong> (ou .csv) com as colunas <strong>matricula</strong> e <strong>nome</strong>
        e, se quiser, <strong>unidade</strong>, <strong>setor</strong> e <strong>cargo</strong>.</p>
      <p class="pequeno suave">Quem já existe (mesma matrícula) é atualizado; quem não existe é criado. Reenvie sempre que houver mudanças.</p>
      <div class="campo"><input type="file" id="arquivo" accept=".xlsx,.xls,.csv"></div>
      <div id="previa"></div>
      <label class="interruptor" style="margin:0"><input type="checkbox" id="inativar">
        <span><strong>Inativar quem não está na planilha</strong><small>Útil para tirar das listas quem saiu da organização.</small></span></label>`,
    botoes: [{ texto: 'Cancelar' }, {
      texto: 'Importar', classe: 'primario',
      acao: async m => {
        if (!preparado?.validos.length) { toast('Escolha uma planilha válida.', 'erro'); return false; }
        const { validos, ausentes } = preparado;
        await emLotes(validos, 500, lote => exec(sb.from('colaboradores').upsert(lote, { onConflict: 'matricula' })));
        if (m.$('#inativar').checked && ausentes.length) {
          await emLotes(ausentes.map(c => c.id), 100, lote => exec(sb.from('colaboradores').update({ ativo: false }).in('id', lote)));
        }
        toast(`${validos.length} colaborador(es) importado(s).`, 'ok');
        await telaColaboradores();
      },
    }],
  });

  m.$('#arquivo').addEventListener('change', async e => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    const previa = m.$('#previa');
    try {
      const linhas = await lerPlanilha(arquivo);
      const existentes = new Map(colaboradoresCache.map(c => [normMat(c.matricula), c]));
      const porMat = new Map();
      let invalidas = 0;
      for (const linha of linhas) {
        const r = {};
        for (const [h, v] of Object.entries(linha)) {
          const campo = campoDoCabecalho(h);
          if (campo && !r[campo]) r[campo] = String(v).trim().replace(/\s+/g, ' ');
        }
        if (!r.matricula || !r.nome) { invalidas++; continue; }
        // usa a matrícula já cadastrada quando só diferem zeros à esquerda (Excel costuma removê-los)
        const existente = existentes.get(normMat(r.matricula));
        const matricula = existente ? existente.matricula : r.matricula;
        porMat.set(normMat(matricula), {
          matricula, nome: r.nome, loja: r.loja || null, setor: r.setor || null, cargo: r.cargo || null, ativo: true,
        });
      }
      const validos = [...porMat.values()];
      const novos = validos.filter(v => !existentes.has(normMat(v.matricula))).length;
      const ausentes = colaboradoresCache.filter(c => c.ativo && !porMat.has(normMat(c.matricula)));
      preparado = { validos, ausentes };
      previa.innerHTML = !validos.length
        ? `<div class="aviso erro">${icone('alerta')}<span>Nenhuma linha válida. Confira se a primeira linha tem os títulos <strong>matricula</strong> e <strong>nome</strong>.</span></div>`
        : `<div class="aviso ok">${icone('ok')}<span><strong>${validos.length}</strong> colaborador(es) encontrados: ${novos} novo(s), ${validos.length - novos} atualização(ões).
            ${invalidas ? `<br>${invalidas} linha(s) ignorada(s) por falta de matrícula ou nome.` : ''}
            ${ausentes.length ? `<br>${ausentes.length} colaborador(es) ativo(s) do cadastro não estão na planilha.` : ''}</span></div>
          <div class="tabela-wrap" style="margin-bottom:14px"><table><thead><tr><th>Colaborador</th><th>Unidade</th><th>Setor</th></tr></thead>
          <tbody>${validos.slice(0, 5).map(v => `<tr><td>${pessoaHtml(v.nome, v.matricula)}</td><td>${esc(v.loja ?? '')}</td>
            <td>${esc(v.setor ?? '')}</td></tr>`).join('')}</tbody></table></div>
          ${validos.length > 5 ? `<p class="pequeno suave">... e mais ${validos.length - 5}.</p>` : ''}`;
    } catch (err) {
      preparado = null;
      previa.innerHTML = `<div class="aviso erro">${icone('alerta')}<span>Não foi possível ler o arquivo: ${esc(erroMsg(err))}</span></div>`;
    }
  });
}
