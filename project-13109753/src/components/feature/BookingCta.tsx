// src/components/feature/BookingCta.tsx
// 旅程ページに置く「Book Hotel」「Book Experience」のCTA。
//
// 【現状】楽天トラベル・Booking.com等のアフィリエイト登録がまだ済んでいないため、
// リンク先は未設定（クリックしても遷移しない）。ただしクリックの記録は
// 今のうちから行い、実際のリンクに差し替わった時点で
// 「どの旅程から何件予約に進んだか」を遡って集計できるようにしている。
//
// 記録は2系統に送る：
//   /api/track-view      … コンテンツ単位のファネル計測（表示→保存→コピー→予約）
//   /api/affiliate-click … 個別クリックイベント（将来の収益計算用）
//
// リンクが用意できたら hotelUrl / experienceUrl を渡すだけで実リンクになる。

import { useState } from 'react';
import { useAutoT } from '@/hooks/useAutoT';
import { trackEvent, type TrackContentType } from '@/lib/track';

interface BookingCtaProps {
  /** 計測対象のコンテンツ種別 */
  contentType: TrackContentType;
  /** 計測対象のID */
  contentId: string;
  /** どの画面のCTAか（affiliate-clickのsourceに渡す） */
  source: 'trip' | 'my-trip';
  /** 旅程の行き先など。記録に残すと後で分析しやすい */
  context?: string;
  /** ホテル予約のリンク先。未指定ならリンクなし（準備中表示） */
  hotelUrl?: string;
  /** 体験予約のリンク先。未指定ならリンクなし（準備中表示） */
  experienceUrl?: string;
  className?: string;
}

type Kind = 'hotel' | 'experience';

function recordAffiliateClick(
  source: string,
  context: string | undefined,
  ctaLabel: string
): void {
  try {
    void fetch('/api/affiliate-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ source, context, ctaLabel }),
      keepalive: true,
    }).catch(() => {
      /* 計測の失敗は無視する */
    });
  } catch {
    /* 計測の失敗は無視する */
  }
}

export default function BookingCta({
  contentType,
  contentId,
  source,
  context,
  hotelUrl,
  experienceUrl,
  className = '',
}: BookingCtaProps) {
  const t = useAutoT();
  const [notice, setNotice] = useState<Kind | null>(null);

  const handleClick = (kind: Kind, url?: string) => {
    trackEvent(kind === 'hotel' ? 'booking_hotel' : 'booking_experience', contentType, contentId);
    recordAffiliateClick(source, context, kind === 'hotel' ? 'Book Hotel' : 'Book Experience');

    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    // リンク未設定のうちは、押せたことが分かるように案内を出す
    setNotice(kind);
  };

  const baseBtn =
    'flex-1 inline-flex items-center justify-center gap-2 font-semibold text-sm px-5 py-3 rounded-lg transition-colors cursor-pointer whitespace-nowrap';

  return (
    <div
      className={`bg-background-50 border border-background-200 rounded-xl p-5 md:p-6 ${className}`}
    >
      <h3 className="font-heading font-bold text-base text-foreground-900 mb-1">
        {t('booking_readyToGo', 'Ready to go?')}
      </h3>
      <p className="text-sm text-foreground-600 mb-4">
        {t('booking_subtitle', 'Book your stay and activities for this trip.')}
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => handleClick('hotel', hotelUrl)}
          className={`${baseBtn} bg-primary-500 hover:bg-primary-600 text-white`}
        >
          <i className="ri-hotel-line"></i>
          {t('booking_bookHotel', 'Book Hotel')}
        </button>
        <button
          type="button"
          onClick={() => handleClick('experience', experienceUrl)}
          className={`${baseBtn} bg-background-100 hover:bg-background-200 text-foreground-800`}
        >
          <i className="ri-compass-3-line"></i>
          {t('booking_bookExperience', 'Book Experience')}
        </button>
      </div>

      {notice && (
        <p className="text-xs text-foreground-500 mt-3" role="status">
          {t(
            'booking_comingSoon',
            'Booking is coming soon. We are finishing up our partner setup.'
          )}
        </p>
      )}

      <p className="text-[11px] text-foreground-400 mt-3">
        {t(
          'booking_disclosure',
          'We may earn a commission from bookings made through these links, at no extra cost to you.'
        )}
      </p>
    </div>
  );
}
