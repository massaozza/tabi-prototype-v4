// src/hooks/useSeoMeta.ts
//
// ページごとのtitle・meta descriptionを設定する軽量フック。
//
// 【なぜ必要か】
// これまで全ページがindex.htmlの静的なtitle/meta description
// （トップページ向けの文言）を使い回していた。1万件を超える個別Spot
// ページがすべて同じtitleでは、検索エンジンがページごとの内容を
// 区別しづらく、個別ページが検索結果に出てくる機会を損なっていた。
//
// 【react-helmet等を使わない理由】
// 新しい依存を増やすほどの規模ではないため、documentを直接操作する
// 最小限の実装にした。SPA内の遷移のたびに実行され、離脱時に
// 元のトップページ用の値へ戻す。
//
// 【注意】og:title・twitter:title等は今回は対象外（index.htmlの
// トップページ向けの値のまま）。SNSシェア時の見た目を個別ページに
// 最適化したい場合は別途対応が必要。

import { useEffect } from 'react';

const DEFAULT_TITLE = 'TABI47 | 47 Prefectures. Millions of Local Stories. One Japan.';
const DEFAULT_DESCRIPTION =
  'Discover the real Japan with TABI47. Real itineraries, local knowledge, and AI trip planning across all 47 prefectures. From Tokyo to Okinawa, find hidden gems and authentic experiences beyond the guidebook.';

function setMetaDescription(content: string) {
  let tag = document.querySelector('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', 'description');
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

/**
 * ページのtitle・meta descriptionを設定する。
 * title/descriptionがまだ無い場合（データ読み込み中等）はundefinedを渡せば、
 * 既定値（トップページ向け）のままにする。
 */
export function useSeoMeta(title?: string, description?: string): void {
  useEffect(() => {
    if (title) document.title = title;
    if (description) setMetaDescription(description);

    return () => {
      // 他ページへ遷移する際、次のページが自分でuseSeoMetaを呼ぶまでの
      // 一瞬だけ既定値に戻る形になるが、実害はない
      document.title = DEFAULT_TITLE;
      setMetaDescription(DEFAULT_DESCRIPTION);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description]);
}
