import { useEffect, useRef } from 'react';
import { loadGoogleMaps } from '@/lib/loadGoogleMaps';

interface MentionedSpot {
  id: string;
  title: string;
  lat: number;
  lng: number;
}

interface ChatMapPanelProps {
  spots: MentionedSpot[];
}

// TABI 3.0：AIの回答内で言及されたSPOTを、小さな地図にピン表示する。
// チャットウィジェット内に収まるよう、コンパクトなサイズで表示する。
export default function ChatMapPanel({ spots }: ChatMapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (spots.length === 0) return;
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const googleAny = (window as any).google;
        if (!googleAny?.maps) return;

        const map = new googleAny.maps.Map(containerRef.current, {
          zoom: spots.length === 1 ? 13 : 9,
          center: { lat: spots[0].lat, lng: spots[0].lng },
          disableDefaultUI: true,
          zoomControl: true,
        });

        const bounds = new googleAny.maps.LatLngBounds();
        spots.forEach((spot) => {
          const position = { lat: spot.lat, lng: spot.lng };
          new googleAny.maps.Marker({
            position,
            map,
            title: spot.title,
          });
          bounds.extend(position);
        });

        if (spots.length > 1) {
          map.fitBounds(bounds);
        }
      })
      .catch(() => {
        // 地図の読み込みに失敗しても、チャット自体は続けられるようにする
      });

    return () => {
      cancelled = true;
    };
  }, [spots]);

  if (spots.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg overflow-hidden border border-background-200">
      <div ref={containerRef} className="w-full h-40" />
      <div className="bg-background-50 px-3 py-1.5 flex flex-wrap gap-1.5">
        {spots.map((spot) => (
          <span
            key={spot.id}
            className="text-xs text-foreground-600 bg-background-100 rounded-full px-2 py-0.5 whitespace-nowrap"
          >
            <i className="ri-map-pin-line mr-0.5"></i>
            {spot.title}
          </span>
        ))}
      </div>
    </div>
  );
}
