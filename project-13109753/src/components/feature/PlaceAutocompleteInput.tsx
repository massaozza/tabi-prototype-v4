// src/components/feature/PlaceAutocompleteInput.tsx
// Google Places Autocompleteを使った、実在する場所を検索して選択する入力欄。
//
// 【目的】ユーザーが手入力する場所の名前（「伊勢屋」「Iseya」「辻堂の伊勢屋」等、
// 表記が投稿者によって異なる）を、GoogleのPlace ID（不変の識別子）に紐づける。
// これにより、異なる投稿者が同じ場所について書いても、同じ場所として
// 名寄せ・統合できるようになる（表記の違いによる分裂を防ぐ）。
//
// 選択された場所は onPlaceSelected で { name, placeId, address } として渡される。
// 自由入力（実在しない/候補にない場所名）も許可し、その場合は placeId は
// 設定されない（フリーテキストでの投稿自体は妨げない）。
//
// 【重要】@types/google.maps をpackage.jsonに追加せずに済むよう、
// Google Maps関連の型は意図的に any として扱っている
// （型パッケージの追加は、別のビルド不具合を招くリスクがあるため）。

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
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !inputRef.current) return;
        const googleAny = (window as any).google;
        if (!googleAny?.maps?.places) return;

        const autocomplete = new googleAny.maps.places.Autocomplete(inputRef.current, {
          fields: ['place_id', 'name', 'formatted_address'],
          // 日本国内の場所のみに絞る（TABIは日本旅行に特化しているため）
          componentRestrictions: { country: 'jp' },
        });
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place?.place_id && place?.name) {
            onChange(place.name);
            onPlaceSelected({
              name: place.name,
              placeId: place.place_id,
              address: place.formatted_address,
            });
          }
        });
        autocompleteRef.current = autocomplete;
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {loadError && (
        <p className="text-xs text-foreground-400 mt-1">
          場所の検索機能が読み込めませんでした。手入力での投稿は引き続き可能です。
        </p>
      )}
    </div>
  );
}
