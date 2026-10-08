// src/hooks/useSeoMeta.ts
//
// ページごとのtitle・meta description・canonical・OG/Twitterタグを設定する
// 軽量フック群。
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
// 【2026-10-08 修正：canonical と OGタグ】
// Search Consoleで1.3万件超のSpotページが「検出 - インデックス未登録」
// のまま進まない問題を調査した結果、index.htmlに
//   <link rel="canonical" href="https://tabi47.com/">
// が固定で書かれており、全ページ（Spot詳細ページを含む）が
// 「正規URLはトップページ」と宣言していたことが分かった。これは
// 「このページはトップページの重複です」とGoogleに伝えているのと
// 同じで、個別ページのインデックス登録を妨げる強い負のシグナルになる。
// 併せて og:title / og:description / og:url もトップページ向けの値の
// ままだったため、同様にページごとの値へ更新するようにした。
//
// canonicalは「配信されている実際のホスト（location.origin）+
// そのページのパス」にする。ハードコードしないのは、apex（tabi47.com）と
// www（www.tabi47.com）のどちらで配信されていても、実際にユーザーと
// Googlebotが見ているURLと必ず一致させるため。クエリ文字列は含めない。

import { useEffect } from 'react';

const DEFAULT_TITLE = 'TABI47 | 47 Prefectures. Millions of Local Stories. One Japan.';
const DEFAULT_DESCRIPTION =
  'Discover the real Japan with TABI47. Real itineraries, local knowledge, and AI trip planning across all 47 prefectures. From Tokyo to Okinawa, find hidden gems and authentic experiences beyond the guidebook.';
const DEFAULT_SOCIAL_DESCRIPTION =
  'Discover the real Japan beyond the guidebook. Real itineraries and local knowledge across all 47 prefectures of Japan.';

/** <meta {attr}="{key}" content="..."> を作成または更新する */
function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let tag = document.querySelector(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setCanonicalLink(href: string) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

/**
 * ページのtitle・meta description（とOG/Twitterの対応タグ）を設定する。
 * title/descriptionがまだ無い場合（データ読み込み中等）はundefinedを渡せば、
 * 既定値（トップページ向け）のままにする。
 */
export function useSeoMeta(title?: string, description?: string): void {
  useEffect(() => {
    if (title) {
      document.title = title;
      setMeta('property', 'og:title', title);
      setMeta('name', 'twitter:title', title);
    }
    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
      setMeta('name', 'twitter:description', description);
    }

    return () => {
      // 他ページへ遷移する際、次のページが自分でuseSeoMetaを呼ぶまでの
      // 一瞬だけ既定値に戻る形になるが、実害はない
      document.title = DEFAULT_TITLE;
      setMeta('property', 'og:title', DEFAULT_TITLE);
      setMeta('name', 'twitter:title', DEFAULT_TITLE);
      setMeta('name', 'description', DEFAULT_DESCRIPTION);
      setMeta('property', 'og:description', DEFAULT_SOCIAL_DESCRIPTION);
      setMeta('name', 'twitter:description', DEFAULT_SOCIAL_DESCRIPTION);
    };
  }, [title, description]);
}

/**
 * 現在のページの canonical と og:url を、配信されている実際のURL
 * （origin + パス。クエリ・ハッシュは含めない）に設定する。
 * ルーターの最上位で一度呼べば、全ページに適用される。
 */
export function useCanonicalUrl(pathname: string): void {
  useEffect(() => {
    // 末尾スラッシュ違いで別URL扱いにならないよう、ルート以外は末尾の/を除く
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
    const href = `${window.location.origin}${path}`;
    setCanonicalLink(href);
    setMeta('property', 'og:url', href);
  }, [pathname]);
}
