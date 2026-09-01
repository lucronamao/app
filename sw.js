/* Service worker do Lucro na Mão.
   Objetivos: (1) habilitar o prompt nativo "instalar app";
   (2) fazer os apps abrirem OFFLINE depois da primeira visita;
   (3) carregar o NÍVEL DE ACESSO num lugar que atravessa o isolamento do iOS.
   ESTRATÉGIA: rede primeiro, cache como reserva. Assim a compradora sempre
   recebe a versão nova quando tem internet, e continua funcionando sem ela. */
const CACHE = 'lucronamao-v28';
const ARQS = [
  'hub.html', 'index.html', 'precificacao.html', 'divulga.html', 'diagnostico.html',
  'manifest.webmanifest', 'icone-192.png', 'icone-512.png',
  'favicon-32.png', 'favicon-96.png', 'favicon-180.png', 'logo-branca.png',
  /* Cada pasta serve o menu E os apps: é isso que mantém a chave no caminho de
     toda página, pro ícone nascer liberado no Compartilhar do Safari. */
  'c/', 'd/', 'p/', 'cd/', 'cp/', 'u/', 'tudo/'
];

/* ===== O NÍVEL VIAJA PELO CACHE STORAGE (31/08/2026) =====

   Último furo do caso da compradora que tentou 7 vezes. O diagnóstico do aparelho
   dela voltou com TUDO certo (cache v21, start_url /app/tudo/, os 3 liberados) e
   mesmo assim o ícone abria travado.

   O que sobra: se o atalho dela abre /app/hub.html (link antigo no histórico do
   Safari, ou atalho criado de uma página da raiz), o hub não tem chave no caminho
   e cai no localStorage — que no iOS é SEPARADO entre o Safari e o app instalado,
   e cada instalação tem o seu (web.dev/learn/pwa/installation). O Safari dela
   gravou o nível; o ícone abre noutro pote, vê vazio, e trava.

   O Cache Storage, ao contrário do localStorage, é por ORIGEM, e o service worker
   é o mesmo nas duas rotas. Gravar o nível aqui faz ele ATRAVESSAR o isolamento.
   É a única via disponível: a Apple não oferece nenhuma suportada pra passar dado
   do Safari pro app instalado. */
const CHAVE_NIVEL = '/__nivel__';
const VALIDOS = ['controle', 'divulga', 'preco'];

async function gravarNivel(itens) {
  try {
    const c = await caches.open(CACHE);
    const r = await c.match(CHAVE_NIVEL);
    let antes = [];
    if (r) { try { antes = await r.json(); } catch (e) {} }
    if (!Array.isArray(antes)) antes = [];
    const uniao = antes.slice();
    itens.forEach(i => { if (VALIDOS.indexOf(i) >= 0 && uniao.indexOf(i) < 0) uniao.push(i); });
    if (uniao.length !== antes.length) {
      await c.put(CHAVE_NIVEL, new Response(JSON.stringify(uniao),
        {headers: {'content-type': 'application/json'}}));
    }
    return uniao;
  } catch (e) { return itens; }
}

async function lerNivel() {
  try {
    const c = await caches.open(CACHE);
    const r = await c.match(CHAVE_NIVEL);
    if (!r) return [];
    const v = await r.json();
    return Array.isArray(v) ? v.filter(x => VALIDOS.indexOf(x) >= 0) : [];
  } catch (e) { return []; }
}

/* A página conversa com o SW por postMessage: pergunta o nível, ou manda gravar. */
self.addEventListener('message', e => {
  const d = e.data || {};
  const responder = u => { if (e.source) e.source.postMessage({tipo: 'nivel', itens: u}); };
  if (d.tipo === 'gravar-nivel' && Array.isArray(d.itens)) {
    e.waitUntil(gravarNivel(d.itens).then(responder));
  } else if (d.tipo === 'ler-nivel') {
    e.waitUntil(lerNivel().then(responder));
  }
});

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(ARQS.map(a => c.add(new Request(a, {cache: 'reload'})))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  /* Ao trocar de versão, MIGRA o nível gravado antes de apagar o cache velho.
     Sem isso, cada publicação nova apagaria o acesso da compradora. */
  e.waitUntil((async () => {
    const ks = await caches.keys();
    const velhos = ks.filter(k => k !== CACHE);
    for (const k of velhos) {
      try {
        const c = await caches.open(k);
        const r = await c.match(CHAVE_NIVEL);
        if (r) {
          const v = await r.json();
          if (Array.isArray(v) && v.length) await gravarNivel(v);
        }
      } catch (e) {}
    }
    await Promise.all(velhos.map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname === CHAVE_NIVEL) return;   /* dado interno, não é recurso */

  // rede primeiro (sempre a versão mais nova), cache só se a rede falhar
  e.respondWith(
    fetch(new Request(req.url, {cache: 'no-store', credentials: 'same-origin'}))
      .then(resp => {
        if (resp && resp.ok) {
          const copia = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
        }
        return resp;
      })
      .catch(async () => {
        const exata = await caches.match(req, {ignoreSearch: true});
        if (exata) return exata;

        /* Offline e sem cópia exata: cair no index da PRÓPRIA pasta de acesso
           (/app/tudo/ etc), NUNCA no hub pelado, senão o app instalado abre
           travado pedindo pra comprar o que a compradora já pagou.

           BUG REAL, 31/08/2026: a versão anterior usava `m[0]`, que é '/tudo/' e
           não '/app/tudo/'. Resolvia para a RAIZ do domínio, nunca casava com o
           cache, e a compradora caía no hub pelado. Duas causas na mesma linha:
           caminho sem o prefixo da aplicação, e `caches.match(a) ||
           caches.match(b)` que nunca cai no segundo, porque uma Promise é sempre
           truthy. */
        const m = url.pathname.match(/\/(c|d|p|cd|cp|u|tudo)(?:\/|$)/);
        if (m) {
          const pasta = url.pathname.slice(0, m.index + m[0].length).replace(/\/?$/, '/');
          for (const alvo of [pasta, pasta + 'index.html']) {
            const r = await caches.match(alvo, {ignoreSearch: true});
            if (r) return r;
          }
        }

        /* Último recurso: só chega aqui quem abriu fora de uma pasta de acesso.
           Relativo ao escopo do SW, não à raiz do domínio. */
        return (await caches.match(new URL('hub.html', self.registration.scope).pathname,
                                   {ignoreSearch: true}))
               || Response.error();
      })
  );
});
