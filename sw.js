/* Service worker do Lucro na Mão.
   Objetivos: (1) habilitar o prompt nativo "instalar app";
   (2) fazer os apps abrirem OFFLINE depois da primeira visita.
   ESTRATÉGIA: rede primeiro, cache como reserva. Assim a compradora sempre
   recebe a versão nova quando tem internet, e continua funcionando sem ela.
   Não guarda dado da usuária: os dados vivem no localStorage do aparelho. */
const CACHE = 'lucronamao-v21';
const ARQS = [
  'hub.html', 'index.html', 'precificacao.html', 'divulga.html',
  'manifest.webmanifest', 'icone-192.png', 'icone-512.png',
  'favicon-32.png', 'favicon-96.png', 'favicon-180.png', 'logo-branca.png',
  /* As PASTAS de acesso entram no pre-cache (31/08/2026). Antes so entravam se
     a navegacao passasse por elas, e o ramo offline nao tinha o que servir na
     primeira abertura do icone: caia no hub pelado, tudo travado. Cada pasta e
     leve (o mesmo menu) e e ela que carrega o nivel de acesso. */
  /* Cada pasta serve o menu E os 3 apps (31/08/2026): e isso que mantem a chave
     no caminho de toda pagina, pro icone nascer liberado no Compartilhar do
     Safari. Pre-cachear o index de cada uma cobre a abertura offline. */
  'c/', 'd/', 'p/', 'cd/', 'cp/', 'u/', 'tudo/'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(ARQS.map(a => c.add(new Request(a, {cache: 'reload'})))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

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

        /* Offline e sem copia exata: cair no index da PROPRIA pasta de acesso
           (/app/tudo/ etc), NUNCA no hub pelado, senao o app instalado abre
           travado pedindo pra comprar o que a compradora ja pagou.

           BUG REAL, 31/08/2026 (uma compradora com o link novo, print do menu
           todo travado): a versao anterior usava `m[0]`, que e '/tudo/' e nao
           '/app/tudo/'. Isso resolvia para a RAIZ do dominio, nunca casava com
           o cache, e a compradora caia no hub pelado. Duas causas na mesma
           linha: (1) caminho sem o prefixo da aplicacao; (2) `caches.match(a)
           || caches.match(b)` nunca cai no segundo, porque uma Promise e sempre
           truthy. Agora o caminho da pasta e montado a partir do pathname REAL
           e cada tentativa e conferida com await. */
        const m = url.pathname.match(/\/(c|d|p|cd|cp|u|tudo)(?:\/|$)/);
        if (m) {
          const pasta = url.pathname.slice(0, m.index + m[0].length).replace(/\/?$/, '/');
          for (const alvo of [pasta, pasta + 'index.html']) {
            const r = await caches.match(alvo, {ignoreSearch: true});
            if (r) return r;
          }
        }

        /* Ultimo recurso: so chega aqui quem abriu fora de uma pasta de acesso.
           Relativo ao escopo do SW, nao a raiz do dominio. */
        return (await caches.match(new URL('hub.html', self.registration.scope).pathname,
                                   {ignoreSearch: true}))
               || Response.error();
      })
  );
});
