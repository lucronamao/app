/* ===== ATIVACAO DO APP PELO E-MAIL DA COMPRA (26/10/2026) =====

   Por que existe: em outubro os reembolsos subiram, quase todos "a qualidade nao
   atingiu as expectativas", 5 de 13 pedidos em 8 a 40 minutos depois de pagar. A
   leitura: a compradora abre, nao ve login nem cadastro, acha que e "so um site"
   e desiste sem usar. A tela de e-mail da a sensacao de conta e explica onde os
   dados ficam. E quem foi reembolsado deixa de usar o app.

   Como decide (o painel responde pelo e-mail, que viaja so em hash sha256):
     ok           -> libera e lembra
     reembolsado  -> tela de acesso encerrado
     nao_achei    -> tenta de novo por ate 3 min (a venda leva ate 3 min pra
                     chegar no painel) e depois pede pra conferir o e-mail
     erro/offline -> LIBERA (provisorio) e confere na proxima abertura. Quem pagou
                     nunca fica trancado porque o painel caiu ou faltou internet.

   QUEM JA USAVA NAO VE NADA. Antes desta tela, todo aparelho que abriu o app
   ganhou alguma chave com o PREFIXO no localStorage (o tema e gravado em toda
   abertura). Aparelho com chave e sem ativacao vira "legado": nunca ve a tela e
   nunca e conferido. Por isso este script roda ANTES de qualquer outro na pagina:
   a decisao tem que sair antes de o app gravar o tema.

   O iPhone separa o storage do Safari do app instalado na tela inicial. Para
   quem ja usava nao cair na tela ao instalar o icone, o estado tambem e copiado
   no Cache Storage, que e por origem e atravessa os dois (ver sw.js).

   O mesmo arquivo mora no app do Mexico (appganancia/app): so muda o bloco
   OFERTA e os textos T. Mexeu na regra aqui, leve pra la.

   REGRA: nenhuma outra pagina da mesma origem (a pagina de vendas, no Mexico,
   mora em appganancia.com como o app) pode gravar chave com o prefixo do app:
   isso viraria "legado" todo comprador novo. */
(function () {
  'use strict';

  /* ---------- o que e desta oferta ---------- */
  var OFERTA = {
    prefixo: 'lucronamao_',
    cache: 'lucronamao-ativacao',
    painel: 'o=2026-08-lucro-na-mao',
    comprar: 'https://lucronamao.online/',
    marca: 'Lucro na Mão',
    suporte: 'contato@lucronamao.online'
  };
  var T = {
    titulo: 'Ative o seu app',
    sub: 'Digite o e-mail que você usou na compra. É só uma vez neste celular.',
    info1: '<b>Suas vendas ficam guardadas só neste celular.</b> Nada vai pra nuvem e ninguém mais vê os seus números.',
    info2: 'Vai trocar de celular? Salve o backup no app (ele vai pro seu WhatsApp) e restaure no aparelho novo.',
    rotulo: 'Seu e-mail da compra',
    exemplo: 'seuemail@exemplo.com',
    botao: 'Ativar meu app',
    conferindo: 'Conferindo sua compra...',
    pronto: 'Pronto!',
    ativado: 'App ativado. Bom proveito!',
    invalido: 'Confira o e-mail: parece que falta alguma coisa.',
    esperando: 'Se você acabou de comprar, a compra leva até 3 minutos pra chegar. Já estamos conferindo de novo.',
    naoAchei: 'Não achamos uma compra com este e-mail. Confira se é o mesmo e-mail da compra, letra por letra.',
    naoAcheiDepois: 'Não achamos uma compra com este e-mail. Confira e tente de novo.',
    lembrar: 'Não lembra qual e-mail usou? É o mesmo que recebeu a mensagem com o link do app.',
    encerradoTit: 'Acesso encerrado',
    encerrado: function (email) {
      return 'A compra feita com o e-mail <b>' + email + '</b> foi reembolsada, então o acesso a este app foi encerrado.';
    },
    encerradoInfo: 'O que você anotou continua guardado neste celular. Se voltar a ter o app, está tudo lá.',
    voltar: 'Quero voltar a usar',
    semRede: 'Sem internet agora. Conecte e toque em Ativar de novo.',
    paguei: 'Já paguei e não ativa',
    pagueiCorpo: 'Oi! Paguei o app e ele não ativa com o e-mail: ',
    outro: 'Comprei com outro e-mail'
  };

  var CHAVE = OFERTA.prefixo + 'ativacao';
  var URL_CACHE = '/__ativacao__';
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var PAINEL = (LOCAL ? 'http://localhost:3100' : 'https://painel.labofertas.com') +
    '/api/app/acesso?' + OFERTA.painel + '&e=';
  var RECONFERIR_MS = 6 * 60 * 60 * 1000;
  var ESPERA_VENDA_MS = 180 * 1000;
  var BASE = (document.currentScript && document.currentScript.src || location.href).replace(/[^\/]*$/, '');

  /* ---------- estado ---------- */
  function ler() {
    try { return JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { return null; }
  }
  function gravar(novo) {
    st = novo;
    window.Ativacao = { estado: st.estado, email: st.email || null };
    try { localStorage.setItem(CHAVE, JSON.stringify(st)); } catch (e) {}
    espelhar(st);
  }
  /* atravessa pro icone o que ja foi decidido; pendente e provisorio nao */
  function espelhar(s) {
    if (!s || !/^(legado|ativo|bloqueado)$/.test(s.estado)) return;
    try {
      caches.open(OFERTA.cache).then(function (c) {
        return c.put(URL_CACHE, new Response(JSON.stringify(s), { headers: { 'content-type': 'application/json' } }));
      }).catch(function () {});
    } catch (e) {}
  }
  function lerEspelho() {
    try {
      return caches.open(OFERTA.cache).then(function (c) { return c.match(URL_CACHE); })
        .then(function (r) { return r ? r.json() : null; }).catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }
  function jaUsava() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(OFERTA.prefixo) === 0 && k !== CHAVE) return true;
      }
    } catch (e) {}
    return false;
  }

  try { localStorage.setItem(CHAVE + '_teste', '1'); localStorage.removeItem(CHAVE + '_teste'); }
  catch (e) { return; } /* sem storage (aba privada antiga): nada a lembrar, segue liberado */

  var st = ler();
  if (!st) gravar(jaUsava() ? { estado: 'legado', desde: Date.now() } : { estado: 'pendente' });
  else window.Ativacao = { estado: st.estado, email: st.email || null };

  /* ---------- conferir no painel ---------- */
  function hash(email) {
    var e = String(email || '').trim().toLowerCase();
    if (!window.crypto || !crypto.subtle || !window.TextEncoder) return Promise.reject(new Error('sem crypto'));
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(e)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    });
  }
  /* devolve 'ok' | 'reembolsado' | 'nao_achei' | 'erro' (rede, painel fora, timeout) */
  function conferir(h) {
    if (navigator.onLine === false) return Promise.resolve('erro');
    var ctl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);
    return fetch(PAINEL + h, { cache: 'no-store', credentials: 'omit', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (j) { return (j && /^(ok|reembolsado|nao_achei)$/.test(j.s)) ? j.s : 'erro'; })
      .catch(function () { return 'erro'; })
      .then(function (s) { clearTimeout(t); return s; });
  }

  /* ---------- a tela ---------- */
  var CSS = '' +
    'html.ativ-trava,html.ativ-trava body{overflow:hidden!important}' +
    'html.ativ-trava body>*:not(#ativ){visibility:hidden!important}' +
    '#ativ{position:fixed;inset:0;z-index:2147483000;background:#fdf4f8;overflow-y:auto;-webkit-overflow-scrolling:touch;' +
    'font-family:-apple-system,"Segoe UI",Roboto,sans-serif;color:#2b2230;visibility:visible!important}' +
    '#ativ *{box-sizing:border-box}' +
    '#ativ .av-topo{background:#8e2757;color:#fff;text-align:center;padding:28px 16px 22px}' +
    '#ativ .av-topo img{height:58px;width:auto;max-width:72%;display:block;margin:0 auto}' +
    '#ativ .av-corpo{max-width:460px;margin:0 auto;padding:22px 18px 34px}' +
    '#ativ h1{font-size:23px;font-weight:800;line-height:1.2;margin:0 0 6px;letter-spacing:-.3px}' +
    '#ativ .av-sub{font-size:15.5px;line-height:1.5;color:#5d5263;margin:0 0 18px}' +
    '#ativ .av-info{display:flex;gap:11px;background:#fff;border:1px solid #eadfe6;border-radius:14px;padding:14px;margin:0 0 20px;font-size:14.5px;line-height:1.5}' +
    '#ativ .av-info svg{width:22px;height:22px;flex-shrink:0;margin-top:1px;fill:none;stroke:#8e2757;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    '#ativ .av-info p{margin:0}#ativ .av-info p+p{margin-top:7px}' +
    '#ativ label{display:block;font-size:14.5px;font-weight:700;margin:0 0 7px}' +
    '#ativ input{width:100%;font-size:17px;padding:15px 14px;border:2px solid #8f8496;border-radius:12px;background:#fff;color:#2b2230;font-family:inherit;outline:none}' +
    '#ativ input:focus{border-color:#8e2757;box-shadow:0 0 0 3px rgba(142,39,87,.18)}' +
    '#ativ input[aria-invalid=true]{border-color:#b3261e}' +
    '#ativ .av-btn{display:block;width:100%;margin-top:14px;background:#8e2757;color:#fff;border:0;border-radius:12px;padding:16px;font-size:17px;font-weight:800;font-family:inherit;cursor:pointer;text-align:center;text-decoration:none}' +
    '#ativ .av-btn:focus-visible,#ativ .av-link:focus-visible{outline:3px solid #2b2230;outline-offset:2px}' +
    '#ativ .av-btn[disabled]{opacity:.75;cursor:default}' +
    '#ativ .av-btn.sec{background:#f6e7ee;color:#6d1d43}' +
    '#ativ .av-msg{min-height:1px;font-size:14.5px;line-height:1.45;margin-top:12px}' +
    '#ativ .av-msg.erro{color:#b3261e;font-weight:600}' +
    '#ativ .av-msg.ok{color:#1e7d4f;font-weight:700}' +
    '#ativ .av-nota{font-size:13.5px;line-height:1.5;color:#5d5263;margin-top:18px;text-align:center}' +
    '#ativ .av-link{color:#6d1d43;font-weight:700;word-break:break-all}' +
    '#ativ .av-spin{display:inline-block;width:16px;height:16px;border:2.5px solid rgba(255,255,255,.45);border-top-color:#fff;border-radius:50%;vertical-align:-3px;margin-right:8px;animation:avGira .8s linear infinite}' +
    '@keyframes avGira{to{transform:rotate(360deg)}}' +
    '@media (prefers-reduced-motion:reduce){#ativ .av-spin{animation:none}}';

  var ICO_CEL = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18.5h2"/><path d="M9.5 9.5l2 2 3.5-3.5"/></svg>';
  var ICO_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  /* msg: um aviso de erro ja na abertura (texto puro) */
  function telaEmail(msg) {
    return '<div class="av-corpo">' +
      '<h1 id="avTit">' + T.titulo + '</h1>' +
      '<p class="av-sub">' + T.sub + '</p>' +
      '<div class="av-info">' + ICO_CEL + '<div><p>' + T.info1 + '</p><p>' + T.info2 + '</p></div></div>' +
      '<form id="avForm" novalidate>' +
        '<label for="avEmail">' + T.rotulo + '</label>' +
        '<input id="avEmail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false"' +
        ' placeholder="' + T.exemplo + '" aria-describedby="avMsg" required>' +
        '<button class="av-btn" id="avBtn" type="submit">' + T.botao + '</button>' +
        '<div class="av-msg' + (msg ? ' erro' : '') + '" id="avMsg" role="status" aria-live="polite">' + esc(msg || '') + '</div>' +
      '</form>' +
      '<p class="av-nota">' + T.lembrar + '</p>' +
    '</div>';
  }

  function telaEncerrada(email) {
    return '<div class="av-corpo">' +
      '<h1 id="avTit">' + T.encerradoTit + '</h1>' +
      '<p class="av-sub">' + T.encerrado(esc(email || '')) + '</p>' +
      '<div class="av-info">' + ICO_X + '<div><p>' + T.encerradoInfo + '</p></div></div>' +
      '<a class="av-btn" href="' + OFERTA.comprar + '?utm_source=app&utm_medium=reembolsado">' + T.voltar + '</a>' +
      '<button class="av-btn sec" id="avOutro" type="button">' + T.outro + '</button>' +
    '</div>';
  }

  var raiz = null;
  function estilo() {
    if (document.getElementById('ativCss')) return;
    var css = document.createElement('style');
    css.id = 'ativCss';
    css.textContent = CSS;
    (document.head || document.documentElement).appendChild(css);
  }
  function montar(html) {
    estilo();
    document.documentElement.classList.add('ativ-trava');
    var pintar = function () {
      if (!raiz) {
        raiz = document.createElement('div');
        raiz.id = 'ativ';
        raiz.setAttribute('role', 'dialog');
        raiz.setAttribute('aria-modal', 'true');
        raiz.setAttribute('aria-labelledby', 'avTit');
        document.body.appendChild(raiz);
      }
      /* so trava o que estava livre, e marca: ao sair, solta so o que ela travou
         (o modal do app pode estar aberto atras, com o inert dele) */
      Array.prototype.forEach.call(document.body.children, function (el) {
        if (el === raiz || el.hasAttribute('inert')) return;
        el.setAttribute('inert', ''); el.setAttribute('data-ativ-inert', '');
      });
      raiz.innerHTML = '<div class="av-topo"><img src="' + BASE + 'logo-branca.png" alt="' + OFERTA.marca + '"></div>' + html;
      raiz.scrollTop = 0;
      ligar();
    };
    if (document.body) pintar(); else document.addEventListener('DOMContentLoaded', pintar);
  }
  function desmontar() {
    document.documentElement.classList.remove('ativ-trava');
    if (raiz) { raiz.remove(); raiz = null; }
    Array.prototype.forEach.call(document.querySelectorAll('[data-ativ-inert]'), function (el) {
      el.removeAttribute('inert'); el.removeAttribute('data-ativ-inert');
    });
    var h = document.querySelector('h1, header');
    if (h) { if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) {} }
  }

  function ligar() {
    var form = document.getElementById('avForm');
    if (form) {
      var inp = document.getElementById('avEmail');
      /* volta com o e-mail que nao foi achado; quem veio do "comprei com outro" comeca vazio */
      if (st.email && st.estado === 'pendente') inp.value = st.email;
      setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) {} }, 60);
      inp.addEventListener('input', function () {
        inp.removeAttribute('aria-invalid');
        /* corrigiu o e-mail no meio da espera: solta o botao na hora */
        if (enviando) { tentativa++; enviando = false; botao('livre'); aviso(''); }
      });
      form.addEventListener('submit', function (ev) { ev.preventDefault(); ativar(inp.value); });
    }
    else {
      var tit = document.getElementById('avTit');
      if (tit) { tit.tabIndex = -1; setTimeout(function () { try { tit.focus({ preventScroll: true }); } catch (e) {} }, 60); }
    }
    var outro = document.getElementById('avOutro');
    if (outro) outro.addEventListener('click', function () { montar(telaEmail()); });
  }

  function aviso(txt, tipo) {
    var m = document.getElementById('avMsg');
    if (m) { m.className = 'av-msg' + (tipo ? ' ' + tipo : ''); m.textContent = txt; }
  }
  function botao(estado) {
    var b = document.getElementById('avBtn');
    if (!b) return;
    b.disabled = estado !== 'livre';
    if (estado === 'livre') b.textContent = T.botao;
    else if (estado === 'pronto') b.textContent = T.pronto;
    else b.innerHTML = '<span class="av-spin" aria-hidden="true"></span>' + T.conferindo;
  }

  var enviando = false, tentativa = 0;
  function ativar(valor) {
    if (enviando) return;
    var email = String(valor || '').trim();
    var inp = document.getElementById('avEmail');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      if (inp) { inp.setAttribute('aria-invalid', 'true'); inp.focus(); }
      aviso(T.invalido, 'erro');
      return;
    }
    enviando = true;
    var minha = ++tentativa;
    var antes = st.estado;
    botao('ocupado');
    aviso('');
    var inicio = Date.now();
    hash(email).then(function (h) {
      var tentar = function () {
        if (minha !== tentativa) return Promise.resolve(null);
        return conferir(h).then(function (s) {
          if (minha !== tentativa) return null;
          if (s === 'nao_achei' && Date.now() - inicio < ESPERA_VENDA_MS) {
            aviso(T.esperando);
            return new Promise(function (ok) { setTimeout(ok, 10000); }).then(tentar);
          }
          return s;
        });
      };
      return tentar().then(function (s) { if (s) concluir(s, email, h, antes); });
    }).catch(function () { if (minha === tentativa) concluir('erro', email, null, antes); });
  }

  function concluir(s, email, h, antes) {
    enviando = false;
    /* quem ja foi barrado nao entra pelo "sem internet": sem resposta, sem acesso */
    if (s === 'erro' && antes === 'bloqueado') {
      botao('livre');
      aviso(T.semRede, 'erro');
      return;
    }
    if (s === 'reembolsado') {
      gravar({ estado: 'bloqueado', email: email, h: h, em: Date.now() });
      montar(telaEncerrada(email));
      return;
    }
    if (s === 'nao_achei') {
      botao('livre');
      var inp = document.getElementById('avEmail');
      if (inp) inp.setAttribute('aria-invalid', 'true');
      aviso(T.naoAchei, 'erro');
      var m = document.getElementById('avMsg');
      if (m && OFERTA.suporte) {
        var a = document.createElement('a');
        a.className = 'av-btn sec';
        a.href = 'mailto:' + OFERTA.suporte + '?subject=' + encodeURIComponent('Meu app não ativa') +
          '&body=' + encodeURIComponent(T.pagueiCorpo + email);
        a.textContent = T.paguei;
        m.appendChild(a);
      }
      return;
    }
    /* ok, ou erro nosso / sem internet: libera. No erro fica provisorio e confere depois. */
    gravar({ estado: s === 'ok' ? 'ativo' : 'provisorio', email: email, h: h, em: Date.now() });
    botao('pronto');
    aviso(T.ativado, 'ok');
    setTimeout(desmontar, 900);
  }

  /* confere em silencio quem ja ativou; so muda algo se a compra foi reembolsada */
  function reconferir() {
    if (!st.h) {
      if (st.email) hash(st.email).then(function (h) { st.h = h; reconferir(); }).catch(function () {});
      return;
    }
    conferir(st.h).then(function (s) {
      if (s === 'reembolsado') {
        if (st.estado !== 'bloqueado') montar(telaEncerrada(st.email));
        gravar({ estado: 'bloqueado', email: st.email, h: st.h, em: Date.now() });
      } else if (s === 'ok') {
        var eraTrava = st.estado === 'bloqueado';
        gravar({ estado: 'ativo', email: st.email, h: st.h, em: Date.now() });
        if (eraTrava) desmontar();
      } else if (s === 'nao_achei' && st.estado === 'provisorio') {
        gravar({ estado: 'pendente', email: st.email });
        montar(telaEmail(T.naoAcheiDepois));
      }
    });
  }

  /* ---------- ao abrir ---------- */
  function abrir() {
    if (st.estado === 'bloqueado') {
      montar(telaEncerrada(st.email));
      reconferir();
    } else if (st.estado === 'pendente') {
      montar(telaEmail());
    } else if (st.estado === 'provisorio' || (st.estado === 'ativo' && Date.now() - (st.em || 0) > RECONFERIR_MS)) {
      reconferir();
    }
  }

  if (st.estado === 'pendente') {
    /* Icone novo no iPhone: o Safari pode ja ter decidido (legado, ativo ou
       bloqueado). A pagina fica escondida ate o espelho responder (milissegundos),
       para quem ja usava nao ver a tela piscar. Sem resposta em 1,5 s, segue. */
    estilo();
    document.documentElement.classList.add('ativ-trava');
    var decidido = false;
    var decidir = function (esp) {
      if (decidido) return;
      decidido = true;
      if (esp && /^(legado|ativo|bloqueado)$/.test(esp.estado) && !st.email) {
        st = esp;
        window.Ativacao = { estado: st.estado, email: st.email || null };
        try { localStorage.setItem(CHAVE, JSON.stringify(st)); } catch (e) {}
      }
      document.documentElement.classList.remove('ativ-trava');
      abrir();
    };
    lerEspelho().then(decidir);
    setTimeout(function () { decidir(null); }, 1500);
  } else {
    if (st.estado === 'legado') espelhar(st);
    abrir();
  }
})();
