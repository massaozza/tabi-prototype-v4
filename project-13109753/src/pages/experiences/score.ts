// src/pages/experiences/score.ts
// Experience Score の簡易ロジック（仮実装）。
//
// 事業計画書で挙げられている7要素のうち、現時点で計測できるのは以下4つのみ：
// - Detail（具体性）
// - Authenticity（信頼性・バランスの取れた内容か）
// - Freshness（新しさ）
// - Rarity（希少性）
//
// 残り3要素は、まだ計測の仕組み自体が存在しないため今回は含めない：
// - Helpfulness（他ユーザーの「役立った」評価）→ Helpful機能の実装待ち
// - AI Contribution（AIの回答に何回引用されたか）→ Contribution計測の実装待ち
// - Commerce Contribution（アフィリエイト収益への貢献）→ Affiliate Trackingの実装待ち
//
// そのため、現状の満点は100点ではなく85点。UI側では「Community & Impact
// （Coming soon）」として、未計測であることを正直に示す。
//
// このスコアはKVに保存せず、Experience一覧・詳細を表示する際にその場で
// クライアント側で計算する（頻繁に調整したい簡易ロジックのため、
// 保存済みの値を使い回すより、常に最新ロジックで再計算する方が都合が良い）。

import type { Experience } from './types';

export interface ExperienceScoreBreakdown {
  total: number;
  maxPossible: number;
  detail: number;
  maxDetail: number;
  authenticity: number;
  maxAuthenticity: number;
  freshness: number;
  maxFreshness: number;
  rarity: number;
  maxRarity: number;
}

const MAX_DETAIL = 30;
const MAX_AUTHENTICITY = 20;
const MAX_FRESHNESS = 20;
const MAX_RARITY = 15;
export const MAX_EXPERIENCE_SCORE = MAX_DETAIL + MAX_AUTHENTICITY + MAX_FRESHNESS + MAX_RARITY; // 85

function detailScore(exp: Experience): number {
  const textLength =
    (exp.whatWasGood || '').trim().length +
    (exp.whatWasHard || '').trim().length +
    (exp.tip || '').trim().length;
  // 目安：800文字前後で満点近くになるよう緩やかにスケーリング
  const textPoints = Math.min(20, Math.round((textLength / 800) * 20));
  const photoPoints = Math.min(10, (exp.photos?.length || 0) * 2);
  return Math.min(MAX_DETAIL, textPoints + photoPoints);
}

function authenticityScore(exp: Experience): number {
  let score = 0;
  // 良かった点・大変だった点の両方が書かれている＝一方的な宣伝ではない
  if ((exp.whatWasGood || '').trim() && (exp.whatWasHard || '').trim()) {
    score += 10;
  }
  if ((exp.tip || '').trim()) {
    score += 5;
  }
  if (exp.photos && exp.photos.length > 0) {
    score += 5;
  }
  return Math.min(MAX_AUTHENTICITY, score);
}

function freshnessScore(exp: Experience): number {
  if (!exp.visitedMonth) return 0;
  const parts = exp.visitedMonth.split('-');
  if (parts.length !== 2) return 0;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!year || !month) return 0;

  const visited = new Date(year, month - 1, 1);
  const now = new Date();
  const monthsAgo =
    (now.getFullYear() - visited.getFullYear()) * 12 + (now.getMonth() - visited.getMonth());

  if (monthsAgo <= 6) return 20;
  if (monthsAgo <= 12) return 15;
  if (monthsAgo <= 24) return 10;
  return 5;
}

function rarityScore(exp: Experience, allExperiences: Experience[]): number {
  const normalizedArea = (exp.area || '').trim().toLowerCase();
  const sameComboCount = allExperiences.filter(
    (e) => (e.area || '').trim().toLowerCase() === normalizedArea && e.category === exp.category
  ).length;

  // 自分自身を含めた件数で判定（1件＝自分だけ＝最も希少）
  if (sameComboCount <= 1) return 15;
  if (sameComboCount <= 5) return 10;
  return 5;
}

/**
 * 指定したExperienceのスコアを計算する。
 * rarity計算のために、同じサイト内の全Experience一覧が必要
 * （すでにページ側で取得済みのデータをそのまま渡せばよい）。
 */
export function computeExperienceScore(
  exp: Experience,
  allExperiences: Experience[]
): ExperienceScoreBreakdown {
  const detail = detailScore(exp);
  const authenticity = authenticityScore(exp);
  const freshness = freshnessScore(exp);
  const rarity = rarityScore(exp, allExperiences);

  return {
    total: detail + authenticity + freshness + rarity,
    maxPossible: MAX_EXPERIENCE_SCORE,
    detail,
    maxDetail: MAX_DETAIL,
    authenticity,
    maxAuthenticity: MAX_AUTHENTICITY,
    freshness,
    maxFreshness: MAX_FRESHNESS,
    rarity,
    maxRarity: MAX_RARITY,
  };
}
