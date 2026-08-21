// /api/experiences.ts
// Vercel Serverless Function（Node.js Runtime）
// 旅行者のリアルな体験（Experience）の投稿・一覧取得・削除を扱うAPI。
//
// 【重要】このVercelプロジェクトのNode.js Runtimeでは、api/配下の別ファイル
// （_auth.ts, _store.ts等）をimportすると、実行時に "Cannot find module" で
// 落ちることが判明した（Edge Runtimeでは問題なく動く）。そのため、
// このファイルは共通ヘルパーに頼らず、必要なロジックを全て自己完結させている。
//
// 事業計画書の構造化データ（WHO/WHERE/WHEN/CONTEXT/EXPERIENCE/EVIDENCE）を
// 反映したデータ構造。まずはAIとの会話ではなく、通常のフォーム入力で作成する。
//
// 保存方式：「1レコード＝1キー」＋RedisのSet型（sadd/smembers/srem）による索引。
// 配列を丸ごと上書きする方式（localsPlaces等）とは異なり、同時投稿でも
// データが失われない。
//
// GET  /api/experiences            → 公開されている全Experienceを取得（認証不要）
// GET  /api/experiences?mine=1     → 自分が投稿したExperienceだけを取得（認証必須）
// POST /api/experiences            → 新規投稿（認証必須）
// DELETE /api/experiences?id=xxx   → 削除（認証必須、本人の投稿のみ）

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import crypto from 'crypto';

const COLLECTION = 'experiences';

const TRAVEL_STYLES = ['Solo', 'Couple', 'Family with kids', 'Friends', 'Business'] as const;
const BUDGET_LEVELS = ['Budget', 'Mid-range', 'Luxury'] as const;

export interface Experience {
  id: string;
  uid: string;
  authorName: string;
  createdAt: string;

  // WHERE
  placeName: string;
  area: string;
  category: string;

  // WHEN
  visitedMonth: string; // "2026-07" 形式

  // WHO / CONTEXT
  travelStyle: string;
  companions?: string;
  budgetLevel?: string;

  // EXPERIENCE
  whatWasGood: string;
  whatWasHard?: string;
  tip?: string;
  wouldRecommend: boolean;

  // EVIDENCE
  photos: string[];
}

interface SessionRecord {
  uid: string;
  createdAt: string;
}

// ── 認証ヘルパー（自己完結） ──

function getCookie(req: VercelRequest, name: string): string | null {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function getAuthenticatedUid(req: VercelRequest): Promise<string | null> {
  const token = getCookie(req, 'session');
  if (!token) return null;
  try {
    const session = await kv.get<SessionRecord>(`session:${token}`);
    return session?.uid ?? null;
  } catch {
    return null;
  }
}

// ── 保存用ヘルパー（自己完結、1レコード＝1キー方式） ──

function recordKey(id: string): string {
  return `${COLLECTION}:${id}`;
}

function collectionIndexKey(): string {
  return `${COLLECTION}:all`;
}

function userIndexKey(uid: string): string {
  return `user:${uid}:${COLLECTION}`;
}

async function createExperienceRecord(id: string, data: Experience, uid: string): Promise<void> {
  await kv.set(recordKey(id), data);
  await kv.sadd(collectionIndexKey(), id);
  await kv.sadd(userIndexKey(uid), id);
}

async function getExperienceRecord(id: string): Promise<Experience | null> {
  const value = await kv.get<Experience>(recordKey(id));
  return value ?? null;
}

async function deleteExperienceRecord(id: string, uid: string): Promise<void> {
  await kv.del(recordKey(id));
  await kv.srem(collectionIndexKey(), id);
  await kv.srem(userIndexKey(uid), id);
}

async function listAllExperiences(): Promise<Experience[]> {
  const ids = await kv.smembers(collectionIndexKey());
  if (!ids || ids.length === 0) return [];
  const values = await kv.mget<Experience[]>(...ids.map((id) => recordKey(id)));
  return (values || []).filter((v): v is Experience => v !== null && v !== undefined);
}

async function listUserExperiences(uid: string): Promise<Experience[]> {
  const ids = await kv.smembers(userIndexKey(uid));
  if (!ids || ids.length === 0) return [];
  const values = await kv.mget<Experience[]>(...ids.map((id) => recordKey(id)));
  return (values || []).filter((v): v is Experience => v !== null && v !== undefined);
}

function isValidMonthFormat(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // ── GET: 一覧取得 ──
  if (req.method === 'GET') {
    const mine = req.query.mine === '1' || req.query.mine === 'true';

    if (mine) {
      const uid = await getAuthenticatedUid(req);
      if (!uid) {
        res.status(401).json({ error: 'You must be logged in to view your experiences' });
        return;
      }
      const experiences = await listUserExperiences(uid);
      res.status(200).json({ experiences });
      return;
    }

    const experiences = await listAllExperiences();
    res.status(200).json({ experiences });
    return;
  }

  // ── POST: 新規投稿 ──
  if (req.method === 'POST') {
    const uid = await getAuthenticatedUid(req);
    if (!uid) {
      res.status(401).json({ error: 'You must be logged in to post an experience' });
      return;
    }

    const body: Partial<Experience> = req.body || {};

    const placeName = (body.placeName || '').trim();
    const area = (body.area || '').trim();
    const category = (body.category || '').trim();
    const visitedMonth = (body.visitedMonth || '').trim();
    const travelStyle = (body.travelStyle || '').trim();
    const whatWasGood = (body.whatWasGood || '').trim();
    const authorName = (body.authorName || '').trim() || 'Anonymous traveler';
    const photos = Array.isArray(body.photos)
      ? body.photos.filter((p): p is string => typeof p === 'string')
      : [];

    if (!placeName) {
      res.status(400).json({ error: 'placeName is required' });
      return;
    }
    if (!category) {
      res.status(400).json({ error: 'category is required' });
      return;
    }
    if (!isValidMonthFormat(visitedMonth)) {
      res.status(400).json({ error: 'visitedMonth must be in "YYYY-MM" format' });
      return;
    }
    if (!TRAVEL_STYLES.includes(travelStyle as (typeof TRAVEL_STYLES)[number])) {
      res.status(400).json({
        error: `travelStyle must be one of: ${TRAVEL_STYLES.join(', ')}`,
      });
      return;
    }
    if (
      body.budgetLevel &&
      !BUDGET_LEVELS.includes(body.budgetLevel as (typeof BUDGET_LEVELS)[number])
    ) {
      res.status(400).json({
        error: `budgetLevel must be one of: ${BUDGET_LEVELS.join(', ')}`,
      });
      return;
    }
    if (!whatWasGood) {
      res.status(400).json({ error: 'whatWasGood is required' });
      return;
    }
    if (
      whatWasGood.length > 2000 ||
      (body.whatWasHard || '').length > 2000 ||
      (body.tip || '').length > 2000
    ) {
      res.status(400).json({ error: 'Text fields must be 2000 characters or fewer' });
      return;
    }
    if (photos.length > 10) {
      res.status(400).json({ error: 'A maximum of 10 photos is allowed per experience' });
      return;
    }

    const id = crypto.randomUUID();
    const experience: Experience = {
      id,
      uid,
      authorName,
      createdAt: new Date().toISOString(),
      placeName,
      area,
      category,
      visitedMonth,
      travelStyle,
      companions: body.companions?.trim() || undefined,
      budgetLevel: body.budgetLevel,
      whatWasGood,
      whatWasHard: body.whatWasHard?.trim() || undefined,
      tip: body.tip?.trim() || undefined,
      wouldRecommend: body.wouldRecommend !== false,
      photos,
    };

    try {
      await createExperienceRecord(id, experience, uid);
      res.status(200).json({ success: true, experience });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save experience', detail: String(err) });
    }
    return;
  }

  // ── DELETE: 削除（本人のみ） ──
  if (req.method === 'DELETE') {
    const uid = await getAuthenticatedUid(req);
    if (!uid) {
      res.status(401).json({ error: 'You must be logged in to delete an experience' });
      return;
    }

    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }

    try {
      const existing = await getExperienceRecord(id);
      if (!existing) {
        res.status(404).json({ error: 'Experience not found' });
        return;
      }
      if (existing.uid !== uid) {
        res.status(403).json({ error: 'You can only delete your own experiences' });
        return;
      }

      await deleteExperienceRecord(id, uid);
      res.status(200).json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete experience', detail: String(err) });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
