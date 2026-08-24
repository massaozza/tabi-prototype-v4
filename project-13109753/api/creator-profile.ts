// /api/creator-profile.ts
// Vercel Serverless Function（Edge Runtime）
// Creator Profileページ（/creator/{userId}）向けに、指定ユーザーの
// 公開プロフィール情報と、投稿実績のサマリーを返すAPI。
//
// 【重要】このファイルは自己完結型にしてある（api/内の他ファイルからimportしない）。
// Vercelのビルド環境では、api/配下のファイル同士でモジュールを共有すると
// 実行時に "Cannot find module" エラーになることがあるため。
//
// 参照するKVキー：
// - user:{uid}              → ユーザーレコード（公開情報だけを抜き出して返す）
// - user:{uid}:experiences  → そのユーザーが投稿したExperienceのID一覧（Set）
// - experience:{id}         → 各Experienceの中身（api/experiences.ts が保存）
//
// GET /api/creator-profile?uid=xxx

import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

interface UserRecord {
  uid: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: string;
}

interface ExperienceRecord {
  id: string;
  uid: string;
  area: string;
  category: string;
  createdAt: string;
}

function uniqueNonEmpty(values: (string | undefined | null)[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const trimmed = (v || '').trim();
    if (trimmed) set.add(trimmed);
  }
  return Array.from(set);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const uid = url.searchParams.get('uid');

  if (!uid) {
    return new Response(JSON.stringify({ error: 'uid query parameter is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const user = await kv.get<UserRecord>(`user:${uid}`);
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const experienceIds = (await kv.smembers(`user:${uid}:experiences`)) as
      | string[]
      | null;

    let experiences: ExperienceRecord[] = [];
    if (experienceIds && experienceIds.length > 0) {
      const values = await kv.mget<ExperienceRecord[]>(
        ...experienceIds.map((id) => `experiences:${id}`)
      );
      experiences = (values || []).filter(
        (v): v is ExperienceRecord => v !== null && v !== undefined
      );
    }

    const areas = uniqueNonEmpty(experiences.map((e) => e.area));
    const categories = uniqueNonEmpty(experiences.map((e) => e.category));

    return new Response(
      JSON.stringify({
        profile: {
          uid: user.uid,
          displayName: user.displayName,
          joinedAt: user.createdAt,
        },
        stats: {
          experienceCount: experiences.length,
          areaCount: areas.length,
          categoryCount: categories.length,
          areas,
          categories,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal error', detail: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
