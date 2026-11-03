/* ===== DADOS DA LOJINHA PARA O COBRAR, O CLIENTES E O MENU (03/11/2026) =====

   Le o que o Controle grava (`lucronamao_v1`) e cuida de duas chaves novas:
     lucronamao_clientes  = {v:1, seq, lista:[{id, nome, whats, niver:{d,m}|null, obs,
                             nomesAntigos:[...], criadoEm}], perguntado}
     lucronamao_cobrancas = {chaveCliente: [{em, tom, valor}]}

   REGRA DE OURO: este arquivo NUNCA escreve em `lucronamao_v1`. So o Controle
   mexe nas vendas (e e ele quem grava `clienteId` numa venda nova).

   A CONTA DO SALDO e espelho de Venda.jaPago / Venda.saldo / Venda.parcelasPagas
   do index.html. O Controle nao depende deste arquivo de proposito (se ele nao
   carregar, o Controle continua inteiro). Mudou a conta la, mude aqui.

   A cliente de uma venda: pelo `clienteId` quando a venda foi feita escolhendo a
   cliente cadastrada; senao pelo NOME normalizado (sem acento, minusculo, espacos
   colapsados), que e como as vendas antigas ligam. */
(function () {
  'use strict';

  /* ---------- regras (Vini, 03/11/2026): mudar aqui ---------- */
  var REGRAS = {
    PRAZO_DIAS: 7,        /* fiado aberto ha 7 dias ou mais ja vale lembrar */
    INTERVALO_DIAS: 5,    /* ... desde que a ultima cobranca tenha 5 dias ou mais */
    SUMIU: [30, 60],      /* "quem sumiu": sem comprar ha 30 e ha 60 dias */
    PARCELA_DIAS: 30,     /* parcela do fiado vence a cada 30 dias da compra */
    PAGOU_RECENTE_DIAS: 7 /* quitou ha ate 7 dias: oferece o "Recebido, obrigada" */
  };

  var K_DADOS = 'lucronamao_v1', K_CLI = 'lucronamao_clientes', K_COB = 'lucronamao_cobrancas';

  function ler(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function gravar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  /* o dia do celular dela, igual ao hoje() do Controle */
  function hoje() { var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function dias(isoA, isoB) {
    var a = Date.parse(String(isoA).slice(0, 10) + 'T12:00:00Z'), b = Date.parse(String(isoB || hoje()).slice(0, 10) + 'T12:00:00Z');
    if (isNaN(a) || isNaN(b)) return 0;
    return Math.round((b - a) / 864e5);
  }
  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function r2(n) { return Math.round(n * 100) / 100; }
  function rs(n) { return 'R$ ' + Number(r2(n)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function num(n) { return Number(r2(n)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  /* ---------- espelho da conta do Controle ---------- */
  function jaPago(v) {
    if (Array.isArray(v.pagamentos)) return v.pagamentos.reduce(function (s, x) { return s + (Number(x.valor) || 0); }, 0);
    return v.pago ? v.total : 0;
  }
  function saldo(v) { return Math.max(0, r2(v.total - jaPago(v))); }
  function baseParcela(v) { return (v && typeof v.parcelasBase === 'number' && v.parcelasBase > 0) ? v.parcelasBase : (v ? v.total : 0); }
  function valorParcela(total, n) { return n > 1 ? Math.ceil(total / n * 100) / 100 : total; }
  function parcelasPagas(v) {
    var n = v && v.parcelas ? v.parcelas : 1; if (n <= 1) return null;
    var vp = valorParcela(baseParcela(v), n); if (vp <= 0) return null;
    var antes = (typeof v.parcelasBase === 'number' && v.parcelasBase > 0) ? Math.max(0, v.total - v.parcelasBase) : 0;
    var noAcordo = Math.max(0, jaPago(v) - antes);
    return { n: n, vp: vp, pagas: Math.min(n, Math.floor((noAcordo + 0.004) / vp)) };
  }

  /* ---------- dados ---------- */
  function dados() {
    var d = ler(K_DADOS);
    return (d && Array.isArray(d.vendas)) ? d : null;
  }
  function vendas() { var d = dados(); return d ? d.vendas : []; }
  function loja() { var d = dados(); return d && d.config ? (d.config.loja || '') : ''; }

  function clientesObj() {
    var c = ler(K_CLI);
    if (!c || !Array.isArray(c.lista)) c = { v: 1, seq: 1, lista: [], perguntado: false };
    if (!c.seq) c.seq = c.lista.reduce(function (m, x) { return Math.max(m, Number(x.id) || 0); }, 0) + 1;
    return c;
  }
  function clientes() { return clientesObj().lista; }
  function salvarClientes(obj) { return gravar(K_CLI, obj); }
  function clientePorId(id) {
    if (id == null) return null;
    return clientes().filter(function (c) { return String(c.id) === String(id); })[0] || null;
  }
  function nomesDe(c) { return [norm(c.nome)].concat((c.nomesAntigos || []).map(norm)); }
  /* nome normalizado -> cliente cadastrada (so quando UMA cliente tem esse nome) */
  function indicePorNome(lista) {
    var idx = {}, dup = {};
    lista.forEach(function (c) {
      nomesDe(c).forEach(function (n) { if (!n) return; if (idx[n] && idx[n] !== c) dup[n] = 1; else idx[n] = c; });
    });
    Object.keys(dup).forEach(function (n) { delete idx[n]; });
    return idx;
  }
  function criarCliente(campos) {
    var obj = clientesObj();
    var c = { id: obj.seq++, nome: String(campos.nome || '').trim(), whats: campos.whats || '',
      niver: campos.niver || null, obs: campos.obs || '', criadoEm: new Date().toISOString() };
    obj.lista.push(c);
    if (!salvarClientes(obj)) return null;
    return c;
  }

  /* a cliente de uma venda: {chave, cliente|null, nome} */
  function resolverCom(v, lista, idx) {
    var c = null;
    if (v.clienteId != null) c = lista.filter(function (x) { return String(x.id) === String(v.clienteId); })[0] || null;
    if (!c && v.cliente) c = idx[norm(v.cliente)] || null;
    if (c) return { chave: 'c:' + c.id, cliente: c, nome: c.nome };
    var n = norm(v.cliente);
    return n ? { chave: 'n:' + n, cliente: null, nome: String(v.cliente).trim() } : null;
  }
  function chaveDaVenda(v) {
    var lista = clientes(), r = resolverCom(v, lista, indicePorNome(lista));
    return r ? r.chave : null;
  }

  /* ---------- historico de cobranca ---------- */
  function cobrancas() { var c = ler(K_COB); return (c && typeof c === 'object' && !Array.isArray(c)) ? c : {}; }
  function registrarCobranca(chave, tom, valor) {
    var c = cobrancas();
    if (!Array.isArray(c[chave])) c[chave] = [];
    c[chave].push({ em: new Date().toISOString(), tom: tom, valor: r2(valor || 0) });
    return gravar(K_COB, c);
  }
  /* uma pessoa pode ter cobrancas gravadas pelo nome (antes de ser cadastrada) e
     pela ficha (depois): junta as duas */
  function historicoDe(chaves) {
    var c = cobrancas(), out = [];
    chaves.forEach(function (k) { if (Array.isArray(c[k])) out = out.concat(c[k]); });
    return out.filter(function (x) { return x && x.em; }).sort(function (a, b) { return String(a.em).localeCompare(String(b.em)); });
  }

  /* ---------- quem te deve ---------- */
  function agrupar(lista, filtro) {
    var idx = indicePorNome(lista), g = {};
    vendas().forEach(function (v) {
      if (!filtro(v)) return;
      var r = resolverCom(v, lista, idx); if (!r) return;
      if (!g[r.chave]) g[r.chave] = { chave: r.chave, cliente: r.cliente, nome: r.nome, vendas: [], chaves: [r.chave] };
      var gr = g[r.chave];
      gr.vendas.push(v);
      var kn = 'n:' + norm(v.cliente);
      if (v.cliente && gr.chaves.indexOf(kn) < 0) gr.chaves.push(kn);
    });
    Object.keys(g).forEach(function (k) {
      var gr = g[k];
      if (gr.cliente) nomesDe(gr.cliente).forEach(function (n) { if (gr.chaves.indexOf('n:' + n) < 0) gr.chaves.push('n:' + n); });
      /* sem cadastro, o nome que aparece e a grafia mais usada nas vendas dela */
      if (!gr.cliente) gr.nome = melhorNome(gr.vendas);
    });
    return Object.keys(g).map(function (k) { return g[k]; });
  }

  /* a mesma cliente escrita de jeitos diferentes ("Bia", "bia "): fica a grafia
     mais usada; no empate, a que comeca com maiuscula, depois a mais recente */
  function melhorNome(vs) {
    var cont = {}, ordem = [];
    vs.slice().sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); }).forEach(function (v) {
      var n = String(v.cliente || '').trim().replace(/\s+/g, ' '); if (!n) return;
      if (!cont[n]) { cont[n] = 0; ordem.push(n); }
      cont[n]++;
    });
    var mai = function (n) { return /^[A-ZÀ-Ý]/.test(n) ? 1 : 0; };
    return ordem.slice().sort(function (a, b) { return (cont[b] - cont[a]) || (mai(b) - mai(a)) || (ordem.indexOf(a) - ordem.indexOf(b)); })[0] || '';
  }

  function pecasDe(vs) {
    var q = {}, ordem = [];
    vs.forEach(function (v) {
      (v.itens || []).forEach(function (i) {
        var n = String(i.nome || '').trim(); if (!n) return;
        if (!q[n]) { q[n] = 0; ordem.push(n); }
        q[n] += Number(i.qtd) || 1;
      });
    });
    return ordem.map(function (n) { return q[n] > 1 ? n + ' x' + q[n] : n; });
  }

  function devedoras() {
    var lista = clientes(), h = hoje();
    var grupos = agrupar(lista, function (v) { return v.pgto === 'fiado' && saldo(v) > 0; });
    grupos.forEach(function (g) {
      g.vendas.sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); });
      g.falta = r2(g.vendas.reduce(function (s, v) { return s + saldo(v); }, 0));
      g.pago = r2(g.vendas.reduce(function (s, v) { return s + jaPago(v); }, 0));
      g.desde = g.vendas[0].data;
      g.dias = Math.max(0, dias(g.desde, h));
      g.pecas = pecasDe(g.vendas);
      /* parcela do mes: soma da parcela de cada venda parcelada que ainda tem parcela a pagar */
      g.parcelada = false; g.parcela = 0; g.parcelaAtrasada = false;
      g.vendas.forEach(function (v) {
        var pp = parcelasPagas(v);
        if (!pp || pp.pagas >= pp.n) return;
        g.parcelada = true;
        g.parcela = r2(g.parcela + Math.min(pp.vp, saldo(v)));
        var devidas = Math.min(pp.n, Math.floor(Math.max(0, dias(v.data, h)) / REGRAS.PARCELA_DIAS));
        if (devidas > pp.pagas) g.parcelaAtrasada = true;
      });
      var hist = historicoDe(g.chaves);
      g.historico = hist;
      /* so conta a etapa das cobrancas feitas DESTA divida (depois da compra mais antiga em aberto) */
      g.cobradas = hist.filter(function (x) { return String(x.em).slice(0, 10) >= g.desde; }).length;
      g.ultima = hist.length ? hist[hist.length - 1] : null;
      g.diasUltima = g.ultima ? Math.max(0, dias(String(g.ultima.em).slice(0, 10), h)) : null;
      var passou = g.dias >= REGRAS.PRAZO_DIAS || g.parcelaAtrasada;
      var descansou = g.ultima === null || g.diasUltima >= REGRAS.INTERVALO_DIAS;
      g.hojeVale = passou && descansou;
      g.tom = tomSugerido(g);
      g.whats = g.cliente && g.cliente.whats ? g.cliente.whats : '';
      g.vendaIds = g.vendas.map(function (v) { return v.id; });
    });
    grupos.sort(function (a, b) {
      if (a.hojeVale !== b.hojeVale) return a.hojeVale ? -1 : 1;
      if (a.dias !== b.dias) return b.dias - a.dias;
      return b.falta - a.falta;
    });
    return grupos;
  }

  /* o tom pela etapa: leve, depois direto, depois propor dividir. Quem ja pagou algo
     recebe "pagou uma parte"; venda parcelada, "parcela do mes". */
  function tomSugerido(g) {
    if (g.parcelada) return 'parcela';
    if (g.pago > 0) return 'parte';
    if (g.cobradas <= 0) return 'leve';
    if (g.cobradas === 1) return 'direto';
    return 'dividir';
  }

  /* quitou ha pouco: pra mandar o "Recebido, obrigada" */
  function pagaramRecente() {
    var lista = clientes(), h = hoje();
    var abertas = {};
    devedoras().forEach(function (g) { abertas[g.chave] = 1; });
    var grupos = agrupar(lista, function (v) {
      if (v.pgto !== 'fiado' || saldo(v) > 0 || !Array.isArray(v.pagamentos) || !v.pagamentos.length) return false;
      var ult = v.pagamentos.map(function (x) { return String(x.data || ''); }).sort().pop();
      return dias(ult, h) <= REGRAS.PAGOU_RECENTE_DIAS;
    });
    return grupos.filter(function (g) { return !abertas[g.chave]; }).map(function (g) {
      g.pago = r2(g.vendas.reduce(function (s, v) { return s + jaPago(v); }, 0));
      g.falta = 0; g.pecas = pecasDe(g.vendas); g.tom = 'recebido';
      g.historico = historicoDe(g.chaves);
      g.ultima = g.historico.length ? g.historico[g.historico.length - 1] : null;
      g.diasUltima = g.ultima ? Math.max(0, dias(String(g.ultima.em).slice(0, 10), h)) : null;
      g.whats = g.cliente && g.cliente.whats ? g.cliente.whats : '';
      g.dias = 0; g.parcela = 0;
      return g;
    });
  }

  function paraCobrarHoje() { return devedoras().filter(function (g) { return g.hojeVale; }); }

  /* ---------- ficha da cliente ---------- */
  function fichas() {
    var lista = clientes(), h = hoje(), ym = h.slice(0, 7);
    var grupos = agrupar(lista, function (v) { return !!(v.cliente || v.clienteId != null); });
    var porChave = {};
    grupos.forEach(function (g) { porChave[g.chave] = g; });
    return lista.map(function (c) {
      var g = porChave['c:' + c.id];
      var vs = g ? g.vendas.slice().sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); }) : [];
      var total = r2(vs.reduce(function (s, v) { return s + (Number(v.total) || 0); }, 0));
      var mes = r2(vs.filter(function (v) { return String(v.data).slice(0, 7) === ym; })
        .reduce(function (s, v) { return s + (Number(v.total) || 0); }, 0));
      var qtd = {};
      vs.forEach(function (v) { (v.itens || []).forEach(function (i) { var n = String(i.nome || '').trim(); if (n) qtd[n] = (qtd[n] || 0) + (Number(i.qtd) || 1); }); });
      var top = Object.keys(qtd).sort(function (a, b) { return qtd[b] - qtd[a]; }).slice(0, 3).map(function (n) { return { nome: n, qtd: qtd[n] }; });
      var fiado = r2(vs.filter(function (v) { return v.pgto === 'fiado'; }).reduce(function (s, v) { return s + saldo(v); }, 0));
      var ultima = vs.length ? vs[0].data : null;
      return { cliente: c, chave: 'c:' + c.id, vendas: vs, total: total, mes: mes, n: vs.length,
        media: vs.length ? r2(total / vs.length) : 0, ultima: ultima,
        diasSemComprar: ultima ? Math.max(0, dias(ultima, h)) : null, top: top, fiado: fiado };
    });
  }

  /* nomes das vendas que ainda nao sao clientes cadastradas (pro "trazer os nomes") */
  function nomesSemCadastro() {
    var lista = clientes(), idx = indicePorNome(lista), grupos = {}, ordem = [];
    vendas().forEach(function (v) {
      if (!v.cliente || (v.clienteId != null && clientePorId(v.clienteId))) return;
      var n = norm(v.cliente); if (!n || idx[n]) return;
      if (!grupos[n]) { grupos[n] = []; ordem.push(n); }
      grupos[n].push(v);
    });
    return ordem.map(function (n) { return melhorNome(grupos[n]); });
  }

  /* ---------- WhatsApp ---------- */
  /* numero brasileiro: so digitos; com DDD (10 ou 11) ganha o 55 na frente */
  function foneWa(s) {
    var d = String(s || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.length === 10 || d.length === 11) return '55' + d;
    if ((d.length === 12 || d.length === 13) && d.indexOf('55') === 0) return d;
    return '';
  }
  function linkWhats(fone, texto) {
    var f = foneWa(fone);
    return 'https://wa.me/' + (f || '') + '?text=' + encodeURIComponent(texto || '');
  }

  window.Lojinha = {
    REGRAS: REGRAS, hoje: hoje, dias: dias, norm: norm, rs: rs, num: num,
    jaPago: jaPago, saldo: saldo, parcelasPagas: parcelasPagas,
    dados: dados, vendas: vendas, loja: loja,
    clientesObj: clientesObj, clientes: clientes, salvarClientes: salvarClientes,
    clientePorId: clientePorId, criarCliente: criarCliente, indicePorNome: indicePorNome,
    chaveDaVenda: chaveDaVenda,
    cobrancas: cobrancas, registrarCobranca: registrarCobranca, historicoDe: historicoDe,
    devedoras: devedoras, pagaramRecente: pagaramRecente, paraCobrarHoje: paraCobrarHoje,
    fichas: fichas, nomesSemCadastro: nomesSemCadastro, pecasDe: pecasDe,
    foneWa: foneWa, linkWhats: linkWhats
  };
})();
