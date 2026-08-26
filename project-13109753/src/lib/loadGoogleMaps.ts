// src/lib/loadGoogleMaps.ts
// Google Maps JavaScript API（Placesライブラリ含む）を、必要になったタイミングで
// 一度だけ動的に読み込むためのユーティリティ。
//
// 複数のコンポーネントが同時に呼び出しても、スクリプトタグは1つだけ挿入される
// （すでに読み込み中・読み込み済みの場合は、そのPromiseを再利用する）。
//
// 【重要】loading=async 方式のスクリプトタグは、onload発生時点では
// google.maps オブジェクト自体は存在するが、placesライブラリの中身
// （PlaceAutocompleteElement等）がまだ完全に準備できていないことがある
// （タイミングによる競合状態）。そのため、onload後に必ず
// google.maps.importLibrary('places') を呼び、その完了を待ってから
// resolveする（これがGoogle推奨の読み込み完了の待ち方）。

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

    const finishWithImportLibrary = async () => {
      try {
        const googleAny = (window as any).google;
        if (!googleAny?.maps?.importLibrary) {
          reject(new Error('google.maps.importLibrary is not available'));
          return;
        }
        await googleAny.maps.importLibrary('places');
        resolve();
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to import places library'));
      }
    };

    const existingScript = document.querySelector('script[data-google-maps-loader="true"]');
    if (existingScript) {
      if ((window as any).google?.maps?.importLibrary) {
        finishWithImportLibrary();
      } else {
        existingScript.addEventListener('load', finishWithImportLibrary);
        existingScript.addEventListener('error', () =>
          reject(new Error('Failed to load Google Maps script'))
        );
      }
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsLoader = 'true';
    script.onload = finishWithImportLibrary;
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(script);
  });

  return loadPromise;
}
