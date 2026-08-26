// src/lib/loadGoogleMaps.ts
// Google Maps JavaScript API（Placesライブラリ含む）を、必要になったタイミングで
// 一度だけ動的に読み込むためのユーティリティ。
//
// 複数のコンポーネントが同時に呼び出しても、スクリプトタグは1つだけ挿入される
// （すでに読み込み中・読み込み済みの場合は、そのPromiseを再利用する）。

let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  // すでに読み込み済みの場合は即座に解決する
  if (typeof window !== 'undefined' && (window as any).google?.maps?.places) {
    return Promise.resolve();
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not set'));
      return;
    }

    const existingScript = document.querySelector('script[data-google-maps-loader="true"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Maps script')));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsLoader = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(script);
  });

  return loadPromise;
}
