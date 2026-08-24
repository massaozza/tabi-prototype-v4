// /api/affiliate-click.ts
// Vercel Serverless Function（Edge Runtime）
// 記事内のアフィリエイトCTAがクリックされたイベントを記録するAPI。
//
// 【重要】このファイルは自己完結型にしてある（api/内の他ファイルからimportしない）。
// Vercelのビルド環境では、api/配下のファイル同士でモジュールを共有すると
// 実行時に "Cannot find module" エラーになることがあるため。
//
// 【背景】実際のアフィリエイト登録（楽天トラベル、Booking.com等）はまだ
// 済んでいないため、CTAのリンク先自体はまだプレースホルダー（href="#"）の
// ままになっている。ただし、クリックの記録の仕組み自体は今のうちに
// 用意しておき、実際のリンクに差し替わった後、すぐ収益計算に使えるようにする。
//
// KVのキー設計：
// - affiliateEvent:{id} → 個別のクリックイベント（1レコード＝1キー方式。
//   Trip・Experienceと同じ考え方で、同時アクセスでもデータが失われない）
// - affiliateEvents:all → 全イベントIDの索引（Set）
//
// POST /api/affiliate-click
//   body: { source: 'article' | 'chat', context?: string, partnerName?: string, ctaLabel?: string }
//   認証不要（未ログインの訪問者のクリックも記録する。ログイン中なら
//   uidも記録する）

import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

interface SessionRecord {
  uid: string;
  createdAt: string;
}

interface AffiliateEvent {
  id: string;
  source: string;
  context?: string;
  partnerName?: string;
  ctaLabel?: string;
  uid?: string;
  createdAt: string;
}

const VALID_SOURCES = ['article', 'chat'] as const;

function getCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function getAuthenticatedUid(req: Request): Promise<string | null> {
  const token = getCookie(req, 'session');
  if (!token) return null;
  try {
    const session = await kv.get<SessionRecord>(`session:${token}`);
    return session?.uid ?? null;
  } catch {
    return null;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body: {
    source?: string;
    context?: string;
    partnerName?: string;
    ctaLabel?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const source = (body.source || '').trim();
  if (!VALID_SOURCES.includes(source as (typeof VALID_SOURCES)[number])) {
    return jsonResponse(
      { error: `source must be one of: ${VALID_SOURCES.join(', ')}` },
      400
    );
  }

  try {
    const uid = await getAuthenticatedUid(req);
    const id = crypto.randomUUID();

    const event: AffiliateEvent = {
      id,
      source,
      context: body.context?.trim() || undefined,
      partnerName: body.partnerName?.trim() || undefined,
      ctaLabel: body.ctaLabel?.trim() || undefined,
      uid: uid || undefined,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`affiliateEvent:${id}`, event);
    await kv.sadd('affiliateEvents:all', id);

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: 'Internal error', detail: String(err) }, 500);
  }
}
