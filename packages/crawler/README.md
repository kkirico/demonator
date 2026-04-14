# @demonator/crawler

## 아키텍처

데이터는 세 개의 Zone을 거쳐 처리된다.

```
Raw Zone → Refined Zone → Serving Zone
```

| Zone | 역할 | 주요 테이블 |
|------|------|------------|
| **Raw** | 원본 크롤링 데이터 + 외부 보강 데이터 | `raw_list_items`, `raw_work_pages`, `raw_work_parse_results`, `raw_work_enrichments` |
| **Refined** | 키워드/설명/태그 기반 피처 추출 및 필터링 | `refined_work_feature_runs`, `refined_work_feature_candidates`, `refined_work_feature_rejections` |
| **Serving** | 게임 서버용 최종 데이터 | `works`, `features`, `work_features` |

## 디렉터리 구조

```
packages/crawler/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                          # CLI 진입점 (Commander.js)
    ├── crawlers/
    │   ├── base.crawler.ts               # Playwright 기반 공통 크롤러
    │   └── ridi/
    │       ├── ridi-list.crawler.ts       # 베스트셀러 목록 크롤링
    │       ├── ridi.crawler.ts            # 작품 상세 페이지 크롤링
    │       └── ridi.parser.ts            # 상세 페이지 DOM 파싱 (Locator API)
    ├── validators/
    │   └── list-validator.ts             # 신규 작품 식별 및 통계
    ├── refiners/
    │   ├── feature-extractor.ts          # 키워드/설명 → 피처 후보 추출
    │   ├── feature-refiner.ts            # 피처 후보 필터링 (신뢰도/블랙리스트)
    │   └── publisher.ts                  # Serving Zone 발행
    ├── database/
    │   ├── kysely.ts                     # DB 커넥션
    │   ├── migrate.ts                    # 마이그레이션 실행기
    │   └── migrations/
    │       ├── 001_initial_schema.ts     # 전체 스키마 정의
    │       ├── 002_features_keywords_questions.ts  # features에 keywords/questions 추가
    │       └── 003_enrichments.ts        # raw_work_enrichments 테이블
    ├── schemas/
    │   ├── raw.schema.ts                 # Raw Zone Zod 스키마
    │   ├── refined.schema.ts             # Refined Zone Zod 스키마
    │   └── enrichment.schema.ts          # Enrichment import Zod 스키마
    └── types/
        └── database.ts                   # Kysely 테이블 타입 정의
```

## 설치

```bash
# 프로젝트 루트에서
yarn install

# Playwright 브라우저 설치
npx playwright install chromium
```

## 환경 설정

프로젝트 루트(`demonator/.env`)에 환경변수 파일을 생성한다.

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=demonator
DB_USER=admin
DB_PASSWORD=
```

## DB 마이그레이션

```bash
yarn migrate
```

## 모듈 상세

### Crawlers

#### base.crawler.ts — 공통 크롤러 기반 클래스

- Playwright Chromium 헤드리스 브라우저 관리
- `Accept-Language: ko-KR` 헤더 설정
- `fetchPage(url)` — `domcontentloaded` 대기 후 `networkidle` best-effort, HTML content 반환
- `init()` / `close()` — 브라우저 라이프사이클
- `delay(ms)` — 크롤링 간 딜레이

#### ridi-list.crawler.ts — 베스트셀러 목록 크롤링

리디북스 베스트셀러 페이지에서 작품 목록을 수집한다.

**장르 코드** (`RidiGenre`):

| 코드 | 장르 |
|------|------|
| `fantasy` | 판타지 |
| `romance_fantasy` | 로맨스판타지 |
| `romance` | 로맨스 |
| `bl-novel` | BL |

**정렬 기준** (`RidiOrder`): `weekly`, `monthly`, `steady` (기본값: `steady`)

**파싱 전략** (2단계 fallback):
1. `__NEXT_DATA__` JSON에서 `BestSellers` 쿼리 데이터 추출 (제목, 저자, ID 포함)
2. fallback: HTML에서 `/books/{id}` href 패턴으로 ID만 추출

**DB 저장**: `raw_list_items`에 upsert (platform + external_id 기준)

#### ridi.crawler.ts — 작품 상세 페이지 크롤링

`https://ridibooks.com/books/{externalId}` 페이지의 전체 HTML을 수집한다.

- `saveToDb()` — `raw_work_pages`에 insert/update, page ID 반환
- `crawlAndSave()` — 크롤링 + 저장 한 번에 실행

#### ridi.parser.ts — 상세 페이지 DOM 파싱

Playwright Locator API로 상세 페이지에서 구조화된 데이터를 추출한다.

| 항목 | 소스 |
|------|------|
| 제목 | `og:title` 메타 태그 |
| 저자 | `#ISLANDS__Header` 저자 링크 |
| 작품 소개 | `#ISLANDS__IntroduceTab` 텍스트 |
| 키워드 | `#ISLANDS__Keyword` 버튼 라벨 |
| 표지 이미지 | `og:image` 메타 태그 |
| 소개 이미지 | `#ISLANDS__IntroduceTab`, `#ISLANDS__LowerPanelList` 내 독립 이미지 |
| 총 회차 수 | `#ISLANDS__Header` 텍스트 |

키워드에서 `^작품$`, `^완결$`, `^기다리면 무료$` 등 노이즈를 필터링한다.

**DB 저장**: `raw_work_parse_results`에 insert

### Validators

#### list-validator.ts — 신규 작품 식별 및 통계

- `findNewWorks(platform)` — `raw_list_items`에는 있지만 `raw_work_pages`에 없는 신규 external ID 목록
- `findUnparsedWorks(platform)` — 상세 페이지는 있지만 파싱 결과가 없는 작품
- `getStats(platform)` — 목록 아이템 수, 상세 페이지 수, 파싱 완료/미완료 건수

### Refiners

#### feature-extractor.ts — 키워드/설명/태그 기반 피처 추출

피처 정의 (`FEATURE_DEFINITIONS`)를 기반으로 피처 후보를 추출한다.

**피처 카테고리** (6종):

| 카테고리 | 설명 | 예시 |
|----------|------|------|
| `genre` | 장르 (15개) | 판타지, 로맨스, 로판, BL, 무협, SF, 호러 |
| `setting` | 배경 (15개) | 현대, 서양풍, 이세계, 학원, 궁중, 타워/헌터 |
| `protagonist` | 주인공 유형 (10개) | 회귀, 환생, 빙의, 먼치킨, 악역, 귀족 |
| `character` | 캐릭터 성격 (6개) | 집착캐, 다정/순정캐, 차가운캐, 계략캐, 츤데레, 순수캐 |
| `tone` | 분위기 (8개) | 시리어스, 코믹, 다크, 달달, 비극, 힐링 |
| `theme` | 테마 (21개) | 복수, 성장, 계약, 비밀, 신분차이, 금단의관계 |

**5단계 Confidence 시스템**:

| 단계 | confidence | 의미 | 소스 |
|------|-----------|------|------|
| 확실히 있다 | **0.9** | 키워드/태그에서 직접 확인됨 | Ridi 키워드, Enrichment `tags` |
| 아마 있다 | **0.7** | 설명 텍스트에서 간접 확인됨 | Ridi 작품 소개 매칭 |
| 모르겠다 | **0.5** | 해당 feature에 대한 데이터 없음 | (DB에 미저장, 게임에서 기본값) |
| 확실히 없다 | **0.1** | 명시적으로 해당 feature 부재 확인 | Enrichment `negative_tags` |

**Negative 태그 처리**: `negative_tags`에 포함된 feature는 다른 소스에서 positive로 추출되더라도 `confidence: 0.1`로 덮어씌워진다. 이 값은 `work_features`에 명시적으로 저장되어 "모르겠다(0.5)"와 구별된다.

각 피처 정의에는 선택적 `questions` 배열이 있어, 게임 서버에서 커스텀 질문 텍스트로 사용된다.

**DB 저장**: `refined_work_feature_runs` (실행 기록) + `refined_work_feature_candidates` (후보)

#### feature-refiner.ts — 피처 후보 필터링

추출된 후보를 규칙 기반으로 필터링한다.

**필터링 기준**:
- `tooCommonFeatures` — 너무 일반적인 피처 블랙리스트
- `ambiguousFeatures` — 모호한 피처 블랙리스트

모든 confidence 값(0.1 ~ 0.9)은 그대로 `work_features`에 저장된다. `minConfidence` 임계값은 없으며, 5단계 시스템의 모든 값이 게임 엔진에 전달된다.

**결과**:
- 수락된 피처 → 다음 단계(publish)로 전달
- 거절된 피처 → `refined_work_feature_rejections`에 사유와 함께 저장 (`too_common`, `ambiguous`)

#### publisher.ts — Serving Zone 발행

Refined 결과를 최종 Serving 테이블에 발행한다.

**`ensureFeatures()`**:
- `FEATURE_DEFINITIONS` 기반으로 `features` 테이블 동기화
- 새 피처는 insert, 기존 피처는 `keywords`/`questions` update

**`publishWork(parseResultId)`**:
1. 피처 추출 (`FeatureExtractor.extract`)
2. 피처 필터링 (`FeatureRefiner.refine`)
3. `works` 테이블에 작품 insert/update (platform + external_id 기준)
4. `work_features` 테이블에 피처-신뢰도 매핑 저장 (기존 삭제 후 재삽입)

**`publishAll(platform)`**: 해당 플랫폼의 모든 파싱 결과를 순차 발행

**`getPublishStats(platform)`**: 총 파싱 수, 발행 수, 미발행 수 통계

### Database

#### kysely.ts — DB 연결

`dotenv`로 `.env` 로드, `pg.Pool` + Kysely `PostgresDialect`로 PostgreSQL 연결.

#### migrate.ts — 마이그레이션 실행기

`FileMigrationProvider`로 `migrations/` 폴더의 마이그레이션 파일을 순차 실행.

#### migrations/001_initial_schema.ts — 초기 스키마

3개 Zone의 전체 테이블 생성:
- **Raw**: `raw_list_items`, `raw_work_pages`, `raw_work_parse_results`
- **Refined**: `refined_work_feature_runs`, `refined_work_feature_candidates`, `refined_work_feature_rejections`
- **Serving**: `works`, `features` (name unique), `work_features` (work_id + feature_id unique, confidence decimal(3,2))
- 인덱스: external_id, platform 기준

#### migrations/002_features_keywords_questions.ts

`features` 테이블에 `keywords text[]`, `questions text[]` 컬럼 추가. 게임 서버에서 질문 텍스트 생성에 사용.

#### migrations/003_enrichments.ts

외부 보강 데이터를 저장하는 `raw_work_enrichments` 테이블 생성:
- `external_id` (varchar, unique) — 작품 식별자
- `tags` (text[]) — 해당 작품에 적용할 feature 태그
- `negative_tags` (text[]) — 명시적으로 제외할 feature 태그

### Schemas (Zod)

#### raw.schema.ts — Raw Zone 검증 스키마

`Platform`, `ListType`, `RawListItem`, `ParsedWorkData` 등 원본 데이터 구조 정의.

#### refined.schema.ts — Refined Zone 검증 스키마

- `FeatureCategory`: `genre | setting | protagonist | character | tone | theme`
- `FeatureSource`: `keyword | description | ml | enrichment_keyword | enrichment_negative`
- `FeatureCandidate`: `{ featureName, source, confidence }`
- `FeatureDefinition`: `{ name, category, displayName, keywords, questions?, mutualExclusiveGroup? }`
- `RejectionReason`: `low_confidence | ambiguous | too_common | invalid`

#### enrichment.schema.ts — Enrichment Import 검증 스키마

- `EnrichmentWork`: `{ external_id, title?, tags, negative_tags }`
- `EnrichmentImport`: `{ works: EnrichmentWork[] }` — 여러 작품을 한 파일에 배치 전달

## CLI 명령어

모든 명령어는 `packages/crawler` 디렉터리에서 실행한다.

### 베스트셀러 목록 크롤링

```bash
yarn crawl:list -g <genre> [-o <order>] [-p <page>] [--pages <count>] [-l <limit>]
```

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `-g, --genre` | 장르 코드 (`fantasy`, `romance_fantasy`, `romance`, `bl-novel`, `all`) | 필수 |
| `-o, --order` | 정렬 (`weekly`, `monthly`, `steady`) | `steady` |
| `-p, --page` | 시작 페이지 | `1` |
| `--pages` | 크롤링할 페이지 수 | `1` |
| `-l, --limit` | 총 아이템 수 제한 | - |

```bash
# 판타지 스테디셀러 1페이지
yarn crawl:list -g fantasy

# 로맨스 주간 베스트셀러 3페이지
yarn crawl:list -g romance -o weekly --pages 3

# 전 장르 60개씩
yarn crawl:list -g all -l 60
```

### 작품 상세 크롤링

```bash
yarn crawl:detail [-i <id>] [--new] [--limit <n>]
```

| 옵션 | 설명 |
|------|------|
| `-i, --id` | 특정 작품 external ID |
| `--new` | 목록에만 있고 상세 페이지가 없는 신규 작품 크롤링 |
| `--limit` | 크롤링 개수 제한 |

```bash
# 특정 작품
yarn crawl:detail -i 6074000001

# 신규 작품 10개
yarn crawl:detail --new --limit 10
```

### 목록 검증

```bash
yarn validate
```

목록 아이템 수, 상세 페이지 수, 파싱 완료/미완료 건수 및 신규 작품 ID를 출력한다.

### 서빙 데이터 발행

```bash
yarn dev publish [--dry-run]
```

파싱 결과에서 피처 추출 → 필터링 → `works`/`features`/`work_features` 테이블에 발행한다. `--dry-run`으로 미리보기 가능.

### Enrichment (외부 데이터 보강)

```bash
# 보강 데이터 없는 작품 목록
yarn dev enrich:list [--limit <n>]

# JSON 파일로 보강 데이터 일괄 임포트
yarn dev enrich:import -f <path>
```

**JSON 파일 형식** — 여러 작품을 하나의 파일에 배치로 전달:

```json
{
  "works": [
    {
      "external_id": "6074000001",
      "title": "사내 맞선",
      "tags": ["로맨스", "현대", "직장", "계약결혼", "달달", "다정남", "츤데레"],
      "negative_tags": ["판타지", "이세계", "회귀", "먼치킨"]
    },
    {
      "external_id": "6074000002",
      "title": "아카데미의 천재칼잡이",
      "tags": ["판타지", "아카데미", "먼치킨", "코믹", "성장"],
      "negative_tags": ["로맨스", "BL"]
    }
  ]
}
```

`tags`와 `negative_tags`는 모두 자연어로 작성한다. 내부 `FEATURE_DEFINITIONS`의 키워드와 매칭되어 자동으로 feature로 변환된다.

`negative_tags`는 해당 feature를 **명시적으로 배제**한다. Ridi 키워드 등 다른 소스에서 positive로 추출되더라도 negative가 우선한다.

### 통계 조회

```bash
yarn dev stats
```

Raw Zone (목록/상세/파싱) 및 Serving Zone (발행) 건수를 출력한다.

### 전체 파이프라인

```bash
yarn dev pipeline -g <genre> [--pages <count>] [--limit <n>]
```

목록 크롤링 → 신규 작품 상세 크롤링 → 서빙 발행까지 한 번에 실행한다.

## 전체 사용 흐름

```bash
cd packages/crawler

# 1. DB 마이그레이션
yarn migrate

# 2. 베스트셀러 목록 크롤링
yarn crawl:list -g fantasy --pages 3

# 3. 신규 작품 확인
yarn validate

# 4. 상세 페이지 크롤링 (신규만)
yarn crawl:detail --new --limit 10

# 5. (선택) 외부 보강 데이터 임포트
yarn dev enrich:list                    # 보강 안 된 작품 확인
yarn dev enrich:import -f enrichment.json  # 배치 임포트

# 6. Serving Zone에 발행
yarn dev publish

# 또는 1~4를 한 번에
yarn dev pipeline -g fantasy --pages 2 --limit 5
```

## 기술 스택

- **Runtime**: Node.js + TypeScript (ESM)
- **Crawler**: Playwright (headless Chromium)
- **Database**: PostgreSQL + Kysely
- **Validation**: Zod
- **CLI**: Commander.js
- **Env**: dotenv
