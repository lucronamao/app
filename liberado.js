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
     Fora do hub, o `#de=` que o menu manda tambem vale (o Controle e o Cobrar ja
     gravam ele na memoria; aqui so evita depender da ordem dos scripts). */
  function chaveDoLink(comHash) {
    var m = location.pathname.match(/\/(c|d|p|cd|cp|u|tudo)(?:\/|$)/);
    if (m) return m[1];
    var q = '';
    try { q = (new URLSearchParams(location.search).get('libera') || '').replace(/^so-/, ''); } catch (e) {}
    if (MAPA[q]) return q;
    if (comHash) {
      var h = (location.hash || '').match(/de=(tudo|cd|cp|c|d|p|u)(?:&|$)/);
      if (h) return h[1];
    }
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
    var k = chaveDoLink(true);
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
    }
  };

  /* a compra feita aqui dentro libera na volta: o hub le esta marca (ver hub.html) */
  var COMPRA = 'lucronamao_compra_app';
  function marcarCompra(id) {
    try { localStorage.setItem(COMPRA, JSON.stringify({ em: Date.now(), id: id })); } catch (e) {}
  }

  window.Liberado = {
    MAPA: MAPA, CHAVE_MEM: CHAVE_MEM, VALIDOS: VALIDOS, PRODUTO_DE: PRODUTO_DE,
    chaveDoLink: chaveDoLink, lembrar: lembrar, lembrado: lembrado, doEmail: doEmail,
    itens: itens, tem: tem,
    CHECKOUT: CHECKOUT, checkoutPronto: checkoutPronto, comOrigem: comOrigem,
    VITRINE: VITRINE, COMPRA: COMPRA, marcarCompra: marcarCompra
  };
})();
