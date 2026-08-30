/* Service worker do Lucro na Mão.
   Objetivos: (1) habilitar o prompt nativo "instalar app";
   (2) fazer os apps abrirem OFFLINE depois da primeira visita.
   ESTRATÉGIA: rede primeiro, cache como reserva. Assim a compradora sempre
   recebe a versão nova quando tem internet, e continua funcionando sem ela.
   Não guarda dado da usuária: os dados vivem no localStorage do aparelho. */
const CACHE = 'lucronamao-v13';
const ARQS = [
  'hub.html', 'index.html', 'precificacao.html', 'divulga.html',
  'manifest.webmanifest', 'icone-192.png', 'icone-512.png',
  'favicon-32.png', 'favicon-96.png', 'favicon-180.png', 'logo-branca.png'
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
      .catch(() => caches.match(req, {ignoreSearch: true})
        .then(r => {
          if (r) return r;
          /* offline e sem copia exata: cair no index da PROPRIA pasta de acesso
             (/app/tudo/ etc), nunca no hub pelado, senao o app instalado abre
             travado. Erro real de 30/08/2026. */
          const m = url.pathname.match(/\/(c|d|p|cd|cp|u|tudo)\//);
          return caches.match(m ? m[0] : 'hub.html') || caches.match('hub.html');
        }))
  );
});
