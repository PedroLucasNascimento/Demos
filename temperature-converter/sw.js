const CACHE_NAME = 'campo-eletrico-v11';
const APP_SHELL = [
  './',
  './index.html',
  './converter.css',
  './app.js',
  './manifest.json',
  './icon.svg'
];
const CDN_ASSETS = [
  'https://alcdn.msauth.net/browser/2.30.0/js/msal-browser.min.js',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js',
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'
];
const OPTIONAL_ASSETS = [
  './assets/images/entrada_painel.png',
  './assets/images/menor_gaveta.png',
  './assets/images/modelo_order_code_rele.png',
  './assets/images/modo_operacao_transformadores.png',
  './assets/images/disparador_lsig.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await Promise.all(CDN_ASSETS.map(async asset => {
      try {
        await cache.add(asset);
      } catch (error) {
        console.warn(`Não foi possível pré-armazenar ${asset}; será necessário acesso à rede.`, error);
      }
    }));
    await Promise.all(OPTIONAL_ASSETS.map(async asset => {
      try {
        await cache.add(asset);
      } catch (error) {
        console.warn(`Não foi possível pré-armazenar ${asset}; será necessário acesso à rede.`, error);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  const isCdnAsset = CDN_ASSETS.includes(requestUrl.href);
  if (requestUrl.origin !== self.location.origin && !isCdnAsset) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    try {
      const response = await fetch(event.request);
      if (response.ok && (requestUrl.origin === self.location.origin || response.type !== 'opaque')) {
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') {
        const appShell = await cache.match('./index.html');
        if (appShell) return appShell;
      }
      throw error;
    }
  })());
});
