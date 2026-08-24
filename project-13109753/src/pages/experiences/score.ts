// src/pages/experiences/score.ts
// Experience Score の簡易ロジック（仮実装）。
//
// 事業計画書で挙げられている7要素のうち、現時点で計測できるのは以下6つ：
// - Detail（具体性）
// - Authenticity（信頼性・バランスの取れた内容か）
// - Freshness（新しさ）
// - Rarity（希少性）
// - Helpfulness（他ユーザーの「役立った」評価）
// - AI Contribution（AIの回答に何回引用されたか）
//
// 残り1要素は、まだ計測の仕組み自体が存在しないため今回は含めない：
// - Commerce Contribution（アフィリエイト収益への貢献）→ 実際のアフィリエイト
//   収益・予約実績と結びつけて初めて意味を持つ指標のため、クリック計測を
//   始めた段階の今はまだ算出しない。
//
// Helpfulness・AI Contributionは、KVに保存された実際の集計値（呼び出し側が
// api/experience-helpful.ts から取得して渡す）を使う。渡されなかった場合は
// 0点として扱う（一覧ページ等、集計値をまだ取得していない場面でも
// エラーにならないようにするため）。
//
// このスコア自体はKVに保存せず、Experience一覧・詳細を表示する際にその場で
// クライアント側で計算する（頻繁に調整したい簡易ロジックのため、
// 保存済みの値を使い回すより、常に最新ロジックで再計算する方が都合が良い）。

import type { Experience } from './types';

export interface ExperienceEngagementStats {
  helpfulCount?: number;
  citationCount?: number;
}

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
  helpfulness: number;
  maxHelpfulness: number;
  aiContribution: number;
  maxAiContribution: number;
}

const MAX_DETAIL = 30;
const MAX_AUTHENTICITY = 20;
const MAX_FRESHNESS = 20;
const MAX_RARITY = 15;
const MAX_HELPFULNESS = 10;
const MAX_AI_CONTRIBUTION = 5;
export const MAX_EXPERIENCE_SCORE =
  MAX_DETAIL + MAX_AUTHENTICITY + MAX_FRESHNESS + MAX_RARITY + MAX_HELPFULNESS + MAX_AI_CONTRIBUTION; // 100

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

function helpfulnessScore(helpfulCount: number): number {
  // 5件の「役立った」で満点（1件あたり2点、上限あり）
  return Math.min(MAX_HELPFULNESS, helpfulCount * 2);
}

function aiContributionScore(citationCount: number): number {
  // 5回AIに引用されたら満点（1回あたり1点、上限あり）
  return Math.min(MAX_AI_CONTRIBUTION, citationCount);
}

/**
 * 指定したExperienceのスコアを計算する。
 * rarity計算のために、同じサイト内の全Experience一覧が必要
 * （すでにページ側で取得済みのデータをそのまま渡せばよい）。
 * engagement（helpfulCount / citationCount）は、取得済みであれば渡す。
 * 未取得の場合は0点として扱う。
 */
export function computeExperienceScore(
  exp: Experience,
  allExperiences: Experience[],
  engagement: ExperienceEngagementStats = {}
): ExperienceScoreBreakdown {
  const detail = detailScore(exp);
  const authenticity = authenticityScore(exp);
  const freshness = freshnessScore(exp);
  const rarity = rarityScore(exp, allExperiences);
  const helpfulness = helpfulnessScore(engagement.helpfulCount || 0);
  const aiContribution = aiContributionScore(engagement.citationCount || 0);

  return {
    total: detail + authenticity + freshness + rarity + helpfulness + aiContribution,
    maxPossible: MAX_EXPERIENCE_SCORE,
    detail,
    maxDetail: MAX_DETAIL,
    authenticity,
    maxAuthenticity: MAX_AUTHENTICITY,
    freshness,
    maxFreshness: MAX_FRESHNESS,
    rarity,
    maxRarity: MAX_RARITY,
    helpfulness,
    maxHelpfulness: MAX_HELPFULNESS,
    aiContribution,
    maxAiContribution: MAX_AI_CONTRIBUTION,
  };
}
