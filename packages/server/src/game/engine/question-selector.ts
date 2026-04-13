import type { GameSession } from '../../session/session.types';
import type { WorkFeatureCache, CachedFeature } from '../cache/work-feature.cache';
import type { RankedWork } from './score-updater';

const CATEGORY_PRIORITY: Record<string, number> = {
  genre: 1.0,
  setting: 0.95,
  protagonist: 0.9,
  tone: 0.85,
  character: 0.8,
  theme: 0.75,
};

export interface ScoredFeature {
  feature: CachedFeature;
  splitScore: number;
}

const TOP_K = 5;
const TIE_RATIO = 0.15;

/**
 * Selects the next question by scoring every unused feature on how evenly
 * it splits the candidate set (information gain), then randomly picking
 * from the top-K scorers so the game doesn't always follow the same path.
 */
export function selectNextQuestion(
  session: GameSession,
  cache: WorkFeatureCache,
): CachedFeature | null {
  const allFeatures = cache.getAllFeatures();
  const candidates = allFeatures.filter(
    (f) => !session.askedFeatures.has(f.id),
  );

  if (candidates.length === 0) return null;

  const scored: ScoredFeature[] = [];

  for (const feature of candidates) {
    let yesWeight = 0;
    let noWeight = 0;

    for (const [workId, score] of session.workScores) {
      if (score < 1e-10) continue;
      const conf = cache.getConfidence(workId, feature.id);
      yesWeight += score * conf;
      noWeight += score * (1 - conf);
    }

    const total = yesWeight + noWeight;
    if (total === 0) continue;

    const splitScore = 1 - Math.abs(yesWeight - noWeight) / total;
    const categoryBonus = CATEGORY_PRIORITY[feature.category] ?? 0.5;
    const finalScore = splitScore + categoryBonus * 0.01;

    scored.push({ feature, splitScore: finalScore });
  }

  if (scored.length === 0) return null;

  scored.sort((a, b) => b.splitScore - a.splitScore);
  const pool = scored.slice(0, Math.min(TOP_K, scored.length));
  return pool[Math.floor(Math.random() * pool.length)].feature;
}

/**
 * Detects tied top candidates whose scores are within TIE_RATIO of the leader.
 * Returns the tied work IDs, or null if no meaningful tie.
 */
export function detectTiedCandidates(
  topCandidates: RankedWork[],
): number[] | null {
  if (topCandidates.length < 2) return null;

  const leader = topCandidates[0].score;
  if (leader < 1e-10) return null;

  const tied = topCandidates.filter(
    (c) => (leader - c.score) / leader <= TIE_RATIO,
  );

  return tied.length >= 2 ? tied.map((c) => c.workId) : null;
}

/**
 * Picks the feature that best differentiates the tied candidates.
 * Scores each feature by max confidence spread among the tied works.
 */
export function selectTiebreakerQuestion(
  session: GameSession,
  cache: WorkFeatureCache,
  tiedWorkIds: number[],
): CachedFeature | null {
  const allFeatures = cache.getAllFeatures();
  const candidates = allFeatures.filter(
    (f) => !session.askedFeatures.has(f.id),
  );

  if (candidates.length === 0) return null;

  let bestFeature: CachedFeature | null = null;
  let bestSpread = -1;

  for (const feature of candidates) {
    const confs = tiedWorkIds.map((wId) =>
      cache.getConfidence(wId, feature.id),
    );
    const spread = Math.max(...confs) - Math.min(...confs);

    if (spread > bestSpread) {
      bestSpread = spread;
      bestFeature = feature;
    }
  }

  return bestFeature;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const QUESTION_TEMPLATES: Record<string, string> = {
  genre: '이 작품은 {name} 장르인가요?',
  setting: '배경이 {name}인가요?',
  protagonist: '주인공이 {name} 유형인가요?',
  character: '등장인물 중에 {name} 캐릭터가 있나요?',
  tone: '작품의 분위기가 {name}인가요?',
  theme: '작품에 {name} 테마가 있나요?',
};

export function buildQuestionText(feature: CachedFeature): string {
  if (feature.questions.length > 0) {
    return pickRandom(feature.questions);
  }
  const template =
    QUESTION_TEMPLATES[feature.category] ?? '이 작품에 {name} 특징이 있나요?';
  return template.replace('{name}', feature.displayName);
}
