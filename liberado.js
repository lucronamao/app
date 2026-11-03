/* ===== O QUE ESTA LIBERADO, NUM LUGAR SO (03/11/2026) =====

   Antes esta regra morava inteira no hub.html. Com o botao "cobrar" no Controle e
   o Clientes na Mao, outras paginas precisam da MESMA resposta que o menu da, e
   uma copia em cada pagina ia divergir na primeira mudanca.

   A regra (a mesma do hub desde 31/08 e 03/11/2026):
     1. a PASTA do link (/app/<chave>/) libera o que a chave libera;
     2. o aparelho lembra o que um link ja liberou (`lucronamao_liberado`), e so SOMA;
     3. a ativacao pelo e-mail (ativacao.js) traz os produtos que o e-mail comprou,
        e cada um libera a sua parte. Tambem so soma, e nao e gravado na memoria.
   Nada aqui tira acesso: o pior caso e liberar o que ela ja comprou.

   Este arquivo so LE e oferece as pecas. O que tem efeito colateral (gravar a
   memoria ao abrir pela pasta, mandar o hub pelado pra pasta certa) continua no
   hub, que e o unico lugar onde isso deve acontecer.

   Carregar DEPOIS do ativacao.js (o e-mail e lido na hora da pergunta, entao a
   ordem so importa pra quem chama na carga da pagina).
   A tabela de chaves e a mesma do montar-pastas.py (NIVEIS): mudou la, muda aqui. */
(function () {
  'use strict';

  var MAPA = {
    c:    ['controle'],
    d:    ['divulga'],
    p:    ['preco'],
    cd:   ['controle', 'divulga'],
    cp:   ['controle', 'preco'],          // compatibilidade
    u:    ['preco'],                      // compatibilidade
    tudo: ['controle', 'divulga', 'preco']
  };
  var CHAVE_MEM = 'lucronamao_liberado';
  var VALIDOS = ['controle', 'divulga', 'preco'];

  /* produto do e-mail -> parte do app. Nomes na Cakto: "Controle da Lojinha",
     "Cobrar na Mao" (era Divulga), "Catalogo na Mao" (era Precificacao) e, quando
     existir, "Clientes na Mao". /cliente/ nao casa com nenhum dos outros tres. */
  var PRODUTO_DE = {
    controle: /controle/i,
    divulga:  /cobrar|divulga/i,
    preco:    /cat[aá]logo|precifica/i,
    clientes: /cliente/i
  };

  /* A chave do link: caminho da pasta, ou o ?libera= dos links antigos.
     O `#de=` que o menu manda NAO libera nada (03/11/2026, achado de seguranca):
     `clientes.html#de=tudo` liberava e gravava tudo pra sempre. O hash so serve pro
     botao de voltar achar o menu certo. O parametro `comHash` ficou so pra nao
     quebrar quem chama com ele; e ignorado. */
  function chaveDoLink(comHash) {
    var m = location.pathname.match(/\/(c|d|p|cd|cp|u|tudo)(?:\/|$)/);
    if (m) return m[1];
    var q = '';
    try { q = (new URLSearchParams(location.search).get('libera') || '').replace(/^so-/, ''); } catch (e) {}
    if (MAPA[q]) return q;
    return null;
  }

  function lembrar(itens) {
    try {
      var antes = JSON.parse(localStorage.getItem(CHAVE_MEM) || '[]');
      if (!Array.isArray(antes)) antes = [];
      var uniao = antes.slice();
      itens.forEach(function (i) { if (uniao.indexOf(i) < 0) uniao.push(i); });
      if (uniao.length !== antes.length) localStorage.setItem(CHAVE_MEM, JSON.stringify(uniao));
      return uniao;
    } catch (e) { return itens; }   /* Safari privado nega storage: segue pelo link */
  }

  function lembrado() {
    try {
      var v = JSON.parse(localStorage.getItem(CHAVE_MEM) || '[]');
      if (!Array.isArray(v)) return [];
      return v.filter(function (x) { return VALIDOS.indexOf(x) >= 0; });
    } catch (e) { return []; }
  }

  function doEmail() {
    var a = window.Ativacao;
    if (!a || a.estado !== 'ativo' || !Array.isArray(a.produtos)) return [];
    return Object.keys(PRODUTO_DE).filter(function (k) {
      return a.produtos.some(function (n) { return PRODUTO_DE[k].test(n); });
    });
  }

  /* leitura sem efeito colateral: link + memoria + e-mail */
  function itens() {
    var k = chaveDoLink();
    var out = (MAPA[k] || []).slice();
    lembrado().concat(doEmail()).forEach(function (i) { if (out.indexOf(i) < 0) out.push(i); });
    return out;
  }
  function tem(x) { return itens().indexOf(x) >= 0; }

  /* ===== CHECKOUT E A VITRINE DE CADA PARTE =====
     Os links sao da Cakto (a fonte da verdade e a Cakto, conferir com
     GET /public_api/offers/). O texto do card e o mesmo no menu e no convite que
     o Controle mostra a quem toca "cobrar" sem ter o Cobrar.
     `checkout` comecando com '#' e PROVISORIO: o produto ainda nao existe na Cakto,
     e o card esconde o botao de compra (fica so o "Ja comprei"). */
  var CHECKOUT = {
    controle: 'https://pay.cakto.com.br/3ko7pit',   /* Controle da Lojinha, R$ 47 */
    divulga:  'https://pay.cakto.com.br/47dvagf',   /* Cobrar na Mao (era Divulga), R$ 27 */
    preco:    'https://pay.cakto.com.br/qd7cbqf',   /* Catalogo na Mao (era Precificacao), R$ 67 */
    clientes: 'https://pay.cakto.com.br/4bn3e2e'    /* Clientes na Mao, R$ 27 (criado em 03/11/2026) */
  };
  function checkoutPronto(id) { return !!CHECKOUT[id] && CHECKOUT[id].charAt(0) !== '#'; }

  /* Toda compra que sai do app leva utm_source=app e a parte em utm_medium (06/10/2026).
     NAO usar utm_content nem utm_campaign: o coletor do painel le os dois como
     anuncio e campanha. */
  function comOrigem(url, degrau) {
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'utm_source=app&utm_medium=' + degrau;
  }

  /* TEXTO: card do menu (copy de 03/11/2026) */
  var VITRINE = {
    divulga: {
      nome: 'Cobrar na Mão',
      desc: 'veja quem te deve e mande a cobrança pronta',
      tags: ['quem te deve num lugar só', 'a mensagem já vem escrita', 'um toque e vai no WhatsApp'],
      preco: 'R$ 27',
      pitch: 'O difícil do fiado é cobrar sem parecer chata. O Cobrar mostra quem te deve, há quantos dias e quanto falta, e a mensagem já vem escrita, educada, com o nome dela e o valor.',
      beneficios: ['lê o fiado que você anotou no Controle: quem levou, o quê, há quantos dias, quanto já pagou e quanto falta',
        'avisa quem vale lembrar hoje e guarda quando você cobrou e em que tom, pra não repetir a mesma mensagem',
        '7 tipos de mensagem, do lembrete leve até dividir o que falta, e ainda as mensagens e a arte pra vender']
    },
    clientes: {
      nome: 'Clientes na Mão',
      desc: 'suas clientes, o que cada uma compra e quem sumiu',
      tags: ['ficha de cada cliente', 'quem sumiu', 'aniversariantes do mês'],
      preco: 'R$ 27',
      pitch: 'Com muita cliente, fica difícil lembrar o que cada uma levou. O Clientes guarda a ficha de cada uma, com tudo o que ela já comprou, e mostra quem sumiu e quem faz aniversário no mês.',
      beneficios: ['a ficha de cada cliente: o que ela já comprou, quanto gastou, o que mais leva e se tem fiado em aberto',
        'a lista de quem mais compra com você e a de quem não compra há tempo, pra chamar de volta',
        'as aniversariantes do mês, pra você lembrar e mandar um parabéns',
        'puxa os nomes que você já anotou nas vendas, sem cadastrar tudo de novo']
    },
    /* o card do Catalogo morava inteiro no hub.html; veio pra ca (03/11/2026) pra a
       tela travada do proprio Catalogo dizer o mesmo. `oferta`: o botao vai pra
       pagina de oferta com a VSL, nao direto pro checkout (Vini, 21/09/2026) */
    preco: {
      nome: 'Catálogo na Mão',
      desc: 'aumente as vendas mandando o catálogo da lojinha no WhatsApp',
      tags: ['pronto em 1 toque', 'com a sua logo', 'direto do seu estoque'],
      preco: 'R$ 67',
      oferta: 'https://lucronamao.online/oferta-catalogo.html',
      pitch: 'Mandar foto solta e responder "quanto é?" o dia todo cansa, e faz a freguesa desistir no meio.',
      beneficios: ['seu catálogo sai pronto com os produtos que JÁ estão no seu estoque: você não cadastra nada duas vezes',
        'com a sua logo, o nome da sua lojinha e o preço de cada peça, do jeito que loja grande manda',
        'um toque e ele vai no WhatsApp: pro grupo, pro status ou pra freguesa que perguntou',
        'e a calculadora de preço continua aqui dentro, pra quando você quiser conferir quanto sobra']
    }
  };

  /* a compra feita aqui dentro libera na volta: o hub le esta marca (ver hub.html) */
  var COMPRA = 'lucronamao_compra_app';
  function marcarCompra(id) {
    try { localStorage.setItem(COMPRA, JSON.stringify({ em: Date.now(), id: id })); } catch (e) {}
  }

  /* ===== A PARTE PAGA CONFERE O DIREITO AO ABRIR (03/11/2026) =====
     Achado de seguranca: o Cobrar, o Clientes e o Catalogo abriam direto pela URL
     (/app/c/divulga.html) sem conferir nada. Agora cada um chama `travar(id)` na
     carga, com a MESMA regra do menu (`tem`). Sem direito, a pagina fica escondida
     e aparece a vitrine do card travado do menu: nome, pitch, beneficios, preco,
     comprar e "Ja comprei". Com direito, nada muda.
     Quem compra ou libera aqui e volta: o e-mail traz o produto
     (evento `ativacao-produtos`) e a pagina recarrega ja liberada. */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* o menu da compradora: a propria pasta, ou a pasta do #de= (so pra voltar), ou o hub */
  function urlMenu() {
    if (/\/(c|d|p|cd|cp|u|tudo)\/[^\/]*$/.test(location.pathname)) return './';
    var h = (location.hash || '').match(/de=(tudo|cd|cp|c|d|p|u)(?:&|$)/);
    return h ? h[1] + '/' : 'hub.html';
  }
  var CSS_TRAVA = '' +
    'html.lib-trava body>*:not(#libTrava):not(#ativ){display:none!important}' +
    /* as paginas tem main{padding;max-width}: aqui a tela e inteira */
    '#libTrava{min-height:100vh;background:var(--rose-2,#fdf4f8);color:var(--tinta,#2b2230);font-family:-apple-system,"Segoe UI",Roboto,sans-serif;padding:0!important;margin:0!important;max-width:none!important}' +
    '#libTrava h1:focus{outline:none}' +
    '#libTrava *{box-sizing:border-box}' +
    '#libTrava .lt-topo{background:var(--vinho,#8e2757);color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}' +
    '#libTrava .lt-topo a{color:#fff;display:flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;margin:-10px 0 -10px -10px}' +
    '#libTrava .lt-topo svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    '#libTrava .lt-topo b{font-size:17px;font-weight:700}' +
    '#libTrava .lt-corpo{max-width:560px;margin:0 auto;padding:16px}' +
    '#libTrava .lt-card{background:#fff;border:1px dashed var(--linha,#eadfe6);border-radius:16px;padding:16px}' +
    '#libTrava .lt-cab{display:flex;align-items:center;gap:12px}' +
    '#libTrava .lt-ico{width:46px;height:46px;border-radius:13px;background:var(--ambar-bg,#fdf2df);display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
    '#libTrava .lt-ico svg{width:24px;height:24px;fill:none;stroke:var(--ambar,#a05e03);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    '#libTrava h1{font-size:19px;font-weight:800;line-height:1.25;margin:0}' +
    '#libTrava .lt-desc{font-size:13.5px;color:var(--cinza,#675c6d);margin-top:2px;line-height:1.4}' +
    '#libTrava .lt-pitch{background:var(--rose-2,#fdf4f8);border-radius:12px;padding:11px 12px;font-size:14.5px;margin-top:12px;line-height:1.5}' +
    '#libTrava .lt-ben{margin-top:10px}' +
    '#libTrava .lt-ben div{display:flex;gap:8px;align-items:flex-start;font-size:14px;line-height:1.45;padding:5px 0}' +
    '#libTrava .lt-ben svg{width:16px;height:16px;flex-shrink:0;margin-top:2px;fill:none;stroke:var(--verde,#1e7d4f);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}' +
    '#libTrava .lt-preco{font-size:22px;font-weight:800;color:var(--vinho,#8e2757);text-align:center;margin-top:12px}' +
    '#libTrava .lt-preco small{display:block;font-size:12px;color:var(--cinza,#675c6d);font-weight:600}' +
    '#libTrava .lt-btn{display:block;width:100%;margin-top:12px;background:var(--vinho,#8e2757);color:#fff;border:0;border-radius:12px;padding:15px;font:inherit;font-size:16.5px;font-weight:800;text-align:center;text-decoration:none;cursor:pointer;min-height:48px}' +
    '#libTrava .lt-ja{display:block;width:100%;margin-top:8px;padding:12px 8px;min-height:44px;background:none;border:0;color:var(--vinho,#8e2757);font:inherit;font-size:14.5px;font-weight:700;text-decoration:underline;text-underline-offset:3px;cursor:pointer}' +
    '#libTrava .lt-voltar{display:flex;align-items:center;justify-content:center;min-height:44px;margin-top:6px;color:var(--cinza,#675c6d);font-size:14.5px;font-weight:600}' +
    '#libTrava .lt-btn:focus-visible,#libTrava .lt-ja:focus-visible,#libTrava a:focus-visible{outline:3px solid var(--tinta,#2b2230);outline-offset:2px}';
  var ICO_CADEADO = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>';
  var ICO_OK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';
  var ICO_VOLTA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';

  function htmlTrava(id) {
    var V = VITRINE[id] || {};
    var compra = V.oferta || (checkoutPronto(id) ? CHECKOUT[id] : '');
    var podeLiberar = !!(window.Ativacao && window.Ativacao.liberar && window.Ativacao.estado !== 'bloqueado');
    /* TEXTO: o mesmo do card travado do menu */
    return '<div class="lt-topo"><a href="' + esc(urlMenu()) + '" aria-label="voltar ao menu">' + ICO_VOLTA + '</a><b>Lucro na Mão</b></div>' +
      '<div class="lt-corpo"><div class="lt-card">' +
        '<div class="lt-cab"><div class="lt-ico">' + ICO_CADEADO + '</div>' +
          '<div><h1 id="libTravaTit" tabindex="-1">' + esc(V.nome || '') + '</h1><div class="lt-desc">' + esc(V.desc || '') + '</div></div></div>' +
        (V.pitch ? '<div class="lt-pitch">' + esc(V.pitch) + '</div>' : '') +
        (V.beneficios ? '<div class="lt-ben">' + V.beneficios.map(function (b) {
          return '<div>' + ICO_OK + '<span>' + esc(b) + '</span></div>'; }).join('') + '</div>' : '') +
        (compra ? '<div class="lt-preco">' + esc(V.preco || '') + '<small>pagamento único</small></div>' +
          '<a class="lt-btn" id="libTravaComprar" href="' + esc(comOrigem(compra, id)) + '" target="_blank" rel="noopener">' +
          (V.oferta ? 'Ver como funciona' : 'Liberar agora') + '</a>' : '') +
        (podeLiberar ? '<button class="lt-ja" id="libTravaJa" type="button">Já comprei: liberar com meu e-mail</button>' : '') +
        '<a class="lt-voltar" href="' + esc(urlMenu()) + '">Voltar ao menu</a>' +
      '</div></div>';
  }

  var travada = null;
  function montarTrava(id) {
    if (!document.getElementById('libTravaCss')) {
      var css = document.createElement('style');
      css.id = 'libTravaCss';
      css.textContent = CSS_TRAVA;
      (document.head || document.documentElement).appendChild(css);
    }
    document.documentElement.classList.add('lib-trava');
    var pintar = function () {
      var el = document.getElementById('libTrava');
      if (!el) {
        el = document.createElement('main');
        el.id = 'libTrava';
        el.setAttribute('aria-labelledby', 'libTravaTit');
        document.body.insertBefore(el, document.body.firstChild);
      }
      el.innerHTML = htmlTrava(id);
      /* o resto da pagina fica fora do leitor de tela e do Tab */
      Array.prototype.forEach.call(document.body.children, function (c) {
        if (c === el || c.id === 'ativ' || c.tagName === 'SCRIPT') return;
        if (!c.hasAttribute('inert')) { c.setAttribute('inert', ''); c.setAttribute('data-lib-inert', ''); }
      });
      var comprar = document.getElementById('libTravaComprar');
      if (comprar) comprar.addEventListener('click', function () { marcarCompra(id); });
      var ja = document.getElementById('libTravaJa');
      if (ja) ja.addEventListener('click', function () { window.Ativacao.liberar({ procura: PRODUTO_DE[id] || null }); });
      if (!document.getElementById('ativ')) {
        var t = document.getElementById('libTravaTit');
        if (t) try { t.focus({ preventScroll: true }); } catch (e) {}
      }
    };
    if (document.body) pintar(); else document.addEventListener('DOMContentLoaded', pintar);
  }

  /* chegou o direito depois da carga: recarrega pra pagina abrir inteira */
  function conferirDeNovo() {
    if (travada && tem(travada)) { try { location.reload(); } catch (e) {} }
  }

  /* true = travou (a pagina nao deve iniciar o que tem efeito na tela) */
  function travar(id) {
    if (tem(id)) return false;
    travada = id;
    montarTrava(id);
    document.addEventListener('ativacao-produtos', conferirDeNovo);
    /* voltou da compra (outra aba): o mesmo que o menu faz (hub.html, "A COMPRA
       FEITA AQUI DENTRO LIBERA NA VOLTA"): quem ja ativou confere sozinho, quem
       nunca ativou ve a tela de liberar pelo e-mail */
    var voltou = function () {
      if (document.visibilityState === 'hidden' || !travada) return;
      var c = null;
      try { c = JSON.parse(localStorage.getItem(COMPRA) || 'null'); } catch (e) {}
      if (!c || c.id !== travada) return;
      var esquecer = function () { try { localStorage.removeItem(COMPRA); } catch (e) {} };
      var A = window.Ativacao;
      if (Date.now() - (c.em || 0) > 30 * 60 * 1000 || !A || !A.liberar) { esquecer(); return; }
      if (tem(travada)) { esquecer(); conferirDeNovo(); return; }
      if (A.estado === 'ativo') { if (A.conferirCompra) A.conferirCompra(); return; }
      esquecer();
      if (A.estado !== 'bloqueado') A.liberar({ procura: PRODUTO_DE[travada] || null });
    };
    document.addEventListener('visibilitychange', voltou);
    /* icone novo no iPhone: a ativacao pode chegar do espelho do Cache Storage
       ate 1,5 s depois da carga (ver ativacao.js) */
    setTimeout(conferirDeNovo, 1700);
    return true;
  }

  window.Liberado = {
    MAPA: MAPA, CHAVE_MEM: CHAVE_MEM, VALIDOS: VALIDOS, PRODUTO_DE: PRODUTO_DE,
    chaveDoLink: chaveDoLink, lembrar: lembrar, lembrado: lembrado, doEmail: doEmail,
    itens: itens, tem: tem,
    CHECKOUT: CHECKOUT, checkoutPronto: checkoutPronto, comOrigem: comOrigem,
    VITRINE: VITRINE, COMPRA: COMPRA, marcarCompra: marcarCompra,
    travar: travar, urlMenu: urlMenu
  };
})();
