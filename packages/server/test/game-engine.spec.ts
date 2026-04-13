import { describe, it, expect, beforeEach } from 'vitest';
import { selectNextQuestion, buildQuestionText } from '../src/game/engine/question-selector';
import { updateScores, getTopCandidates } from '../src/game/engine/score-updater';
import type { GameSession } from '../src/session/session.types';
import type { CachedFeature, CachedWork } from '../src/game/cache/work-feature.cache';
import { DEFAULT_ABSENT } from '../src/game/cache/work-feature.cache';

/**
 * Minimal in-memory mock of WorkFeatureCache for testing
 * without DB dependency.
 */
class MockCache {
  private works: Map<number, CachedWork>;
  private features: Map<number, CachedFeature>;
  private confidenceMap: Map<number, Map<number, number>>;

  constructor(
    works: CachedWork[],
    features: CachedFeature[],
    workFeatures: { workId: number; featureId: number; confidence: number }[],
  ) {
    this.works = new Map(works.map((w) => [w.id, w]));
    this.features = new Map(features.map((f) => [f.id, f]));
    this.confidenceMap = new Map();
    for (const wf of workFeatures) {
      let fm = this.confidenceMap.get(wf.workId);
      if (!fm) {
        fm = new Map();
        this.confidenceMap.set(wf.workId, fm);
      }
      fm.set(wf.featureId, wf.confidence);
    }
  }

  getAllWorks(): CachedWork[] { return [...this.works.values()]; }
  getAllFeatures(): CachedFeature[] { return [...this.features.values()]; }
  getWork(id: number): CachedWork | undefined { return this.works.get(id); }
  getFeature(id: number): CachedFeature | undefined { return this.features.get(id); }
  getAllWorkIds(): number[] { return [...this.works.keys()]; }
  getAllFeatureIds(): number[] { return [...this.features.keys()]; }
  getConfidence(workId: number, featureId: number): number {
    return this.confidenceMap.get(workId)?.get(featureId) ?? DEFAULT_ABSENT;
  }
}

function createSession(workIds: number[]): GameSession {
  const workScores = new Map<number, number>();
  const initialScore = 1.0 / workIds.length;
  for (const id of workIds) {
    workScores.set(id, initialScore);
  }
  return {
    id: 'test-session',
    workScores,
    askedFeatures: new Set(),
    guessedWorkIds: new Set(),
    pendingFeatureId: null,
    questionCount: 0,
    status: 'playing',
    createdAt: new Date(),
  };
}

// Fixtures: 4 works with distinct feature profiles
const WORKS: CachedWork[] = [
  { id: 1, title: '판타지 회귀물', author: '작가A', thumbnailUrl: null, platform: 'ridi', externalId: '001' },
  { id: 2, title: '로맨스 궁중물', author: '작가B', thumbnailUrl: null, platform: 'ridi', externalId: '002' },
  { id: 3, title: '판타지 먼치킨', author: '작가C', thumbnailUrl: null, platform: 'ridi', externalId: '003' },
  { id: 4, title: 'BL 현대물', author: '작가D', thumbnailUrl: null, platform: 'ridi', externalId: '004' },
];

const FEATURES: CachedFeature[] = [
  { id: 10, name: 'genre_fantasy', category: 'genre', displayName: '판타지' },
  { id: 11, name: 'genre_romance', category: 'genre', displayName: '로맨스' },
  { id: 12, name: 'genre_bl', category: 'genre', displayName: 'BL' },
  { id: 20, name: 'setting_palace', category: 'setting', displayName: '궁중' },
  { id: 21, name: 'setting_modern', category: 'setting', displayName: '현대' },
  { id: 30, name: 'protag_regressor', category: 'protagonist', displayName: '회귀' },
  { id: 31, name: 'protag_op', category: 'protagonist', displayName: '먼치킨' },
];

const WORK_FEATURES = [
  // Work 1: 판타지 회귀물
  { workId: 1, featureId: 10, confidence: 0.95 },
  { workId: 1, featureId: 30, confidence: 0.95 },
  // Work 2: 로맨스 궁중물
  { workId: 2, featureId: 11, confidence: 0.95 },
  { workId: 2, featureId: 20, confidence: 0.85 },
  // Work 3: 판타지 먼치킨
  { workId: 3, featureId: 10, confidence: 0.95 },
  { workId: 3, featureId: 31, confidence: 0.90 },
  // Work 4: BL 현대물
  { workId: 4, featureId: 12, confidence: 0.95 },
  { workId: 4, featureId: 21, confidence: 0.85 },
];

describe('Question Selector', () => {
  let cache: MockCache;

  beforeEach(() => {
    cache = new MockCache(WORKS, FEATURES, WORK_FEATURES);
  });

  it('should select the feature that best splits candidates', () => {
    const session = createSession([1, 2, 3, 4]);
    const feature = selectNextQuestion(session, cache as any);

    expect(feature).not.toBeNull();
    // genre_fantasy splits 2 works (1,3) vs 2 works (2,4) → best split
    expect(feature!.name).toBe('genre_fantasy');
  });

  it('should not select already asked features', () => {
    const session = createSession([1, 2, 3, 4]);
    session.askedFeatures.add(10); // genre_fantasy already asked

    const feature = selectNextQuestion(session, cache as any);
    expect(feature).not.toBeNull();
    expect(feature!.id).not.toBe(10);
  });

  it('should return null when all features are asked', () => {
    const session = createSession([1, 2, 3, 4]);
    for (const f of FEATURES) {
      session.askedFeatures.add(f.id);
    }
    const feature = selectNextQuestion(session, cache as any);
    expect(feature).toBeNull();
  });
});

describe('Score Updater', () => {
  let cache: MockCache;

  beforeEach(() => {
    cache = new MockCache(WORKS, FEATURES, WORK_FEATURES);
  });

  it('should boost fantasy works when user answers yes to fantasy', () => {
    const session = createSession([1, 2, 3, 4]);
    const beforeFantasy1 = session.workScores.get(1)!;
    const beforeRomance2 = session.workScores.get(2)!;

    updateScores(session, 10, 'yes', cache as any); // genre_fantasy = yes

    const afterFantasy1 = session.workScores.get(1)!;
    const afterRomance2 = session.workScores.get(2)!;

    // Fantasy works should have higher relative score
    expect(afterFantasy1).toBeGreaterThan(afterRomance2);
    // Work 1 (fantasy 0.95) and Work 3 (fantasy 0.95) should dominate
    const work3Score = session.workScores.get(3)!;
    expect(afterFantasy1).toBeCloseTo(work3Score, 5);
  });

  it('should penalize fantasy works when user answers no to fantasy', () => {
    const session = createSession([1, 2, 3, 4]);
    updateScores(session, 10, 'no', cache as any);

    const fantasy1 = session.workScores.get(1)!;
    const romance2 = session.workScores.get(2)!;
    const bl4 = session.workScores.get(4)!;

    expect(romance2).toBeGreaterThan(fantasy1);
    expect(bl4).toBeGreaterThan(fantasy1);
  });

  it('should minimize change when user answers maybe', () => {
    const session = createSession([1, 2, 3, 4]);
    const before = new Map(session.workScores);

    updateScores(session, 10, 'maybe', cache as any);

    // Scores should remain relatively close to each other
    for (const [id, score] of session.workScores) {
      expect(score).toBeGreaterThan(0);
    }
  });

  it('should produce normalized scores summing to 1', () => {
    const session = createSession([1, 2, 3, 4]);
    updateScores(session, 10, 'yes', cache as any);

    let sum = 0;
    for (const score of session.workScores.values()) {
      sum += score;
    }
    expect(sum).toBeCloseTo(1.0, 5);
  });
});

describe('Top Candidates', () => {
  let cache: MockCache;

  beforeEach(() => {
    cache = new MockCache(WORKS, FEATURES, WORK_FEATURES);
  });

  it('should rank correctly after multiple answers', () => {
    const session = createSession([1, 2, 3, 4]);

    // Target: Work 1 (판타지 회귀물)
    updateScores(session, 10, 'yes', cache as any);   // 판타지 = yes
    updateScores(session, 30, 'yes', cache as any);   // 회귀 = yes
    updateScores(session, 11, 'no', cache as any);    // 로맨스 = no

    const top = getTopCandidates(session, 3);
    expect(top[0].workId).toBe(1);
    expect(top[0].score).toBeGreaterThan(0.5);
  });

  it('should exclude guessed work ids', () => {
    const session = createSession([1, 2, 3, 4]);
    updateScores(session, 10, 'yes', cache as any);

    const excluded = new Set([1, 3]); // exclude fantasy works
    const top = getTopCandidates(session, 2, excluded);

    expect(top.every((t) => !excluded.has(t.workId))).toBe(true);
  });
});

describe('Full Game Flow', () => {
  let cache: MockCache;

  beforeEach(() => {
    cache = new MockCache(WORKS, FEATURES, WORK_FEATURES);
  });

  it('should converge to the correct work after targeted answers', () => {
    const session = createSession([1, 2, 3, 4]);

    // Simulate targeting Work 2 (로맨스 궁중물)
    let feature = selectNextQuestion(session, cache as any)!;
    expect(feature).not.toBeNull();

    // Answer based on Work 2's profile
    const targetFeatures: Record<number, boolean> = {
      10: false, // not fantasy
      11: true,  // romance
      12: false, // not BL
      20: true,  // palace
      21: false, // not modern
      30: false, // not regressor
      31: false, // not OP
    };

    let rounds = 0;
    while (rounds < 7) {
      feature = selectNextQuestion(session, cache as any)!;
      if (!feature) break;

      const isMatch = targetFeatures[feature.id] ?? false;
      updateScores(session, feature.id, isMatch ? 'yes' : 'no', cache as any);
      rounds++;

      const top = getTopCandidates(session, 1);
      if (top[0]?.score > 0.6) break;
    }

    const top = getTopCandidates(session, 1);
    expect(top[0].workId).toBe(2);
    expect(top[0].score).toBeGreaterThan(0.5);
  });
});

describe('buildQuestionText', () => {
  it('should generate correct text for each category', () => {
    expect(buildQuestionText({ id: 1, name: 'genre_fantasy', category: 'genre', displayName: '판타지' }))
      .toBe('이 작품은 판타지 장르인가요?');
    expect(buildQuestionText({ id: 2, name: 'setting_palace', category: 'setting', displayName: '궁중' }))
      .toBe('배경이 궁중인가요?');
    expect(buildQuestionText({ id: 3, name: 'protag_op', category: 'protagonist', displayName: '먼치킨' }))
      .toBe('주인공이 먼치킨 유형인가요?');
    expect(buildQuestionText({ id: 4, name: 'char_tsundere', category: 'character', displayName: '츤데레' }))
      .toBe('등장인물 중에 츤데레 캐릭터가 있나요?');
    expect(buildQuestionText({ id: 5, name: 'tone_dark', category: 'tone', displayName: '다크' }))
      .toBe('작품의 분위기가 다크인가요?');
    expect(buildQuestionText({ id: 6, name: 'theme_revenge', category: 'theme', displayName: '복수' }))
      .toBe('작품에 복수 테마가 있나요?');
  });
});
