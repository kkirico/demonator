# @demonator/crawler


## 아키텍처

데이터는 세 개의 Zone을 거쳐 처리됩니다.

```
Raw Zone → Refined Zone → Serving Zone
```

| Zone | 역할 | 주요 테이블 |
|------|------|------------|
| **Raw** | 원본 크롤링 데이터 저장 | `raw_list_items`, `raw_work_pages`, `raw_work_parse_results` |
| **Refined** | 키워드/설명 기반 피처 추출 및 필터링 | `refined_work_feature_runs`, `refined_work_feature_candidates`, `refined_work_feature_rejections` |
| **Serving** | 최종 서빙용 데이터 | `works`, `features`, `work_features` |

## 프로젝트 구조

```
src/
├── index.ts                          # CLI 진입점 (commander)
├── crawlers/
│   ├── base.crawler.ts               # Playwright 기반 공통 크롤러
│   └── ridi/
│       ├── ridi-list.crawler.ts      # 베스트셀러 목록 크롤링
│       ├── ridi.crawler.ts           # 작품 상세 페이지 크롤링
│       └── ridi.parser.ts            # 상세 페이지 DOM 파싱 (Locator API)
├── validators/
│   └── list-validator.ts             # 신규 작품 식별 및 통계
├── refiners/
│   ├── feature-extractor.ts          # 키워드/설명 → 피처 후보 추출
│   ├── feature-refiner.ts            # 피처 후보 필터링
│   └── publisher.ts                  # Serving Zone 발행
├── database/
│   ├── kysely.ts                     # DB 커넥션
│   ├── migrate.ts                    # 마이그레이션 실행기
│   └── migrations/
│       └── 001_initial_schema.ts     # 전체 스키마 정의
├── schemas/
│   ├── raw.schema.ts                 # Raw Zone Zod 스키마
│   └── refined.schema.ts            # Refined Zone Zod 스키마
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

프로젝트 루트(`demonator/.env`)에 환경변수 파일을 생성합니다.

```env
DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=
```

## DB 마이그레이션

```bash
yarn migrate
```

## CLI 명령어

모든 명령어는 `packages/crawler` 디렉터리에서 실행합니다.

### 베스트셀러 목록 크롤링

```bash
yarn crawl:list -g <genre> [-o <order>] [-p <page>] [--pages <count>]
```

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `-g, --genre` | 장르 코드 (필수) | - |
| `-o, --order` | 정렬 기준 | `daily` |
| `-p, --page` | 시작 페이지 | `1` |
| `--pages` | 크롤링할 페이지 수 | `1` |

**장르 코드**: `fantasy_serial`, `romance_fantasy_serial`, `romance_serial`, `bl-webnovel`

**정렬 기준**: `daily`, `weekly`, `monthly`

```bash
# 판타지 일간 베스트셀러 1페이지
yarn crawl:list -g fantasy_serial

# 로맨스 주간 베스트셀러 3페이지
yarn crawl:list -g romance_serial -o weekly --pages 3
```

### 작품 상세 크롤링

```bash
yarn crawl:detail [-i <id>] [--new] [--limit <n>]
```

| 옵션 | 설명 |
|------|------|
| `-i, --id` | 특정 작품 external ID |
| `--new` | 목록에는 있지만 상세 페이지가 없는 신규 작품만 크롤링 |
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

목록 아이템 수, 상세 페이지 수, 파싱 완료/미완료 건수 및 신규 작품 ID를 출력합니다.

### 서빙 데이터 발행

```bash
yarn publish
```

파싱 결과에서 피처를 추출 → 필터링 → `works` 및 `work_features` 테이블에 발행합니다.

### 전체 파이프라인

```bash
yarn dev pipeline -g <genre> [--pages <count>] [--limit <n>]
```

목록 크롤링 → 신규 작품 상세 크롤링 → 서빙 발행까지 한 번에 실행합니다.

### 전체 사용 방법

``` bash
cd packages/crawler

# DB 마이그레이션
yarn migrate

# 베스트셀러 리스트 크롤링
yarn dev crawl:list -g fantasy_serial -p 1 --pages 3

# 새 작품 확인
yarn dev validate:list

# 상세 페이지 크롤링 (새 작품만)
yarn dev crawl:detail --new --limit 10

# Serving Zone에 퍼블리시
yarn dev publish

# 전체 파이프라인 실행
yarn dev pipeline -g fantasy_serial --pages 2 --limit 5
```

## 파싱 데이터

상세 페이지에서 Playwright Locator API를 사용해 추출하는 항목:

| 항목 | 소스 |
|------|------|
| 제목 | `og:title` 메타 태그 |
| 저자 | `#ISLANDS__Header` 저자 링크 |
| 작품 소개 | `#ISLANDS__IntroduceTab` 텍스트 |
| 키워드 | `#ISLANDS__Keyword` 버튼 라벨 |
| 표지 이미지 | `og:image` 메타 태그 |
| 소개 이미지 | `#ISLANDS__IntroduceTab`, `#ISLANDS__LowerPanelList` 내 독립 이미지 |
| 평점 | 메타 키워드 |
| 총 회차 수 | `#ISLANDS__Header` 텍스트 |

## 피처 카테고리

| 카테고리 | 예시 |
|----------|------|
| genre | 판타지, 로맨스, BL, 무협 |
| setting | 현대, 이세계, 학원, 궁중 |
| protagonist | 회귀, 환생, 먼치킨, 여주인공 |
| tone | 코믹, 다크, 달달, 진지 |

## 기술 스택

- **Runtime**: Node.js + TypeScript
- **Crawler**: Playwright (headless Chromium)
- **Database**: PostgreSQL + Kysely
- **Validation**: Zod
- **CLI**: Commander.js
- **Env**: dotenv
