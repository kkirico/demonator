import type { Answer, GameSession } from '../../session/session.types';
import type { WorkFeatureCache } from '../cache/work-feature.cache';

type MultiplierFn = (confidence: number) => number;

const MULTIPLIERS: Record<Answer, MultiplierFn> = {
  yes: (conf) => conf,
  probably: (conf) => conf * 0.8 + 0.1,
  maybe: () => 0.5,
  probably_not: (conf) => (1 - conf) * 0.8 + 0.1,
  no: (conf) => 1 - conf,
};

const MIN_FACTOR = 0.01;

export function updateScores(
  session: GameSession,
  featureId: number,
  answer: Answer,
  cache: WorkFeatureCache,
): void {
  const getMultiplier = MULTIPLIERS[answer];

  for (const [workId, currentScore] of session.workScores) {
    const conf = cache.getConfidence(workId, featureId);
    const factor = Math.max(getMultiplier(conf), MIN_FACTOR);
    session.workScores.set(workId, currentScore * factor);
  }

  normalize(session.workScores);
  session.askedFeatures.add(featureId);
  session.questionCount++;
}

function normalize(scores: Map<number, number>): void {
  let total = 0;
  for (const score of scores.values()) {
    total += score;
  }
  if (total === 0) return;
  for (const [id, score] of scores) {
    scores.set(id, score / total);
  }
}

export interface RankedWork {
  workId: number;
  score: number;
}

export function getTopCandidates(
  session: GameSession,
  limit: number,
  excludeIds?: Set<number>,
): RankedWork[] {
  const entries: RankedWork[] = [];
  for (const [workId, score] of session.workScores) {
    if (excludeIds?.has(workId)) continue;
    entries.push({ workId, score });
  }
  entries.sort((a, b) => b.score - a.score);
  return entries.slice(0, limit);
}
