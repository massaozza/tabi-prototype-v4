// src/lib/loadGoogleMaps.ts
// Google Maps JavaScript API（Placesライブラリ含む）を、必要になったタイミングで
// 一度だけ動的に読み込むためのユーティリティ。
//
// 複数のコンポーネントが同時に呼び出しても、スクリプトタグは1つだけ挿入される
// （すでに読み込み中・読み込み済みの場合は、そのPromiseを再利用する）。
//
// 【重要】Googleが推奨する新しい非同期読み込み方式（loading=async +
// importLibrary）を試したが、動作が不安定だったため、より枯れた・確実な
// 従来型のスクリプトタグ読み込み方式（&libraries=places をつけた単純な
// <script src="...">）に戻している。この方式でも、新しい
// PlaceAutocompleteElement クラス自体は問題なく利用できる
// （Googleが利用不可としているのは、古い Autocomplete クラスのみ）。

let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (
    typeof window !== 'undefined' &&
    (window as any).google?.maps?.places?.PlaceAutocompleteElement
  ) {
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
      if ((window as any).google?.maps?.places?.PlaceAutocompleteElement) {
        resolve();
      } else {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', () =>
          reject(new Error('Failed to load Google Maps script'))
        );
      }
      return;
    }

    const script = document.createElement('script');
    // loading=async は付けず、シンプルな同期的スクリプト読み込みにする
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.dataset.googleMapsLoader = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(script);
  });

  return loadPromise;
}
