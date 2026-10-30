// Página pública: o participante se identifica e escolhe a turma
import {
  sb, aplicarMarca, configurado, esc, erroMsg, toast, abrirModal, confirmar, seletorPessoa, baixarArquivo,
  icone, avatar, barraHtml, vagasInfo, fmtData, fmtDia, fmtMes, fmtDiaSemana, fmtPeriodo, fmtTurma, linkMapa,
} from './common.js';

const app = document.getElementById('app');
const slug = new URLSearchParams(location.search).get('t');

let dados = null;   // resultado de pub_treinamento
let ident = null;   // parâmetros de identificação já validados
let estado = null;  // resultado de pub_consultar / pub_inscrever / pub_cancelar
let seletor = null;
let filtroLocal = '';

aplicarMarca();
iniciar();

async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw error;
  return data;
}

function telaErro(titulo, msg) {
  app.innerHTML = `
    <section class="hero"><div class="hero-inner"><h1>${esc(titulo)}</h1></div></section>
    <main class="conteudo"><div class="card vazio">
      <span class="icone-bola erro">${icone('alerta')}</span>
      <strong>Algo não saiu como esperado</strong><p>${msg}</p>
    </div></main>`;
}

async function iniciar() {
  if (!configurado()) {
    telaErro('Quase lá', '');
    app.querySelector('.vazio p').innerHTML = 'O app ainda não foi configurado. Edite o arquivo <code>js/config.js</code> com os dados do Supabase.';
    return;
  }
  if (!slug) return listarTreinamentos();
  try {
    dados = await rpc('pub_treinamento', { p_slug: slug });
  } catch (e) {
    telaErro('Treinamento indisponível', esc(erroMsg(e)));
    return;
  }
  document.title = dados.treinamento.titulo + ' · Inscrição';
  desenhar();
}

async function listarTreinamentos() {
  try {
    const lista = await rpc('pub_listar_treinamentos');
    app.innerHTML = `
      <section class="hero"><div class="hero-inner">
        <div class="eyebrow">${icone('capelo', 'p')} Agenda</div>
        <h1>Treinamentos com inscrições abertas</h1>
        <p class="descricao">Escolha um treinamento para ver as turmas e garantir sua vaga.</p>
      </div></section>
      <main class="conteudo">${lista.length
        ? `<div class="lista-treinos">${lista.map((t, i) => `
            <a class="card" href="?t=${encodeURIComponent(t.slug)}" style="--i:${i}">
              <span class="icone-bola">${icone('capelo')}</span>
              <h2 style="margin:8px 0 0">${esc(t.titulo)}</h2>
              ${t.descricao ? `<p class="suave" style="margin:0">${esc(t.descricao)}</p>` : ''}
              <div class="info-linhas mt">
                <div class="info-linha">${icone('calendario')} Próxima turma: ${esc(fmtData(t.proxima))}</div>
                <div class="info-linha">${icone('camadas')} ${t.turmas} turma(s) disponível(is)</div>
              </div>
              <span class="ir">Ver turmas ${icone('seta', 'p')}</span>
            </a>`).join('')}</div>`
        : `<div class="card vazio"><span class="icone-bola">${icone('calendario')}</span>
            <strong>Nenhuma inscrição aberta</strong>Volte em breve para conferir novos treinamentos.</div>`}
      </main>`;
  } catch (e) {
    telaErro('Treinamentos', esc(erroMsg(e)));
  }
}

async function recarregarTurmas() {
  try { dados = await rpc('pub_treinamento', { p_slug: slug }); } catch { /* mantém os dados anteriores */ }
}

// ------------------------------------------------------------------
function desenhar() {
  const t = dados.treinamento;
  const livres = dados.turmas.reduce((s, x) => s + vagasInfo(x.vagas, x.ocupadas).livres, 0);
  app.innerHTML = `
    <section class="hero"><div class="hero-inner">
      <div class="eyebrow">${icone('capelo', 'p')} Inscrições abertas</div>
      <h1>${esc(t.titulo)}</h1>
      ${t.descricao ? `<p class="descricao">${esc(t.descricao).replace(/\n/g, '<br>')}</p>` : ''}
      <div class="chips">
        <span class="chip">${icone('calendario')} ${dados.turmas.length} ${dados.turmas.length === 1 ? 'turma' : 'turmas'}</span>
        <span class="chip">${icone('pessoas')} ${livres} ${livres === 1 ? 'vaga disponível' : 'vagas disponíveis'}</span>
        <span class="chip">${icone('relogio')} Trocas até ${t.horas_limite_alteracao}h antes</span>
        ${t.lista_espera ? `<span class="chip">${icone('ampulheta')} Lista de espera</span>` : ''}
      </div>
    </div></section>
    <main class="conteudo">
      <div class="stepper" id="stepper"></div>
      <section class="card" id="ident"></section>
      <div id="minha"></div>
      <div class="secao-cab"><div><h2>Turmas disponíveis</h2><p class="suave pequeno" id="dica"></p></div></div>
      <div class="filtros" id="filtros"></div>
      <div class="turmas" id="turmas"></div>
    </main>`;
  desenharStepper();
  desenharIdent();
  desenharMinha();
  desenharTurmas();
}

function desenharStepper() {
  const i = estado?.inscricao;
  const passos = [
    ['Identificação', ident ? 'feito' : 'ativo'],
    ['Escolha da turma', i ? 'feito' : ident ? 'ativo' : ''],
    [i?.status === 'espera' ? 'Na lista de espera' : 'Confirmação', i ? (i.status === 'confirmada' ? 'feito' : 'ativo') : ''],
  ];
  document.getElementById('stepper').innerHTML = passos.map(([r, s], n) =>
    `<div class="step ${s}"><span class="num">${s === 'feito' ? icone('ok', 'p') : n + 1}</span>${r}</div>`).join('');
}

function desenharIdent() {
  const box = document.getElementById('ident');
  if (ident) {
    box.innerHTML = `<div class="perfil">${avatar(estado.pessoa.nome, 'g')}
        <div class="pessoa"><div><small>Você está identificado(a) como</small><strong>${esc(estado.pessoa.nome)}</strong></div></div>
        <button type="button" class="link pequeno-btn" id="sair">Não sou eu</button>
      </div>`;
    box.querySelector('#sair').addEventListener('click', () => { ident = null; estado = null; seletor = null; desenhar(); });
    return;
  }

  const modo = dados.treinamento.modo_identificacao;
  const usaLista = modo === 'nome' || modo === 'nome_matricula';
  const usaMatricula = modo === 'matricula' || modo === 'nome_matricula';
  const instrucao = {
    nome: 'Encontre o seu nome na lista.',
    nome_matricula: 'Encontre o seu nome e confirme com a sua matrícula.',
    matricula: 'Informe a sua matrícula para continuar.',
    livre: 'Informe seu nome e telefone para reservar a vaga.',
  }[modo];
  box.innerHTML = `
    <div class="card-cab"><span class="icone-bola">${icone('pessoa')}</span>
      <div><h2>Identifique-se</h2><p class="suave pequeno" style="margin:0">${instrucao}</p></div></div>
    <div id="erro-ident"></div>
    ${usaLista ? `<div class="campo"><label>Seu nome</label><div id="sel"></div></div>` : ''}
    ${usaMatricula ? `<div class="campo"><label for="mat">Sua matrícula</label>
        <div class="com-icone">${icone('cadeado')}<input type="text" id="mat" autocomplete="off" placeholder="Ex.: 12345"></div></div>` : ''}
    ${modo === 'livre' ? `<div class="grid2">
      <div class="campo"><label for="nome">Nome completo</label>
        <div class="com-icone">${icone('pessoa')}<input type="text" id="nome" autocomplete="name" placeholder="Seu nome e sobrenome"></div></div>
      <div class="campo"><label for="tel">Telefone / WhatsApp</label>
        <div class="com-icone">${icone('mensagem')}<input type="tel" id="tel" autocomplete="tel" placeholder="(00) 00000-0000"></div>
        <div class="ajuda">Usado para consultar ou alterar sua inscrição.</div></div></div>` : ''}
    <button type="button" class="primario grande-btn largura-total" id="btn-ident">Continuar ${icone('seta')}</button>`;

  if (usaLista) {
    if (!dados.pessoas?.length) {
      box.querySelector('#sel').innerHTML = `<div class="aviso alerta">${icone('info')}<span>A lista de participantes ainda não foi liberada.</span></div>`;
    } else {
      seletor = seletorPessoa(box.querySelector('#sel'), dados.pessoas, {
        placeholder: 'Comece a digitar seu nome...',
        onChange: p => { if (p && usaMatricula) box.querySelector('#mat')?.focus(); },
      });
    }
  }
  box.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.target.closest('.seletor')) identificar();
  }));
  box.querySelector('#btn-ident').addEventListener('click', identificar);
}

async function identificar() {
  const box = document.getElementById('ident');
  const val = id => box.querySelector(id)?.value ?? null;
  const params = {
    p_colaborador: seletor?.get()?.id ?? null,
    p_matricula: val('#mat'),
    p_nome: val('#nome'),
    p_contato: val('#tel'),
  };
  const btn = box.querySelector('#btn-ident');
  btn.disabled = true;
  try {
    estado = await rpc('pub_consultar', { p_slug: slug, ...params });
    ident = params;
    desenhar();
    document.getElementById(estado.inscricao ? 'minha' : 'turmas').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    box.querySelector('#erro-ident').innerHTML = `<div class="aviso erro">${icone('alerta')}<span>${esc(erroMsg(e))}</span></div>`;
    btn.disabled = false;
  }
}

function infoTurma(tu) {
  return `<div class="info-linhas">
    <div class="info-linha">${icone('relogio')}<span>${esc(fmtPeriodo(tu.inicio, tu.fim))}</span></div>
    <div class="info-linha">${icone('local')}<span><strong>${esc(tu.local)}</strong>${tu.endereco
      ? `<br><a href="${linkMapa(tu.endereco)}" target="_blank" rel="noopener">${esc(tu.endereco)}</a>` : ''}</span></div>
    ${tu.observacao ? `<div class="info-linha">${icone('info')}<span>${esc(tu.observacao)}</span></div>` : ''}
  </div>`;
}

function desenharMinha() {
  const box = document.getElementById('minha');
  const i = estado?.inscricao;
  if (!estado) { box.innerHTML = ''; return; }
  if (!i) {
    box.innerHTML = `<div class="aviso info">${icone('info')}<span>Você ainda não escolheu uma turma. Escolha uma das opções abaixo.</span></div>`;
    return;
  }
  const tu = i.turma;
  const horas = dados.treinamento.horas_limite_alteracao;
  const espera = i.status === 'espera';
  box.innerHTML = `
    <section class="ticket ${espera ? 'espera' : ''}">
      <div class="ticket-data"><span class="dia">${fmtDia(tu.inicio)}</span><span class="mes">${esc(fmtMes(tu.inicio))}</span>
        <span class="sem">${esc(fmtDiaSemana(tu.inicio))}</span></div>
      <div class="ticket-corpo">
        ${espera ? `<span class="selo alerta">Lista de espera · ${i.posicao_espera}º da fila</span>` : '<span class="selo ok">Inscrição confirmada</span>'}
        <h3>${espera ? 'Você está na lista de espera' : 'Sua vaga está garantida'}</h3>
        ${infoTurma(tu)}
        ${espera ? `<p class="pequeno suave mt" style="margin-bottom:0">Se uma vaga for liberada, você é confirmado(a) automaticamente, pela ordem da fila. Volte aqui para conferir.</p>` : ''}
        ${!i.alteravel ? `<p class="pequeno suave mt" style="margin-bottom:0">Trocas e cancelamentos só até ${horas}h antes do início. Precisa mudar? Fale com o responsável pelo treinamento.</p>`
          : `<p class="pequeno suave mt" style="margin-bottom:0">Quer outra data? Escolha uma turma abaixo${horas ? ` (até ${horas}h antes do início)` : ''}.</p>`}
        <div class="acoes">
          ${!espera ? `<button type="button" class="suave-btn" id="ics">${icone('calendarioMais')} Adicionar à agenda</button>` : ''}
          ${i.alteravel ? `<button type="button" class="link vermelho" id="cancelar">${icone('fechar')} ${espera ? 'Sair da lista de espera' : 'Cancelar inscrição'}</button>` : ''}
        </div>
      </div>
    </section>`;
  box.querySelector('#ics')?.addEventListener('click', baixarIcs);
  box.querySelector('#cancelar')?.addEventListener('click', cancelar);
}

function desenharTurmas() {
  const box = document.getElementById('turmas');
  const t = dados.treinamento;
  const minha = estado?.inscricao;
  const travado = minha && !minha.alteravel;
  document.getElementById('dica').textContent = !ident ? 'Identifique-se acima para escolher a sua turma.'
    : travado ? 'O prazo para trocar de turma já terminou.' : 'Toque em uma turma para confirmar sua vaga.';

  const locais = [...new Set(dados.turmas.map(x => x.local))];
  const filtros = document.getElementById('filtros');
  if (locais.length > 1) {
    if (!locais.includes(filtroLocal)) filtroLocal = '';
    filtros.innerHTML = ['', ...locais].map(l =>
      `<button type="button" class="filtro ${l === filtroLocal ? 'ativo' : ''}" data-local="${esc(l)}">${l ? esc(l) : 'Todos os locais'}</button>`).join('');
    filtros.querySelectorAll('[data-local]').forEach(b => b.addEventListener('click', () => { filtroLocal = b.dataset.local; desenharTurmas(); }));
  } else {
    filtros.innerHTML = '';
  }

  const turmas = dados.turmas.filter(tu => !filtroLocal || tu.local === filtroLocal);
  if (!turmas.length) {
    box.innerHTML = `<div class="card vazio" style="grid-column:1/-1"><span class="icone-bola">${icone('calendario')}</span>
      <strong>Nenhuma turma disponível</strong>Novas datas podem ser abertas em breve.</div>`;
    return;
  }
  box.innerHTML = turmas.map((tu, n) => {
    const { livres } = vagasInfo(tu.vagas, tu.ocupadas);
    const eMinha = minha?.turma_id === tu.id;
    let fita = '';
    if (eMinha) fita = minha.status === 'espera' ? '<span class="selo alerta fita">Você está na espera</span>' : '<span class="selo ok fita">Sua turma</span>';
    else if (!livres) fita = '<span class="selo erro fita">Lotada</span>';
    else if (livres <= 3) fita = '<span class="selo alerta fita">Últimas vagas</span>';

    let acao;
    if (eMinha) acao = '';
    else if (travado) acao = '';
    else if (livres > 0) acao = `<button type="button" class="primario" data-turma="${tu.id}">Escolher esta turma ${icone('seta')}</button>`;
    else if (t.lista_espera) acao = `<button type="button" data-turma="${tu.id}">${icone('ampulheta')} Entrar na lista de espera</button>`;
    else acao = '<button type="button" disabled>Turma lotada</button>';

    return `
      <article class="turma ${eMinha ? 'minha' : ''} ${!livres ? 'lotada' : ''}" style="--i:${n}">
        <div class="turma-topo">
          <div class="data-tile"><span class="mes">${esc(fmtMes(tu.inicio))}</span><span class="dia">${fmtDia(tu.inicio)}</span></div>
          <div class="turma-quando"><strong>${esc(fmtDiaSemana(tu.inicio))}</strong><span>${icone('relogio')} ${esc(fmtPeriodo(tu.inicio, tu.fim))}</span></div>
          ${fita}
        </div>
        <div class="info-linhas">
          <div class="info-linha">${icone('local')}<span><strong>${esc(tu.local)}</strong>${tu.endereco
            ? `<br><a href="${linkMapa(tu.endereco)}" target="_blank" rel="noopener">${esc(tu.endereco)}</a>` : ''}</span></div>
          ${tu.observacao ? `<div class="info-linha">${icone('info')}<span>${esc(tu.observacao)}</span></div>` : ''}
        </div>
        <div class="ocupacao">
          <div class="ocupacao-texto"><span>${livres > 0 ? `${livres} ${livres === 1 ? 'vaga disponível' : 'vagas disponíveis'}`
            : `Sem vagas${tu.espera ? ` · ${tu.espera} na espera` : ''}`}</span><strong>${tu.ocupadas}/${tu.vagas}</strong></div>
          ${barraHtml(tu.vagas, tu.ocupadas)}
        </div>
        ${acao ? `<div class="turma-acao">${acao}</div>` : ''}
      </article>`;
  }).join('');
  box.querySelectorAll('[data-turma]').forEach(b => b.addEventListener('click', () => escolher(b.dataset.turma)));
}

// ------------------------------------------------------------------
async function escolher(turmaId) {
  if (!ident) {
    const box = document.getElementById('ident');
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    box.querySelector('#erro-ident').innerHTML = `<div class="aviso alerta">${icone('info')}<span>Identifique-se primeiro para escolher a turma.</span></div>`;
    return;
  }
  const tu = dados.turmas.find(x => x.id === turmaId);
  const lotada = tu.ocupadas >= tu.vagas;
  const atual = estado.inscricao;
  let html = `<div class="resumo" style="margin:0 0 14px"><strong>${esc(fmtData(tu.inicio))}</strong>${infoTurma(tu).replace('class="info-linhas"', 'class="info-linhas mt"')}</div>`;
  if (lotada) {
    html += `<div class="aviso alerta">${icone('ampulheta')}<span>Esta turma está lotada. Você entra na <strong>lista de espera</strong> (${tu.espera + 1}º da fila) e é confirmado(a) automaticamente se uma vaga for liberada.</span></div>`;
  }
  if (atual) {
    html += `<div class="aviso info">${icone('mover')}<span>Sua inscrição atual (${esc(fmtTurma(atual.turma))}) será cancelada${
      lotada && atual.status === 'confirmada' ? ' e <strong>você perde a vaga garantida</strong>' : ''}.</span></div>`;
  }
  const ok = await confirmar(lotada ? 'Entrar na lista de espera?' : atual ? 'Trocar de turma?' : 'Confirmar inscrição?', html,
    { textoOk: lotada ? 'Entrar na espera' : 'Confirmar', icone: lotada ? 'ampulheta' : 'calendario' });
  if (!ok) return;
  try {
    estado = await rpc('pub_inscrever', { p_slug: slug, p_turma: turmaId, ...ident });
  } catch (e) {
    toast(erroMsg(e), 'erro');
    await recarregarTurmas();
    desenhar();
    return;
  }
  await recarregarTurmas();
  desenhar();
  if (estado.mensagem === 'Você já está nesta turma.') toast(estado.mensagem);
  else celebrar();
}

function celebrar() {
  const i = estado.inscricao;
  const espera = i.status === 'espera';
  abrirModal({
    titulo: '',
    corpo: `<div class="sucesso ${espera ? 'espera' : ''}">
        <svg class="check" viewBox="0 0 84 84" aria-hidden="true"><circle class="circulo" cx="42" cy="42" r="36"/>
          <path class="visto" d="${espera ? 'M42 26v18l11 7' : 'M27 43l10 10 20-21'}"/></svg>
        <h2>${espera ? 'Você está na lista de espera' : 'Inscrição confirmada!'}</h2>
        <p class="suave">${espera ? `Você é o ${i.posicao_espera}º da fila. Se uma vaga abrir, sua inscrição é confirmada automaticamente.`
          : `Tudo certo, ${esc(estado.pessoa.nome.split(' ')[0])}. Te esperamos lá!`}</p>
        <div class="resumo"><strong>${esc(fmtData(i.turma.inicio))}</strong>${infoTurma(i.turma).replace('class="info-linhas"', 'class="info-linhas mt"')}</div>
      </div>`,
    botoes: [
      ...(!espera ? [{ texto: 'Adicionar à agenda', icone: 'calendarioMais', acao: () => { baixarIcs(); return false; } }] : []),
      { texto: 'Concluir', classe: 'primario' },
    ],
  });
  document.getElementById('minha').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function cancelar() {
  const espera = estado.inscricao.status === 'espera';
  const ok = await confirmar(espera ? 'Sair da lista de espera?' : 'Cancelar inscrição?',
    `<p>${esc(fmtTurma(estado.inscricao.turma))}</p><p class="suave" style="margin:0">Sua vaga será liberada para outra pessoa.</p>`,
    { textoOk: espera ? 'Sair da espera' : 'Cancelar inscrição', perigo: true });
  if (!ok) return;
  try {
    estado = await rpc('pub_cancelar', { p_slug: slug, ...ident });
    toast(estado.mensagem, 'ok');
  } catch (e) {
    toast(erroMsg(e), 'erro');
  }
  await recarregarTurmas();
  desenhar();
}

function baixarIcs() {
  const tu = estado.inscricao.turma;
  const ics = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const txt = s => String(s || '').replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');
  const fim = tu.fim || new Date(new Date(tu.inicio).getTime() + 3600e3).toISOString();
  const conteudo = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Agenda de Treinamentos//PT-BR', 'BEGIN:VEVENT',
    `UID:${estado.inscricao.id}@treinamentos`,
    `DTSTAMP:${ics(new Date())}`,
    `DTSTART:${ics(tu.inicio)}`,
    `DTEND:${ics(fim)}`,
    `SUMMARY:${txt(dados.treinamento.titulo)}`,
    `LOCATION:${txt([tu.local, tu.endereco].filter(Boolean).join(' - '))}`,
    `DESCRIPTION:${txt(tu.observacao || '')}`,
    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Lembrete de treinamento', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  baixarArquivo('treinamento.ics', conteudo, 'text/calendar');
}
