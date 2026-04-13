import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import * as readline from 'readline';
import { db } from './database/kysely';
import { closeDb } from './database/kysely';
import { selectNextQuestion, selectTiebreakerQuestion, detectTiedCandidates, buildQuestionText } from './game/engine/question-selector';
import { updateScores, getTopCandidates } from './game/engine/score-updater';
import { DEFAULT_ABSENT } from './game/cache/work-feature.cache';
import type { CachedWork, CachedFeature } from './game/cache/work-feature.cache';
import type { Answer, GameSession } from './session/session.types';
import { v4 as uuidv4 } from 'uuid';

// ── Lightweight cache (no NestJS) ──

interface CliCache {
  getAllFeatures(): CachedFeature[];
  getWork(id: number): CachedWork | undefined;
  getFeature(id: number): CachedFeature | undefined;
  getAllWorkIds(): number[];
  getConfidence(workId: number, featureId: number): number;
}

async function loadCache(): Promise<CliCache> {
  const [workRows, featureRows, wfRows] = await Promise.all([
    db.selectFrom('works').selectAll().execute(),
    db.selectFrom('features').selectAll().execute(),
    db.selectFrom('work_features').selectAll().execute(),
  ]);

  const works = new Map<number, CachedWork>();
  for (const w of workRows) {
    works.set(w.id, {
      id: w.id, title: w.title, author: w.author,
      thumbnailUrl: w.thumbnail_url, platform: w.platform, externalId: w.external_id,
    });
  }

  const features = new Map<number, CachedFeature>();
  for (const f of featureRows) {
    features.set(f.id, {
      id: f.id, name: f.name, category: f.category, displayName: f.display_name,
      keywords: (f as any).keywords ?? [], questions: (f as any).questions ?? [],
    });
  }

  const confMap = new Map<number, Map<number, number>>();
  for (const wf of wfRows) {
    let fm = confMap.get(wf.work_id);
    if (!fm) { fm = new Map(); confMap.set(wf.work_id, fm); }
    fm.set(wf.feature_id, Number(wf.confidence));
  }

  const hasFeatures = new Set(confMap.keys());
  for (const id of [...works.keys()]) {
    if (!hasFeatures.has(id)) works.delete(id);
  }

  return {
    getAllFeatures: () => [...features.values()],
    getWork: (id) => works.get(id),
    getFeature: (id) => features.get(id),
    getAllWorkIds: () => [...works.keys()],
    getConfidence: (wId, fId) => confMap.get(wId)?.get(fId) ?? DEFAULT_ABSENT,
  };
}

function createSession(workIds: number[]): GameSession {
  const workScores = new Map<number, number>();
  const init = 1.0 / workIds.length;
  for (const id of workIds) workScores.set(id, init);
  return {
    id: uuidv4(), workScores, askedFeatures: new Set(), guessedWorkIds: new Set(),
    pendingFeatureId: null, questionCount: 0, status: 'playing', createdAt: new Date(),
  };
}

// ── Terminal helpers ──

const B = '\x1b[1m', D = '\x1b[2m', R = '\x1b[0m';
const CY = '\x1b[36m', GR = '\x1b[32m', YE = '\x1b[33m', RE = '\x1b[31m', MA = '\x1b[35m';

const w = (s: string) => process.stdout.write(s + '\n');
const blank = () => w('');

class LineReader {
  private rl: readline.Interface;
  private queue: string[] = [];
  private waiting: ((line: string) => void) | null = null;
  private closed = false;

  constructor() {
    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    this.rl.on('line', (line) => {
      if (this.waiting) {
        const cb = this.waiting;
        this.waiting = null;
        cb(line);
      } else {
        this.queue.push(line);
      }
    });
    this.rl.on('close', () => { this.closed = true; });
  }

  prompt(msg: string): Promise<string> {
    process.stdout.write(msg);
    if (this.queue.length > 0) {
      return Promise.resolve(this.queue.shift()!);
    }
    if (this.closed) return Promise.reject(new Error('EOF'));
    return new Promise<string>((res, rej) => {
      this.waiting = res;
      const onClose = () => { this.waiting = null; rej(new Error('EOF')); };
      this.rl.once('close', onClose);
    });
  }

  close() { this.rl.close(); }
}

async function askAnswer(lr: LineReader): Promise<Answer | 'quit'> {
  const map: Record<string, Answer | 'quit'> = {
    '1': 'yes', 'y': 'yes', '예': 'yes', 'yes': 'yes',
    '2': 'probably', 'p': 'probably', '아마도': 'probably',
    '3': 'maybe', 'm': 'maybe', '모르겠음': 'maybe', '?': 'maybe',
    '4': 'probably_not', '아마아닌듯': 'probably_not',
    '5': 'no', 'n': 'no', '아니오': 'no', 'no': 'no',
    'q': 'quit', 'quit': 'quit', '종료': 'quit',
  };
  while (true) {
    const raw = await lr.prompt(`  ${YE}> ${R}`);
    const val = map[raw.trim().toLowerCase()];
    if (val) return val;
    w(`  ${RE}1~5 또는 q를 입력해주세요${R}`);
  }
}

async function askYesNo(lr: LineReader): Promise<boolean | 'quit'> {
  while (true) {
    const raw = (await lr.prompt(`  ${YE}> ${R}`)).trim().toLowerCase();
    if (['1', 'y', 'yes', '예', '맞아'].includes(raw)) return true;
    if (['2', 'n', 'no', '아니오', '아니'].includes(raw)) return false;
    if (['q', 'quit', '종료'].includes(raw)) return 'quit';
    w(`  ${RE}1(예) 또는 2(아니오)를 입력해주세요${R}`);
  }
}

function showTop(session: GameSession, cache: CliCache, n: number) {
  const top = getTopCandidates(session, n);
  w(`${D}── 현재 상위 후보 ──${R}`);
  for (const c of top) {
    const t = cache.getWork(c.workId)?.title ?? '?';
    const pct = (c.score * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(c.score * 30));
    w(`${D}  ${t} ${YE}${bar} ${pct}%${R}`);
  }
  blank();
}

// ── Main ──

const MAX_Q = 20, GUESS_TH = 0.6, TOP3_TH = 0.8, MAX_GUESS = 3;

async function main() {
  blank();
  w(`${B}${CY}╔══════════════════════════════════════════╗${R}`);
  w(`${B}${CY}║       데모네이터 스무고개 게임           ║${R}`);
  w(`${B}${CY}║   웹소설 아키네이터 - CLI Edition        ║${R}`);
  w(`${B}${CY}╚══════════════════════════════════════════╝${R}`);
  blank();

  w(`${D}데이터 로딩 중...${R}`);
  const cache = await loadCache();
  const engineCache = cache as any; // structurally compatible with WorkFeatureCache

  const totalWorks = cache.getAllWorkIds().length;
  const totalFeatures = cache.getAllFeatures().length;
  w(`${GR}${totalWorks}개 작품, ${totalFeatures}개 피처 로드 완료${R}`);
  blank();

  w(`${B}생각하고 있는 웹소설 작품을 떠올려주세요.${R}`);
  w(`${D}${MAX_Q}번 이내의 질문으로 맞춰보겠습니다!${R}`);
  blank();
  w(`${D}답변: 1=예  2=아마도  3=모르겠음  4=아마아닌듯  5=아니오  q=종료${R}`);
  blank();

  const lr = new LineReader();

  const session = createSession(cache.getAllWorkIds());
  let feature: CachedFeature | null = selectNextQuestion(session, engineCache);
  if (!feature) {
    w(`${RE}피처 데이터가 없어 게임을 시작할 수 없습니다.${R}`);
    lr.close(); await closeDb(); return;
  }
  session.pendingFeatureId = feature.id;

  // ── Question loop ──
  gameLoop: while (true) {
    while (session.status === 'playing' && session.pendingFeatureId != null) {
      const f = cache.getFeature(session.pendingFeatureId)!;
      const qn = session.questionCount + 1;

      w(`${B}${CY}Q${qn}.${R} ${buildQuestionText(f)}`);
      w(`${D}     [${f.category} / ${f.displayName}]${R}`);

      const ans = await askAnswer(lr);
      if (ans === 'quit') break gameLoop;

      updateScores(session, session.pendingFeatureId, ans, engineCache);
      session.pendingFeatureId = null;

      showTop(session, cache, 3);

      const top = getTopCandidates(session, 3, session.guessedWorkIds);
      const reachedMaxQ = session.questionCount >= MAX_Q;
      const leaderStrong = top.length > 0 && top[0].score >= GUESS_TH;
      const top3Concentrated = top.length > 0 && top.reduce((s, c) => s + c.score, 0) >= TOP3_TH;

      if (reachedMaxQ || leaderStrong) {
        session.status = 'guessing'; break;
      }

      if (top3Concentrated) {
        const tiedIds = detectTiedCandidates(top);
        if (tiedIds) {
          const tb = selectTiebreakerQuestion(session, engineCache, tiedIds);
          if (tb) {
            w(`${D}  ⚡ 상위 후보 동률 → 핵심 질문${R}`);
            session.pendingFeatureId = tb.id;
            continue;
          }
        }
        session.status = 'guessing'; break;
      }

      const next = selectNextQuestion(session, engineCache);
      if (!next) { session.status = 'guessing'; break; }
      session.pendingFeatureId = next.id;
    }

    // ── Guess loop ──
    while (session.status === 'guessing') {
      const top = getTopCandidates(session, 1, session.guessedWorkIds);
      if (top.length === 0 || session.guessedWorkIds.size >= MAX_GUESS) {
        blank();
        w(`${B}${RE}모르겠습니다... 더 공부하고 오겠습니다!${R}`);
        w(`${D}총 ${session.questionCount}번 질문했습니다.${R}`);
        blank();
        const final = getTopCandidates(session, 5);
        w(`${D}── 최종 후보 ──${R}`);
        for (let i = 0; i < final.length; i++) {
          const wk = cache.getWork(final[i].workId);
          w(`  ${i + 1}. ${wk?.title ?? '?'} (${(final[i].score * 100).toFixed(1)}%)${wk?.author ? ` - ${wk.author}` : ''}`);
        }
        break gameLoop;
      }

      const gw = cache.getWork(top[0].workId)!;
      const pct = (top[0].score * 100).toFixed(1);

      blank();
      w(`${B}${MA}╔══════════════════════════════════════════╗${R}`);
      w(`${B}${MA}║  제 추측은...                            ║${R}`);
      w(`${B}${MA}╚══════════════════════════════════════════╝${R}`);
      blank();
      w(`   ${B}${GR}「 ${gw.title} 」${R}`);
      if (gw.author) w(`   ${D}저자: ${gw.author}${R}`);
      w(`   ${D}확신도: ${YE}${pct}%${R}`);
      blank();
      const top3 = getTopCandidates(session, 3);
      w(`${D}── 상위 후보 ──${R}`);
      for (let i = 0; i < top3.length; i++) {
        const wk = cache.getWork(top3[i].workId);
        const p = (top3[i].score * 100).toFixed(1);
        const mark = top3[i].workId === top[0].workId ? `${GR}▶ ` : '  ';
        w(`${D}  ${mark}${i + 1}. ${wk?.title ?? '?'} (${YE}${p}%${R}${D})${wk?.author ? ` - ${wk.author}` : ''}${R}`);
      }
      blank();
      w(`${B}맞나요?${R} ${D}(1=예 / 2=아니오)${R}`);

      const ok = await askYesNo(lr);
      if (ok === 'quit') break gameLoop;

      if (ok) {
        blank();
        w(`${B}${GR}╔══════════════════════════════════════════╗${R}`);
        w(`${B}${GR}║            정답입니다!                   ║${R}`);
        w(`${B}${GR}╚══════════════════════════════════════════╝${R}`);
        blank();
        w(`  ${D}총 ${B}${session.questionCount}${R}${D}번 질문으로 맞췄습니다.${R}`);
        break gameLoop;
      }

      session.guessedWorkIds.add(top[0].workId);
      w(`${D}  아쉽네요... 다시 생각해볼게요.${R}`);
      blank();

      if (session.questionCount < MAX_Q) {
        const nf = selectNextQuestion(session, engineCache);
        if (nf) {
          session.pendingFeatureId = nf.id;
          session.status = 'playing';
          w(`${D}답변: 1=예  2=아마도  3=모르겠음  4=아마아닌듯  5=아니오  q=종료${R}`);
          blank();
          break; // back to question loop
        }
      }
    }

    if (session.status !== 'playing') break;
  }

  blank();
  w(`${D}게임을 종료합니다. 감사합니다!${R}`);
  lr.close();
  await closeDb();
}

main().catch((err) => {
  if (err?.message !== 'EOF') console.error('Error:', err);
  process.exit(err?.message === 'EOF' ? 0 : 1);
});
