// /api/experience-helpful.ts
// Vercel Serverless Function（Edge Runtime）
// Experienceに対する「役立った（Helpful）」の記録・集計、および
// AIチャットでの引用回数（Contribution）の取得をまとめて扱うAPI。
//
// 【重要】このファイルは自己完結型にしてある（api/内の他ファイルからimportしない）。
// Vercelのビルド環境では、api/配下のファイル同士でモジュールを共有すると
// 実行時に "Cannot find module" エラーになることがあるため。
//
// KVのキー設計：
// - experience:{id}:helpful   → そのExperienceに「役立った」を押したuidのSet
//   （Setなので、1ユーザーにつき1回しかカウントされない。すでに押している
//   場合は取り消し＝トグル動作）
// - experience:{id}:citations → AIチャットの回答でこのExperienceが引用された
//   回数（整数カウンター）。書き込みはapi/chat.ts側で行う。このAPIでは
//   読み取りのみ。
//
// GET  /api/experience-helpful?ids=id1,id2,id3
//   → 指定した複数Experienceの、Helpful件数・自分が押したか・AI引用回数を
//     まとめて返す（一覧ページ等でN+1リクエストにならないよう、複数idを
//     まとめて処理する）
// POST /api/experience-helpful { experienceId }
//   → ログイン中のユーザーの「役立った」をトグル（要認証）

import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

interface SessionRecord {
  uid: string;
  createdAt: string;
}

function helpfulKey(id: string): string {
  return `experience:${id}:helpful`;
}

function citationsKey(id: string): string {
  return `experience:${id}:citations`;
}

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
  // ── GET: 複数Experienceの件数・自分が押したか・AI引用回数をまとめて取得 ──
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const idsParam = url.searchParams.get('ids') || '';
    const ids = idsParam
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (ids.length === 0) {
      return jsonResponse({ stats: {} });
    }

    const uid = await getAuthenticatedUid(req);

    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          const [members, citationCount] = await Promise.all([
            kv.smembers(helpfulKey(id)) as Promise<string[] | null>,
            kv.get<number>(citationsKey(id)),
          ]);
          const helpfulCount = members?.length || 0;
          const helpfulByMe = !!uid && !!members?.includes(uid);
          return [
            id,
            { helpfulCount, helpfulByMe, citationCount: citationCount || 0 },
          ] as const;
        })
      );

      const stats: Record
        string,
        { helpfulCount: number; helpfulByMe: boolean; citationCount: number }
      > = {};
      for (const [id, value] of results) {
        stats[id] = value;
      }

      return jsonResponse({ stats });
    } catch (err) {
      return jsonResponse({ error: 'Internal error', detail: String(err) }, 500);
    }
  }

  // ── POST: 自分の「役立った」をトグル ──
  if (req.method === 'POST') {
    const uid = await getAuthenticatedUid(req);
    if (!uid) {
      return jsonResponse({ error: 'You must be logged in to mark this as helpful' }, 401);
    }

    let body: { experienceId?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const experienceId = (body.experienceId || '').trim();
    if (!experienceId) {
      return jsonResponse({ error: 'experienceId is required' }, 400);
    }

    try {
      const key = helpfulKey(experienceId);
      const members = (await kv.smembers(key)) as string[] | null;
      const alreadyMarked = !!members?.includes(uid);

      if (alreadyMarked) {
        await kv.srem(key, uid);
      } else {
        await kv.sadd(key, uid);
      }

      const updatedMembers = (await kv.smembers(key)) as string[] | null;

      return jsonResponse({
        helpfulCount: updatedMembers?.length || 0,
        helpfulByMe: !alreadyMarked,
      });
    } catch (err) {
      return jsonResponse({ error: 'Internal error', detail: String(err) }, 500);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
