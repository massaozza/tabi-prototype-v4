// api/_wikiContent.ts
//
// OSMタグに含まれる wikidata / wikipedia の値から、事実ベースの説明文と
// 写真（Wikimedia Commons）を取得し、訪日インバウンド旅行者向けにAIで
// 文章を整える。
//
// 【なぜAIで作文させず、この経路にしたか】
// TABI47の方針として、事実でない説明文をAIに生成させることは避けたい。
// そこでまず Wikipedia の要約（事実ベース）を取得し、AIには
// 「その事実を元に、訪日旅行者向けに読みやすく整える」という
// 翻訳・リライトの役割だけを担わせる。新しい事実を作らせない。
//
// 【スコープ】
// Wikidata/Wikipediaが無い候補（ローカルな施設等）はこの経路では
// 埋まらない。その場合は description/image を空のままにし、
// 無理に埋めない（事実の裏付けがないものを作文させない）。

export interface WikiContent {
  description: string;
  descriptionSourceUrl: string;
  image?: {
    url: string;
    author?: string;
    license?: string;
    licenseUrl?: string;
    sourceUrl: string;
  };
}

interface ParsedWikiTags {
  wikidataId?: string;
  wikipediaLang?: string;
  wikipediaTitle?: string;
}

/** OSMタグから wikidata QID / wikipedia (lang:title) を取り出す */
export function parseWikiTags(tags: Record<string, string>): ParsedWikiTags {
  const wikidataId = tags.wikidata || undefined;

  // 「wikipedia=ja:東京タワー」のような "lang:title" 形式が基本だが、
  // 稀に lang 無しでタイトルだけのこともある。
  const raw = tags.wikipedia || tags['wikipedia:en'] || tags['wikipedia:ja'];
  let wikipediaLang: string | undefined;
  let wikipediaTitle: string | undefined;

  if (tags['wikipedia:en']) {
    wikipediaLang = 'en';
    wikipediaTitle = tags['wikipedia:en'];
  } else if (raw) {
    const m = raw.match(/^([a-z-]{2,})\s*:\s*(.+)$/);
    if (m) {
      wikipediaLang = m[1];
      wikipediaTitle = m[2];
    } else {
      wikipediaLang = 'ja';
      wikipediaTitle = raw;
    }
  } else if (tags['wikipedia:ja']) {
    wikipediaLang = 'ja';
    wikipediaTitle = tags['wikipedia:ja'];
  }

  return { wikidataId, wikipediaLang, wikipediaTitle };
}

/** Wikidataエンティティから、英語版Wikipediaのタイトル（無ければ日本語版）を引く */
async function resolveWikipediaFromWikidata(
  wikidataId: string
): Promise<{ lang: string; title: string } | null> {
  try {
    const res = await fetch(
      `https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`,
      { headers: { 'User-Agent': 'TABI47/1.0 (https://www.tabi47.com; content enrichment)' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const entity = data?.entities?.[wikidataId];
    const sitelinks = entity?.sitelinks || {};
    if (sitelinks.enwiki?.title) return { lang: 'en', title: sitelinks.enwiki.title };
    if (sitelinks.jawiki?.title) return { lang: 'ja', title: sitelinks.jawiki.title };
    return null;
  } catch {
    return null;
  }
}

/** WikidataエンティティのP18（画像）から Commonsのファイル名を引く */
async function resolveCommonsFileFromWikidata(wikidataId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`,
      { headers: { 'User-Agent': 'TABI47/1.0 (https://www.tabi47.com; content enrichment)' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const entity = data?.entities?.[wikidataId];
    const claim = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    return typeof claim === 'string' ? claim : null;
  } catch {
    return null;
  }
}

/** Wikipediaの要約（イントロ部分のプレーンテキスト）を取得する */
async function fetchWikipediaExtract(lang: string, title: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { 'User-Agent': 'TABI47/1.0 (https://www.tabi47.com; content enrichment)' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const extract = typeof data?.extract === 'string' ? data.extract : null;
    return extract && extract.length > 20 ? extract : null;
  } catch {
    return null;
  }
}

/** Commonsのファイル情報（撮影者・ライセンス・直リンク）を取得する */
async function fetchCommonsImageInfo(filename: string): Promise<WikiContent['image'] | null> {
  try {
    const title = `File:${filename}`;
    const res = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(
        title
      )}&prop=imageinfo&iiprop=url|extmetadata&format=json&origin=*`,
      { headers: { 'User-Agent': 'TABI47/1.0 (https://www.tabi47.com; content enrichment)' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages || {};
    const page = Object.values(pages)[0] as Record<string, unknown> | undefined;
    const info = (page?.imageinfo as Array<Record<string, unknown>> | undefined)?.[0];
    if (!info) return null;

    const url = String(info.url || '');
    if (!url) return null;

    const meta = (info.extmetadata as Record<string, { value?: string }> | undefined) || {};
    // Artistフィールドには稀にHTMLタグが混じるので、簡易的に除去する
    const stripHtml = (s: string | undefined) => (s ? s.replace(/<[^>]+>/g, '').trim() : undefined);

    return {
      url,
      author: stripHtml(meta.Artist?.value),
      license: meta.LicenseShortName?.value,
      licenseUrl: meta.LicenseUrl?.value,
      sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
    };
  } catch {
    return null;
  }
}

/**
 * Wikipediaの要約（事実ベース）を、訪日インバウンド旅行者向けの
 * 説明文にAIで整える。新しい事実は付け加えさせない。
 */
async function rewriteForInboundTourists(
  spotName: string,
  extract: string,
  apiKey: string
): Promise<string | null> {
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const prompt = `You are writing a short destination description for an English-language travel website aimed at inbound tourists visiting Japan.

Source (factual, from Wikipedia, about "${spotName}"):
"""
${extract}
"""

Rewrite this into a concise, engaging 2-3 paragraph description for travelers. Rules:
- Do NOT invent facts that are not in the source text above.
- Keep it factually accurate; you may simplify or reorder for readability.
- Write in a warm, inviting tone suitable for a travel guide.
- Do not include citation markers, brackets, or references.
- Return ONLY the description text, no markdown, no headings, no preamble.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 768,
          },
        }),
      }
    );
    if (!res.ok) {
      console.error('[_wikiContent] Gemini error:', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === 'string' && text.trim().length > 0 ? text.trim() : null;
  } catch (e) {
    console.error('[_wikiContent] Gemini call failed:', e);
    return null;
  }
}

/**
 * OSMタグからWikidata/Wikipediaの内容を取得し、インバウンド向けに
 * 整形した説明文と、Commonsの画像（出典付き）を返す。
 * 取得・生成できなければ null（呼び出し側はdescription/imageを
 * 空のままにする＝無理に埋めない）。
 */
export async function buildWikiContent(
  spotName: string,
  tags: Record<string, string>
): Promise<WikiContent | null> {
  const { wikidataId, wikipediaLang, wikipediaTitle } = parseWikiTags(tags);

  // Wikipedia記事の特定：タグに直接あればそれを使い、無ければ
  // WikidataのSitelinksから引く
  let lang = wikipediaLang;
  let title = wikipediaTitle;
  if ((!lang || !title) && wikidataId) {
    const resolved = await resolveWikipediaFromWikidata(wikidataId);
    if (resolved) {
      lang = resolved.lang;
      title = resolved.title;
    }
  }

  let description: string | null = null;
  let descriptionSourceUrl = '';
  if (lang && title) {
    const extract = await fetchWikipediaExtract(lang, title);
    if (extract) {
      const apiKey = process.env.GEMINI_API_KEY;
      // 【重要】AIによる整形は必須。Wikipediaの原文をそのまま載せることは
      // しない（文体・引用形式がそのまま公開向けの文章として不適切なため）。
      // 整形に失敗した場合は description を空のままにする
      // （原文にフォールバックしない）。
      description = apiKey ? await rewriteForInboundTourists(spotName, extract, apiKey) : null;
      if (description) {
        descriptionSourceUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`;
      }
    }
  }

  if (!description) return null;

  let image: WikiContent['image'] | undefined;
  if (wikidataId) {
    const filename = await resolveCommonsFileFromWikidata(wikidataId);
    if (filename) {
      const info = await fetchCommonsImageInfo(filename);
      if (info) image = info;
    }
  }

  return { description, descriptionSourceUrl, image };
}
