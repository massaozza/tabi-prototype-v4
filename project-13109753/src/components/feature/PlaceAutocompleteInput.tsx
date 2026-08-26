// src/components/feature/PlaceAutocompleteInput.tsx
// Google Places Autocompleteを使った、実在する場所を検索して選択する入力欄。
//
// 【目的】ユーザーが手入力する場所の名前（「伊勢屋」「Iseya」「辻堂の伊勢屋」等、
// 表記が投稿者によって異なる）を、GoogleのPlace ID（不変の識別子）に紐づける。
// これにより、異なる投稿者が同じ場所について書いても、同じ場所として
// 名寄せ・統合できるようになる（表記の違いによる分裂を防ぐ）。
//
// 【重要・2026年時点の注意】2025年3月1日以降に作成されたGoogle Cloud
// プロジェクトでは、従来の google.maps.places.Autocomplete クラスが
// 新規利用不可となっている（エラーは出ないが、候補が一切表示されない）。
// そのため、新しい google.maps.places.PlaceAutocompleteElement
// （Web Componentとして提供される）を使用する。
//
// このElementはGoogle側が内部でinput要素を持つカスタム要素のため、
// 通常の<input>に比べて細かい見た目のカスタマイズは制限される。
// 候補が一覧にない場所は「手入力する」リンクから、通常の自由入力に切り替えられる。

import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/loadGoogleMaps';

interface PlaceAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected: (place: { name: string; placeId: string; address?: string }) => void;
  placeholder?: string;
  className?: string;
}

export default function PlaceAutocompleteInput({
  value,
  onChange,
  onPlaceSelected,
  placeholder,
  className,
}: PlaceAutocompleteInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widgetReady, setWidgetReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  useEffect(() => {
    if (manualMode) return;
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const googleAny = (window as any).google;
        if (!googleAny?.maps?.places?.PlaceAutocompleteElement) {
          setLoadError(true);
          return;
        }

        containerRef.current.innerHTML = '';

        const element = new googleAny.maps.places.PlaceAutocompleteElement({
          includedRegionCodes: ['jp'],
        });
        element.style.width = '100%';

        element.addEventListener('gmp-select', async (event: any) => {
          try {
            const prediction = event.placePrediction;
            if (!prediction) return;
            const place = prediction.toPlace();
            await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'id'] });
            onChange(place.displayName || '');
            onPlaceSelected({
              name: place.displayName || '',
              placeId: place.id || '',
              address: place.formattedAddress || undefined,
            });
          } catch {
            // 選択後の詳細取得に失敗しても、投稿自体は止めない
          }
        });

        containerRef.current.appendChild(element);
        setWidgetReady(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualMode]);

  if (manualMode || loadError) {
    return (
      <div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className}
        />
        {loadError && (
          <p className="text-xs text-foreground-400 mt-1">
            場所の検索機能が読み込めませんでした。手入力で入力してください。
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div ref={containerRef} />
      {!widgetReady && (
        <input type="text" disabled placeholder="読み込み中..." className={className} />
      )}
      <button
        type="button"
        onClick={() => setManualMode(true)}
        className="text-xs text-foreground-400 hover:text-foreground-600 mt-1 underline cursor-pointer"
      >
        候補に無い場合は手入力する
      </button>
    </div>
  );
}
