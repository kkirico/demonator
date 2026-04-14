# @demonator/server

## 디렉터리 구조

```
packages/server/
├── package.json
├── tsconfig.json
├── nest-cli.json
├── vitest.config.ts
├── test/
│   └── game-engine.spec.ts         # 엔진 유닛 테스트 (MockCache)
└── src/
    ├── main.ts                      # NestJS 서버 부트스트랩
    ├── app.module.ts                # 루트 모듈
    ├── cli.ts                       # 독립 CLI 게임
    ├── database/
    │   ├── kysely.ts                # PostgreSQL 연결
    │   └── types.ts                 # Kysely 테이블 타입
    ├── session/
    │   ├── session.types.ts         # 세션·DTO 타입 정의
    │   └── session.store.ts         # 인메모리 세션 관리 (TTL 30분)
    └── game/
        ├── game.module.ts           # NestJS 모듈
        ├── game.controller.ts       # REST API 엔드포인트
        ├── cache/
        │   └── work-feature.cache.ts   # 작품·피처 인메모리 캐시
        └── engine/
            ├── game-engine.ts          # 게임 흐름 오케스트레이션
            ├── question-selector.ts    # 질문 선택 알고리즘
            └── score-updater.ts        # 점수 갱신·정규화
```

## 실행

```bash
# 서버 실행
yarn start:dev

# CLI 게임
yarn play

# 테스트
yarn test
```

## 모듈 상세

### Database

**`kysely.ts`** — 모노레포 루트 `.env`에서 DB 설정을 읽어 PostgreSQL에 연결한다. Kysely ORM을 사용.

**`types.ts`** — Serving Zone 테이블 스키마 정의.

| 테이블 | 주요 컬럼 |
|--------|----------|
| `works` | id, title, author, platform, external_id, thumbnail_url |
| `features` | id, name, category, display_name, keywords (text[]), questions (text[]) |
| `work_features` | work_id, feature_id, confidence (0.00~1.00) |

### Session

**`session.types.ts`** — 게임 도메인 타입.

- `Answer`: `yes` \| `probably` \| `maybe` \| `probably_not` \| `no`
- `GameSession`: 게임 상태 전체
  - `workScores` — Map\<workId, 확률\> (베이지안 확률 분포)
  - `askedFeatures` — Set\<featureId\> (이미 물어본 질문)
  - `guessedWorkIds` — Set\<workId\> (이미 추측한 작품)
  - `pendingFeatureId` — 현재 대기 중인 질문
  - `questionCount`, `status` (playing → guessing → finished)

**`session.store.ts`** — 인메모리 세션 저장소.

- `create(workIds)` — 모든 작품에 균등 확률(1/N) 부여
- TTL 30분, 5분 주기로 만료 세션 정리

### Cache

**`work-feature.cache.ts`** — 앱 시작 시 DB에서 전체 데이터를 인메모리로 로드.

- `works`, `features`, `work_features` 3개 테이블 병렬 로드
- 피처가 0개인 작품은 자동 제외
- `getConfidence(workId, featureId)` — 매핑이 없으면 `DEFAULT_ABSENT = 0.5` (모르겠다) 반환
- `getAllFeatures()` — keywords, questions 포함

### Engine

#### score-updater.ts — 베이지안 점수 갱신

답변에 따라 각 작품의 점수에 multiplier를 곱한 뒤 정규화(합=1.0)한다.

| 답변 | multiplier 공식 | 의미 |
|------|----------------|------|
| yes | `conf` | 신뢰도 높을수록 유리 |
| probably | `conf × 0.8 + 0.1` | 약한 긍정 |
| maybe | `0.5` | 영향 없음 |
| probably_not | `(1-conf) × 0.8 + 0.1` | 약한 부정 |
| no | `1 - conf` | 신뢰도 높을수록 불리 |

#### question-selector.ts — 질문 선택 알고리즘

3가지 전략을 상황에 따라 사용한다.

**1. 일반 질문 (`selectNextQuestion`)**

모든 미사용 피처에 대해 정보 이득(split score), 데이터 커버리지, 게임 페이즈별 카테고리 가중치를 종합하여 상위 5개 중 랜덤 선택.

```
splitScore = 1 - |yesWeight - noWeight| / total
coverage = knownWeight / totalWeight
categoryWeight = PHASE_WEIGHTS[phase][category]
finalScore = splitScore × coverage × categoryWeight
```

- `splitScore`: 1.0에 가까울수록 후보를 균등하게 나누는 좋은 질문
- `coverage`: 해당 feature에 대해 실제 데이터가 있는 작품의 비율. 데이터 없이 DEFAULT_ABSENT(0.5)로만 채워진 feature가 과대평가되는 것을 방지
- `categoryWeight`: 게임 진행 단계에 따라 카테고리 우선도를 동적으로 조절

**3단계 페이즈 시스템**:

| 페이즈 | 질문 수 | 전략 | 부스트 카테고리 |
|--------|---------|------|----------------|
| Phase 1 | Q1~5 | 큰 분류 | genre(1.5), setting(1.3) |
| Phase 2 | Q6~10 | 범위 좁히기 | protagonist(1.2), tone(1.1) |
| Phase 3 | Q11+ | 세부 특정 | character(1.1), theme(1.1) |

- 상위 5개 중 랜덤 선택하여 매 판 다른 질문 순서를 보장

**2. 동률 감지 (`detectTiedCandidates`)**

1위 점수 대비 15% 이내 차이면 동률로 판정. 2개 이상 동률이면 tiebreaker 발동.

**3. 핵심 질문 (`selectTiebreakerQuestion`)**

동률 작품들 사이에서 confidence 차이가 가장 큰 피처를 선택한다. 한 번의 질문으로 동률을 해소하는 것이 목표.

**질문 텍스트 (`buildQuestionText`)**

- 피처에 `questions`가 있으면 → 그 중 랜덤 선택
- 없으면 → 카테고리별 템플릿 + displayName으로 자동 생성

#### game-engine.ts — 게임 흐름 오케스트레이션

임계값:

| 상수 | 값 | 의미 |
|------|----|------|
| `GUESS_THRESHOLD` | 0.6 | 1위가 60% 이상이면 즉시 추측 |
| `TOP3_THRESHOLD` | 0.8 | 상위 3개 합이 80% 이상이면 추측 고려 |
| `MAX_QUESTIONS` | 50 | 최대 질문 수 |
| `MAX_GUESSES` | 10 | 최대 추측 시도 |

게임 흐름:

```
startGame()
  → 균등 확률 세션 생성 → 첫 질문 선택

processAnswer(sessionId, answer)
  → 점수 갱신 → shouldGuess() 판정
    → 1위 ≥ 60%         → 즉시 추측
    → top3 합 ≥ 80% + 동률  → tiebreaker 질문 추가
    → top3 합 ≥ 80% + 비동률 → 추측
    → 그 외              → 다음 질문

processGuessResponse(sessionId, correct)
  → 정답  → 종료
  → 오답  → 다음 후보 추측 or 질문 계속 or 포기
```

### Controller

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/game/start` | POST | 새 게임 시작, 첫 질문 반환 |
| `/game/:sessionId/answer` | POST | 답변 처리 (`body.answer`), 다음 질문 or 추측 반환 |
| `/game/:sessionId/guess-response` | POST | 추측 결과 (`body.correct`), 다음 행동 결정 |

### CLI

NestJS 없이 엔진 함수를 직접 호출하는 독립 터미널 게임.

- `loadCache()` — DB에서 직접 데이터 로드
- `LineReader` — readline 래퍼 (파이프 입력 대응)
- 컬러 출력, 동률 tiebreaker, 상위 3개 후보 표시 지원

CLI 설정:

| 상수 | 값 | 의미 |
|------|----|------|
| `MAX_Q` | 20 | 최대 질문 수 |
| `GUESS_TH` | 0.6 | 즉시 추측 임계값 |
| `TOP3_TH` | 0.8 | top3 합산 추측 임계값 |
| `MAX_GUESS` | 3 | 최대 추측 시도 |

### 테스트

`test/game-engine.spec.ts` — `MockCache`로 DB 없이 엔진 순수 함수를 검증.

- `selectNextQuestion` — 정보 이득 기반 질문 선택
- `updateScores` — 답변별 점수 갱신
- `getTopCandidates` — 순위 정렬·제외
- `buildQuestionText` — 질문 텍스트 생성
- 전체 수렴 시나리오 — 반복 답변으로 특정 작품에 수렴하는지 검증
