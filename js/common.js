// Funções compartilhadas entre a página pública e o painel
const cfg = window.APP_CONFIG;

export const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

export function configurado() {
  return !cfg.SUPABASE_URL.includes('SEU-PROJETO') && !cfg.SUPABASE_ANON_KEY.includes('SUA-CHAVE');
}

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const normalizar = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function erroMsg(e) {
  if (!e) return 'Erro desconhecido.';
  if (e.code === '23505') return 'Registro duplicado: já existe um cadastro com esses dados.';
  if (e.message?.includes('Failed to fetch')) return 'Sem conexão com o servidor. Verifique sua internet.';
  return e.message || String(e);
}

// ---------- ícones (traço no estilo Lucide) ----------
const ICONES = {
  calendario: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  calendarioMais: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4"/>',
  relogio: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  local: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  pessoas: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  pessoaOk: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>',
  pessoaMais: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  pessoa: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  qr: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3M21 21v.01M12 7v3a2 2 0 0 1-2 2H7M3 12h.01M12 3h.01M12 16v.01M16 12h1M21 12v.01M12 21v-1"/>',
  editar: '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  copiar: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  lixo: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  baixar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  enviar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  busca: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  fechar: '<path d="M18 6 6 18M6 6l12 12"/>',
  ok: '<path d="M20 6 9 17l-5-5"/>',
  voltar: '<path d="m15 18-6-6 6-6"/>',
  seta: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  lua: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  alerta: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  impressora: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
  ampulheta: '<path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
  predio: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
  capelo: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  planilha: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M8 13h2M14 13h2M8 17h2M14 17h2"/>',
  mensagem: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  cadeado: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  checklist: '<path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8"/>',
  mover: '<path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/>',
  grafico: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
  camadas: '<path d="m12.83 2.18 8.58 3.91a1 1 0 0 1 0 1.83l-8.58 3.9a2 2 0 0 1-1.66 0L2.6 7.93a1 1 0 0 1 0-1.83l8.58-3.9a2 2 0 0 1 1.66 0Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65M22 12.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  escudo: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  raio: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
};
export const icone = (nome, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nome] || ''}</svg>`;

// ---------- identidade visual ----------
const iniciais = nome => {
  const p = String(nome || '?').trim().split(/\s+/).filter(w => w.length > 2 || /^[A-ZÀ-Ú]/.test(w));
  return ((p[0]?.[0] || '?') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
};
const matiz = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
export const avatar = (nome, cls = '') => `<span class="avatar ${cls}" style="--h:${matiz(nome)}" aria-hidden="true">${esc(iniciais(nome))}</span>`;
export const pessoaHtml = (nome, sub = '') => `<div class="pessoa">${avatar(nome)}<div style="min-width:0"><strong>${esc(nome)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</div></div>`;

export function marcaHtml() {
  const logo = cfg.LOGO_URL ? `<img src="${esc(cfg.LOGO_URL)}" alt="">` : esc(iniciais(cfg.EMPRESA));
  return `<span class="marca-logo ${cfg.LOGO_URL ? 'com-imagem' : ''}">${logo}</span>
    <span style="min-width:0"><span class="marca-nome">${esc(cfg.EMPRESA)}</span><br><span class="marca-sub">${esc(cfg.SUBTITULO || '')}</span></span>`;
}

export function aplicarMarca() {
  if (cfg.COR_PRIMARIA) document.documentElement.style.setProperty('--primaria', cfg.COR_PRIMARIA);
  document.querySelectorAll('[data-marca]').forEach(el => { el.innerHTML = marcaHtml(); });
  document.querySelectorAll('[data-empresa]').forEach(el => { el.textContent = cfg.EMPRESA; });
  iniciarTema();
}

// ---------- tema claro/escuro ----------
const temaAtual = () => document.documentElement.dataset.theme
  || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

export function iniciarTema() {
  const desenhar = () => document.querySelectorAll('[data-tema]').forEach(b => {
    const escuro = temaAtual() === 'dark';
    b.innerHTML = icone(escuro ? 'sol' : 'lua');
    b.title = escuro ? 'Usar tema claro' : 'Usar tema escuro';
    b.setAttribute('aria-label', b.title);
  });
  document.querySelectorAll('[data-tema]').forEach(b => {
    if (b.dataset.ligado) return;
    b.dataset.ligado = '1';
    b.addEventListener('click', () => {
      const novo = temaAtual() === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = novo;
      try { localStorage.setItem('tema', novo); } catch { /* sem armazenamento */ }
      desenhar();
    });
  });
  desenhar();
}

// ---------- datas ----------
const fData = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
const fCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fSemanaCurta = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const fSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' });
const fHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fMes = new Intl.DateTimeFormat('pt-BR', { month: 'short' });
const maiuscula = s => s.replace(/^./, l => l.toUpperCase());

export const fmtData = iso => fData.format(new Date(iso));
export const fmtDataCurta = iso => fCurta.format(new Date(iso));
export const fmtSemana = iso => fSemanaCurta.format(new Date(iso)).replace('.', '');
export const fmtDiaSemana = iso => maiuscula(fSemana.format(new Date(iso)));
export const fmtHora = iso => fHora.format(new Date(iso));
export const fmtDia = iso => String(new Date(iso).getDate()).padStart(2, '0');
export const fmtMes = iso => fMes.format(new Date(iso)).replace('.', '');
export const fmtPeriodo = (inicio, fim) => fmtHora(inicio) + (fim ? ' às ' + fmtHora(fim) : '');
export const fmtTurma = t => `${fmtSemana(t.inicio)}, ${fmtDataCurta(t.inicio)} · ${fmtPeriodo(t.inicio, t.fim)} · ${t.local}`;

// "2026-11-05T11:00:00Z" -> { data: '2026-11-05', hora: '08:00' } no fuso do navegador
export function separarDataHora(iso) {
  if (!iso) return { data: '', hora: '' };
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return { data: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, hora: `${p(d.getHours())}:${p(d.getMinutes())}` };
}
export const juntarDataHora = (data, hora) => new Date(`${data}T${hora}`).toISOString();

export const linkMapa = endereco => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(endereco);

export function vagasInfo(vagas, ocupadas) {
  const livres = Math.max(vagas - ocupadas, 0);
  const pct = vagas ? Math.min(100, Math.round(ocupadas / vagas * 100)) : 100;
  const classe = livres === 0 ? 'cheia' : pct >= 80 ? 'quase' : '';
  return { livres, pct, classe };
}
export const barraHtml = (vagas, ocupadas) => {
  const { pct, classe } = vagasInfo(vagas, ocupadas);
  return `<div class="barra ${classe}"><span style="--p:${pct}%"></span></div>`;
};

// ---------- arquivos ----------
export function baixarArquivo(nome, conteudo, tipo = 'text/plain') {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export async function copiarTexto(texto, aviso = 'Copiado para a área de transferência') {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = texto;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast(aviso, 'ok');
}

// ---------- toast ----------
export function toast(msg, tipo = '') {
  let box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.setAttribute('role', 'status');
    document.body.appendChild(box);
  }
  const el = document.createElement('div');
  el.className = 'toast ' + tipo;
  el.innerHTML = icone(tipo === 'erro' ? 'alerta' : tipo === 'ok' ? 'ok' : 'info') + `<span>${esc(msg)}</span>`;
  box.appendChild(el);
  setTimeout(() => { el.classList.add('saindo'); setTimeout(() => el.remove(), 300); }, tipo === 'erro' ? 6000 : 3200);
}

// ---------- modal ----------
// botoes: [{ texto, icone, classe, acao(modal) }] — se acao retornar false o modal continua aberto
export function abrirModal({ titulo, corpo = '', botoes = [{ texto: 'Fechar' }], icone: ic, tom = '' }) {
  const dlg = document.createElement('dialog');
  dlg.className = 'modal';
  dlg.innerHTML = `
    <div class="modal-topo">
      ${ic ? `<span class="icone-bola ${tom}">${icone(ic)}</span>` : ''}
      <h2>${esc(titulo)}</h2>
      <button type="button" class="btn-icone" data-fechar aria-label="Fechar">${icone('fechar')}</button>
    </div>
    <div class="modal-corpo"></div>
    <div class="modal-rodape"></div>`;
  const elCorpo = dlg.querySelector('.modal-corpo');
  if (typeof corpo === 'string') elCorpo.innerHTML = corpo; else elCorpo.appendChild(corpo);
  const rodape = dlg.querySelector('.modal-rodape');
  if (!botoes.length) rodape.remove();

  let resolver;
  const fechado = new Promise(r => { resolver = r; });
  const modal = {
    dlg, corpo: elCorpo, fechado,
    fechar(valor) { dlg.close(); dlg.remove(); resolver(valor); },
    $: sel => elCorpo.querySelector(sel),
  };

  botoes.forEach(b => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = b.classe || '';
    btn.innerHTML = (b.icone ? icone(b.icone) : '') + esc(b.texto);
    btn.addEventListener('click', async () => {
      if (!b.acao) return modal.fechar(b.valor);
      btn.disabled = true;
      try {
        const r = await b.acao(modal);
        if (r !== false) modal.fechar(r === undefined ? b.valor ?? true : r);
      } catch (e) {
        toast(erroMsg(e), 'erro');
      } finally {
        btn.disabled = false;
      }
    });
    rodape.appendChild(btn);
  });
  dlg.querySelector('[data-fechar]').addEventListener('click', () => modal.fechar(undefined));
  dlg.addEventListener('cancel', e => { e.preventDefault(); modal.fechar(undefined); });
  dlg.addEventListener('click', e => { if (e.target === dlg) modal.fechar(undefined); }); // clique fora
  // Enter em um campo de texto aciona o botão principal
  dlg.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('input:not([type=checkbox]):not([type=radio]):not([type=file])')) {
      const principal = rodape.querySelector('.primario');
      if (principal) { e.preventDefault(); principal.click(); }
    }
  });
  document.body.appendChild(dlg);
  dlg.showModal();
  return modal;
}

export function confirmar(titulo, mensagemHtml, { textoOk = 'Confirmar', perigo = false, icone: ic } = {}) {
  return abrirModal({
    titulo,
    icone: ic || (perigo ? 'alerta' : 'info'),
    tom: perigo ? 'erro' : '',
    corpo: `<div>${mensagemHtml}</div>`,
    botoes: [
      { texto: 'Voltar', valor: false },
      { texto: textoOk, classe: perigo ? 'perigo cheio' : 'primario', valor: true },
    ],
  }).fechado.then(Boolean);
}

// ---------- seletor de pessoa com busca ----------
// pessoas: [{ id, nome, ... }]
export function seletorPessoa(container, pessoas, { placeholder = 'Digite seu nome...', detalhe, onChange } = {}) {
  const det = detalhe || (p => [p.loja, p.setor].filter(Boolean).join(' · '));
  const indice = pessoas.map(p => ({ p, chave: normalizar(p.nome + ' ' + (p.matricula || '')) }));
  let escolhido = null;
  let foco = -1;

  container.classList.add('seletor');
  const desenhar = () => {
    if (escolhido) {
      container.innerHTML = `<div class="escolhido">${pessoaHtml(escolhido.nome, det(escolhido))}
        <button type="button" class="link pequeno-btn">Trocar</button></div>`;
      container.querySelector('button').addEventListener('click', () => definir(null, true));
      return;
    }
    container.innerHTML = `<div class="com-icone">${icone('busca')}
        <input type="search" autocomplete="off" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}"></div>
      <div class="seletor-lista" hidden></div>`;
    const input = container.querySelector('input');
    const lista = container.querySelector('.seletor-lista');
    let achados = [];
    const filtrar = () => {
      const termos = normalizar(input.value).split(/\s+/).filter(Boolean);
      achados = indice.filter(x => termos.every(t => x.chave.includes(t))).slice(0, 40).map(x => x.p);
      foco = -1;
      lista.innerHTML = achados.length
        ? achados.map((p, i) => `<button type="button" data-i="${i}">${pessoaHtml(p.nome, det(p))}</button>`).join('')
        : '<div class="vazio">Nenhum nome encontrado.</div>';
      lista.hidden = false;
    };
    input.addEventListener('input', filtrar);
    input.addEventListener('focus', filtrar);
    input.addEventListener('blur', () => setTimeout(() => { lista.hidden = true; }, 200));
    input.addEventListener('keydown', e => {
      const botoes = lista.querySelectorAll('button');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        foco = Math.max(0, Math.min(botoes.length - 1, foco + (e.key === 'ArrowDown' ? 1 : -1)));
        botoes.forEach((b, i) => b.classList.toggle('foco', i === foco));
        botoes[foco]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && foco >= 0) {
        e.preventDefault();
        definir(achados[foco], true);
      }
    });
    lista.addEventListener('mousedown', e => e.preventDefault());
    lista.addEventListener('click', e => {
      const b = e.target.closest('button[data-i]');
      if (b) definir(achados[+b.dataset.i], true);
    });
  };
  const definir = (p, avisar) => {
    escolhido = p;
    desenhar();
    if (!p) container.querySelector('input')?.focus();
    if (avisar && onChange) onChange(p);
  };
  desenhar();
  return { get: () => escolhido, limpar: () => definir(null, false) };
}
