// src/lib/sanitizeHtml.ts
//
// 記事本文など、HTMLとして描画する文字列を安全にするための処理。
//
// 【なぜ必要か】
// 記事の段落は装飾（太字・リンク等）を許すためHTMLのまま
// dangerouslySetInnerHTML に渡している。ここが無防備だと、
// 保存されたHTMLに <script> や onerror 属性を混ぜることで、
// 閲覧者全員のブラウザで任意のスクリプトを実行できてしまう（保存型XSS）。
//
// 【方針】
// 自作の正規表現によるフィルタは抜け道が多いため使わない。
// 実績のある DOMPurify に、記事本文に必要な最小限のタグだけを許可させる。

import DOMPurify from 'dompurify';

/** 記事本文で許可するタグ。装飾とリンク、簡単なリストのみ */
const ALLOWED_TAGS = [
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'br',
  'span',
  'a',
  'code',
  'sup',
  'sub',
  'ul',
  'ol',
  'li',
];

/** 許可する属性。styleやonXXXは一切通さない */
const ALLOWED_ATTR = ['href', 'title', 'target', 'rel'];

let hooked = false;

function ensureHooks(): void {
  if (hooked) return;
  hooked = true;

  // 外部リンクは新しいタブで開き、参照元を渡さない
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node instanceof Element && node.tagName === 'A') {
      const href = node.getAttribute('href') || '';
      // javascript: や data: のスキームは通さない
      if (/^\s*(javascript|data|vbscript):/i.test(href)) {
        node.removeAttribute('href');
        return;
      }
      if (/^https?:\/\//i.test(href)) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer nofollow');
      }
    }
  });
}

/**
 * 記事本文用のHTMLをサニタイズする。
 * サーバー側（DOMが無い環境）で呼ばれた場合はタグを全て落とす。
 */
export function sanitizeArticleHtml(html: string | undefined | null): string {
  if (!html) return '';
  if (typeof window === 'undefined') {
    // SSRやテスト環境ではDOMが無いため、安全側に倒してタグを除去する
    return html.replace(/<[^>]*>/g, '');
  }

  ensureHooks();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // <iframe>や<object>等の埋め込みは一切許可しない
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['style', 'srcset'],
    ALLOW_DATA_ATTR: false,
  });
}
