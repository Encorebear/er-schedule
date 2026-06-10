// ER Schedule Service Worker — 오프라인 캐시
const CACHE = 'er-schedule-v6';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// 설치: 핵심 파일 캐시
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(ASSETS.map(url => cache.add(url).catch(() => {})))
    )
  );
  self.skipWaiting(); // 즉시 활성화
});

// 활성화: 이전 캐시 삭제
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim(); // 즉시 모든 탭에 적용
});

// 메시지: skipWaiting 요청 처리
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

// 요청 처리
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = e.request.url;
  const isHtml = e.request.mode === 'navigate'
    || url.endsWith('/') || url.endsWith('.html');

  if (isHtml) {
    // ── HTML: 네트워크 우선 → 오프라인 시 캐시 폴백 ──
    // 인터넷 있을 때는 항상 최신 버전 제공, 캐시도 갱신
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
  } else {
    // ── 기타 자산: 캐시 우선 → 없으면 네트워크 ──
    e.respondWith(
      caches.match(e.request).then(cached => {
        const net = fetch(e.request).then(res => {
          if (res && res.status === 200 && res.type !== 'opaque') {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => null);
        return cached || net;
      })
    );
  }
});
