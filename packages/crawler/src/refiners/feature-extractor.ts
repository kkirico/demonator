import { db } from '../database/kysely';
import type { FeatureCandidate, FeatureDefinition } from '../schemas/refined.schema';

export const CONFIDENCE = {
  POSITIVE: 0.9,
  PROBABLE: 0.7,
  NEGATIVE: 0.1,
} as const;

// Feature definitions - keyword to feature mapping
// 리디북스 키워드 기반으로 구성
const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  // ===== Genre (장르) =====
  { name: 'genre_romance', category: 'genre', displayName: '로맨스', keywords: ['로맨스', '연애', '러브', '사랑', '멜로'], questions: ['연애/사랑이 중심 스토리인가요?'] },
  { name: 'genre_rofan', category: 'genre', displayName: '로맨스판타지', keywords: ['로판', '로맨스판타지', '로맨스 판타지'], questions: ['로판(로맨스+판타지) 장르인가요?'] },
  { name: 'genre_fantasy', category: 'genre', displayName: '판타지', keywords: ['판타지', '판타지물', '정통판타지', '마법', '용', '드래곤'], questions: ['마법이나 초자연적 요소가 등장하는 판타지인가요?'] },
  { name: 'genre_modern_fantasy', category: 'genre', displayName: '현대판타지', keywords: ['현대판타지', '퓨전판타지'], questions: ['현실 세계에 판타지 요소가 섞인 작품인가요?'] },
  { name: 'genre_action', category: 'genre', displayName: '액션', keywords: ['액션', '전투', '배틀', '싸움', '격투'], questions: ['전투나 배틀 장면이 많은 작품인가요?'] },
  { name: 'genre_martial', category: 'genre', displayName: '무협', keywords: ['무협', '무림', '강호', '무공', '협객', '신무협'], questions: ['무림이나 강호가 배경인 무협물인가요?'] },
  { name: 'genre_mystery', category: 'genre', displayName: '미스터리', keywords: ['미스터리', '추리', '스릴러', '서스펜스', '추리/미스터리/스릴러', '미스터리/오컬트', '사건물'], questions: ['추리나 사건 해결이 핵심인가요?', '스릴러/서스펜스 요소가 강한가요?'] },
  { name: 'genre_horror', category: 'genre', displayName: '호러', keywords: ['호러', '공포', '괴담', '무서운', '공포/괴담'], questions: ['무섭거나 오싹한 분위기의 작품인가요?'] },
  { name: 'genre_sf', category: 'genre', displayName: 'SF', keywords: ['sf', 'SF', '공상과학', '우주', '사이버펑크', 'SF/미래물'], questions: ['우주나 미래가 배경인 SF물인가요?'] },
  { name: 'genre_bl', category: 'genre', displayName: 'BL', keywords: ['bl', 'BL', '보이즈러브', '남남'], questions: ['남성 간의 로맨스(BL)인가요?'] },
  { name: 'genre_gl', category: 'genre', displayName: 'GL', keywords: ['gl', 'GL', '백합', '여여'], questions: ['여성 간의 로맨스(GL/백합)인가요?'] },
  { name: 'genre_drama', category: 'genre', displayName: '드라마', keywords: ['드라마', '막장', '감동'], questions: ['감동적이거나 막장 전개의 드라마인가요?'] },
  { name: 'genre_slice_of_life', category: 'genre', displayName: '일상', keywords: ['일상', '따뜻한', '일상물'], questions: ['잔잔한 일상을 그린 작품인가요?'] },
  { name: 'genre_omegaverse', category: 'genre', displayName: '오메가버스', keywords: ['오메가버스', 'OO버스', '가이드버스'], questions: ['오메가버스 세계관인가요?'] },
  { name: 'genre_sports', category: 'genre', displayName: '스포츠', keywords: ['스포츠물', '스포츠'], questions: ['스포츠가 소재인 작품인가요?'] },

  // ===== Setting (배경) =====
  { name: 'setting_modern', category: 'setting', displayName: '현대', keywords: ['현대', '현대물', '도시'], questions: ['현대 도시가 배경인가요?'] },
  { name: 'setting_western', category: 'setting', displayName: '서양풍', keywords: ['서양풍', '중세', '영주'], questions: ['서양 중세풍 세계가 배경인가요?'] },
  { name: 'setting_isekai', category: 'setting', displayName: '이세계', keywords: ['이세계', '차원이동', '소환', '차원이동/영혼바뀜', '차원이동물'], questions: ['다른 세계로 이동하는 이야기인가요?'] },
  { name: 'setting_academy', category: 'setting', displayName: '학원', keywords: ['학원', '아카데미', '학교', '학생', '학원물', '학원/아카데미', '캠퍼스물', '학원/캠퍼스물', '대학'], questions: ['학교나 아카데미가 주 배경인가요?'] },
  { name: 'setting_game', category: 'setting', displayName: '게임판타지', keywords: ['게임', '시스템', '레벨업', '스탯', '게임물', '게임빙의', '상태창/시스템'], questions: ['레벨업이나 스탯 같은 게임 시스템이 있나요?'] },
  { name: 'setting_palace', category: 'setting', displayName: '궁중', keywords: ['궁중', '황궁', '왕궁', '황실', '왕실', '궁정물', '궁정로맨스'], questions: ['황궁이나 왕궁이 배경인가요?'] },
  { name: 'setting_office', category: 'setting', displayName: '직장', keywords: ['직장', '회사', '오피스', '사무실', 'CEO', '재벌', '사내연애', '경영물', '회사원'], questions: ['회사나 직장이 주 배경인가요?'] },
  { name: 'setting_historical', category: 'setting', displayName: '역사', keywords: ['역사', '사극', '조선', '고려', '시대물', '가상시대물', '실존역사물', '대체역사'], questions: ['조선이나 고려 같은 역사적 배경인가요?', '사극풍 이야기인가요?'] },
  { name: 'setting_oriental', category: 'setting', displayName: '동양풍', keywords: ['동양풍'], questions: ['동양풍 세계관인가요?'] },
  { name: 'setting_apocalypse', category: 'setting', displayName: '아포칼립스', keywords: ['아포칼립스', '좀비', '종말'], questions: ['세계가 멸망하거나 종말 이후의 이야기인가요?'] },
  { name: 'setting_tower', category: 'setting', displayName: '타워/헌터', keywords: ['타워', '탑', '헌터', '던전', '헌터물', '탑등반물', '레이드물', '성좌물', '게이트'], questions: ['헌터물이나 타워/던전 공략 이야기인가요?'] },
  { name: 'setting_entertainment', category: 'setting', displayName: '연예계', keywords: ['연예계', '연예계물', '아이돌', '연예인', '배우', '매니저'], questions: ['아이돌이나 연예인이 등장하나요?'] },
  { name: 'setting_military', category: 'setting', displayName: '군대', keywords: ['군대물', '군인', '전쟁물'], questions: ['군인이 주인공이거나 전쟁이 배경인가요?'] },
  { name: 'setting_professional', category: 'setting', displayName: '전문직', keywords: ['직업물', '전문직', '전문직물', '경찰/형사/수사관', '법조계', '의사/의원'], questions: ['경찰, 의사, 변호사 같은 전문직이 소재인가요?'] },
  { name: 'setting_mythology', category: 'setting', displayName: '신화', keywords: ['신화', '신화물'], questions: ['신화가 소재인 작품인가요?'] },

  // ===== Protagonist (주인공 아키타입) =====
  { name: 'protag_female', category: 'protagonist', displayName: '여주인공', keywords: ['여주', '여주인공', '여성 주인공', '여주중심'], questions: ['주인공이 여성인가요?'] },
  { name: 'protag_male', category: 'protagonist', displayName: '남주인공', keywords: ['남주', '남주인공', '남성 주인공'], questions: ['주인공이 남성인가요?'] },
  { name: 'protag_regressor', category: 'protagonist', displayName: '회귀', keywords: ['회귀', '리그레서', '회귀물', '회귀/타임슬립'], questions: ['주인공이 과거로 회귀하나요?'] },
  { name: 'protag_reincarnator', category: 'protagonist', displayName: '환생', keywords: ['환생', '전생', '다시 태어난', '전생/환생', '환생물'], questions: ['주인공이 환생하거나 전생의 기억이 있나요?'] },
  { name: 'protag_transmigrator', category: 'protagonist', displayName: '빙의', keywords: ['빙의', '빙의물', '몸 바꿈', '영혼체인지/빙의'], questions: ['주인공이 다른 사람의 몸에 빙의하나요?'] },
  { name: 'protag_op', category: 'protagonist', displayName: '먼치킨', keywords: ['먼치킨', '사기캐', 'op', '최강', '무적', '천재'], questions: ['주인공이 압도적으로 강한 먼치킨인가요?'] },
  { name: 'protag_villain', category: 'protagonist', displayName: '악역', keywords: ['악역', '악녀', '빌런', '흑막', '빌런캐'], questions: ['주인공이 악역이나 빌런인가요?'] },
  { name: 'protag_side_character', category: 'protagonist', displayName: '조연', keywords: ['조연', '엑스트라', '단역'], questions: ['주인공이 원작의 조연이나 엑스트라인가요?'] },
  { name: 'protag_commoner', category: 'protagonist', displayName: '평민', keywords: ['평민', '서민', '노비', '신데렐라'], questions: ['주인공이 평민이나 서민 출신인가요?'] },
  { name: 'protag_noble', category: 'protagonist', displayName: '귀족', keywords: ['귀족', '공작', '백작', '영애', '공녀', '왕족/귀족'], questions: ['주인공이 귀족이나 왕족인가요?'] },

  // ===== Character (캐릭터 성격/특성) =====
  { name: 'char_obsessive', category: 'character', displayName: '집착캐', keywords: ['집착남', '집착공', '집착녀', '집착', '소유욕/독점욕/질투', '광공', '소유욕'], questions: ['소유욕이 강하거나 집착하는 캐릭터가 있나요?'] },
  { name: 'char_warm', category: 'character', displayName: '다정/순정캐', keywords: ['다정남', '다정녀', '다정공', '다정수', '다정', '순정남', '순정녀', '순정공', '순정수', '순정', '헌신공', '헌신수', '헌신', '희생캐'], questions: ['다정하거나 한결같이 상대를 위하는 캐릭터가 있나요?'] },
  { name: 'char_cold', category: 'character', displayName: '차가운캐', keywords: ['냉정남', '냉정녀', '냉혈공', '냉혈수', '냉정', '무심남', '무심녀', '무심공', '무심수', '무심', '까칠남', '까칠공', '까칠녀', '까칠수', '까칠', '오만남'], questions: ['차갑거나 까칠한 성격의 캐릭터가 있나요?'] },
  { name: 'char_schemer', category: 'character', displayName: '계략캐', keywords: ['계략남', '계략녀', '계략수', '복흑/계략공', '계략캐', '계략', '능글남', '능글공', '능글녀', '능글'], questions: ['계략을 꾸미거나 두뇌파 캐릭터가 있나요?'] },
  { name: 'char_tsundere', category: 'character', displayName: '츤데레', keywords: ['츤데레남', '츤데레공', '츤데레수', '츤데레'], questions: ['겉으로는 차갑지만 속은 따뜻한 츤데레 캐릭터가 있나요?'] },
  { name: 'char_innocent', category: 'character', displayName: '순수캐', keywords: ['순진녀', '순진수', '순진공', '순진', '순수', '천진난만'], questions: ['순수하고 순진한 캐릭터가 있나요?'] },

  // ===== Tone (분위기) =====
  { name: 'tone_serious', category: 'tone', displayName: '진지', keywords: ['진지', '시리어스', '무거운', '시리어스물'], questions: ['시리어스하고 무거운 분위기인가요?'] },
  { name: 'tone_comedy', category: 'tone', displayName: '코믹', keywords: ['코믹', '코미디', '개그', '웃긴', '유머', '코믹/개그물'], questions: ['개그/코미디 요소가 많은가요?'] },
  { name: 'tone_dark', category: 'tone', displayName: '다크', keywords: ['다크', '암울', '잔혹', '고어', '피폐물', '하드코어', '느와르'], questions: ['암울하거나 잔혹한 분위기인가요?'] },
  { name: 'tone_fluff', category: 'tone', displayName: '달달', keywords: ['달달', '플러피', '설렘', '두근', '달달물'], questions: ['달달하고 설레는 분위기인가요?'] },
  { name: 'tone_angst', category: 'tone', displayName: '비극', keywords: ['앙스트', '눈물', '슬픔', '비극', '애잔물', '애절물', '신파'], questions: ['슬프거나 눈물 나는 전개가 있나요?'] },
  { name: 'tone_slow_burn', category: 'tone', displayName: '슬로우번', keywords: ['슬로우번', '천천히', '느린 전개'], questions: ['전개가 천천히 진행되는 슬로우번인가요?'] },
  { name: 'tone_healing', category: 'tone', displayName: '힐링', keywords: ['힐링', '힐링물', '잔잔물'], questions: ['잔잔하고 마음이 따뜻해지는 힐링물인가요?'] },
  { name: 'tone_satisfying', category: 'tone', displayName: '사이다', keywords: ['사이다물', '사이다남', '사이다녀', '권선징악'], questions: ['속이 시원해지는 사이다 전개가 있나요?'] },

  // ===== Theme (테마) =====
  { name: 'theme_revenge', category: 'theme', displayName: '복수', keywords: ['복수', '복수극', '앙갚음'], questions: ['복수가 핵심 동기인 이야기인가요?'] },
  { name: 'theme_growth', category: 'theme', displayName: '성장', keywords: ['성장', '성장물', '발전'], questions: ['주인공의 성장 과정이 중요한가요?'] },
  { name: 'theme_family', category: 'theme', displayName: '가족', keywords: ['가족', '육아', '자녀', '육아물'], questions: ['가족이나 육아가 중요한 테마인가요?'] },
  { name: 'theme_contract', category: 'theme', displayName: '계약', keywords: ['계약', '계약결혼', '계약 결혼', '가짜 연인', '계약연애/결혼'], questions: ['계약 결혼이나 가짜 연인 설정이 있나요?'] },
  { name: 'theme_secret', category: 'theme', displayName: '비밀/정체숨김', keywords: ['비밀', '정체', '숨김', '가면', '비밀신분'], questions: ['정체를 숨기거나 비밀이 있는 설정인가요?'] },
  { name: 'theme_misunderstanding', category: 'theme', displayName: '오해', keywords: ['오해', '착각', '엇갈림', '오해/착각', '착각물', '삽질물'], questions: ['오해나 착각 때문에 엇갈리는 이야기인가요?'] },
  { name: 'theme_redemption', category: 'theme', displayName: '구원', keywords: ['구원', '치유', '위로'], questions: ['서로를 구원하거나 치유하는 이야기인가요?'] },
  { name: 'theme_survival', category: 'theme', displayName: '생존', keywords: ['생존', '서바이벌', '살아남기', '생존물'], questions: ['살아남는 것이 핵심인 서바이벌물인가요?'] },
  { name: 'theme_first_love', category: 'theme', displayName: '첫사랑', keywords: ['첫사랑'], questions: ['첫사랑이 중요한 소재인가요?'] },
  { name: 'theme_reunion', category: 'theme', displayName: '재회', keywords: ['재회', '재회물'], questions: ['헤어졌다가 다시 만나는 재회 이야기인가요?'] },
  { name: 'theme_love_hate', category: 'theme', displayName: '애증', keywords: ['애증'], questions: ['사랑과 증오가 얽힌 관계가 있나요?'] },
  { name: 'theme_status_difference', category: 'theme', displayName: '신분차이', keywords: ['신분차이', '갑을관계', '신분격차'], questions: ['신분 차이나 갑을 관계가 있나요?'] },
  { name: 'theme_friends_to_lovers', category: 'theme', displayName: '친구에서연인', keywords: ['친구>연인', '소꿉친구'], questions: ['친구에서 연인으로 발전하는 관계인가요?'] },
  { name: 'theme_cohabitation', category: 'theme', displayName: '동거', keywords: ['동거', '동거/배우자'], questions: ['함께 사는 동거 설정이 있나요?'] },
  { name: 'theme_forbidden', category: 'theme', displayName: '금단의관계', keywords: ['금단의관계', '비밀연애', '사제지간', '사제관계', '하극상'], questions: ['사제지간이나 하극상 같은 금지된 관계인가요?'] },
  { name: 'theme_arranged_marriage', category: 'theme', displayName: '정략결혼', keywords: ['정략결혼', '정략', '선결혼후연애'], questions: ['정략결혼이나 선결혼후연애 설정인가요?'] },
  { name: 'theme_age_gap', category: 'theme', displayName: '나이차', keywords: ['나이차커플', '나이차이', '연하공', '연하남', '연상수'], questions: ['커플 사이에 나이 차이가 있나요?'] },
  { name: 'theme_love_triangle', category: 'theme', displayName: '삼각관계', keywords: ['삼각관계', '역하렘'], questions: ['삼각관계나 역하렘 요소가 있나요?'] },
  { name: 'theme_amnesia', category: 'theme', displayName: '기억상실', keywords: ['기억상실'], questions: ['기억을 잃는 설정이 있나요?'] },
  { name: 'theme_unrequited', category: 'theme', displayName: '짝사랑', keywords: ['짝사랑', '짝사랑남', '짝사랑녀', '짝사랑공', '짝사랑수'], questions: ['짝사랑 요소가 있나요?'] },
  { name: 'theme_crossdressing', category: 'theme', displayName: '남장여자', keywords: ['남장여자', '여공남수'], questions: ['남장여자나 여공남수 설정이 있나요?'] },
];

export class FeatureExtractor {
  private featureMap: Map<string, FeatureDefinition>;

  constructor() {
    this.featureMap = new Map();
    for (const def of FEATURE_DEFINITIONS) {
      this.featureMap.set(def.name, def);
    }
  }

  extractFromKeywords(keywords: string[]): FeatureCandidate[] {
    const candidates: FeatureCandidate[] = [];
    const foundFeatures = new Set<string>();

    for (const keyword of keywords) {
      const normalizedKeyword = keyword.toLowerCase().trim();

      for (const def of FEATURE_DEFINITIONS) {
        if (foundFeatures.has(def.name)) continue;

        for (const kw of def.keywords) {
          if (
            normalizedKeyword === kw.toLowerCase() ||
            normalizedKeyword.includes(kw.toLowerCase())
          ) {
            foundFeatures.add(def.name);
            candidates.push({
              featureName: def.name,
              source: 'keyword',
              confidence: CONFIDENCE.POSITIVE,
            });
            break;
          }
        }
      }
    }

    return candidates;
  }

  extractFromDescription(description: string): FeatureCandidate[] {
    const candidates: FeatureCandidate[] = [];
    const foundFeatures = new Set<string>();
    const normalizedDesc = description.toLowerCase();

    for (const def of FEATURE_DEFINITIONS) {
      if (foundFeatures.has(def.name)) continue;

      let matchCount = 0;
      for (const kw of def.keywords) {
        if (normalizedDesc.includes(kw.toLowerCase())) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        foundFeatures.add(def.name);
        candidates.push({
          featureName: def.name,
          source: 'description',
          confidence: CONFIDENCE.PROBABLE,
        });
      }
    }

    return candidates;
  }

  extractFromTags(tags: string[]): FeatureCandidate[] {
    const candidates: FeatureCandidate[] = [];
    const foundFeatures = new Set<string>();

    for (const tag of tags) {
      const normalized = tag.toLowerCase().trim();

      for (const def of FEATURE_DEFINITIONS) {
        if (foundFeatures.has(def.name)) continue;
        for (const kw of def.keywords) {
          if (normalized === kw.toLowerCase() || normalized.includes(kw.toLowerCase())) {
            foundFeatures.add(def.name);
            candidates.push({
              featureName: def.name,
              source: 'enrichment_keyword',
              confidence: CONFIDENCE.POSITIVE,
            });
            break;
          }
        }
      }
    }

    return candidates;
  }

  extractNegativeFromTags(negativeTags: string[]): FeatureCandidate[] {
    const candidates: FeatureCandidate[] = [];
    const foundFeatures = new Set<string>();

    for (const tag of negativeTags) {
      const normalized = tag.toLowerCase().trim();

      for (const def of FEATURE_DEFINITIONS) {
        if (foundFeatures.has(def.name)) continue;
        for (const kw of def.keywords) {
          if (normalized === kw.toLowerCase() || normalized.includes(kw.toLowerCase())) {
            foundFeatures.add(def.name);
            candidates.push({
              featureName: def.name,
              source: 'enrichment_negative',
              confidence: CONFIDENCE.NEGATIVE,
            });
            break;
          }
        }
      }
    }

    return candidates;
  }

  private mergeCandidates(sources: FeatureCandidate[][]): FeatureCandidate[] {
    const bestByFeature = new Map<string, FeatureCandidate>();
    const negatives = new Set<string>();

    for (const candidates of sources) {
      for (const c of candidates) {
        if (c.source === 'enrichment_negative') {
          negatives.add(c.featureName);
          bestByFeature.set(c.featureName, c);
          continue;
        }
        if (negatives.has(c.featureName)) continue;
        const existing = bestByFeature.get(c.featureName);
        if (!existing || c.confidence > existing.confidence) {
          bestByFeature.set(c.featureName, c);
        }
      }
    }

    return [...bestByFeature.values()];
  }

  async extract(parseResultId: number): Promise<{
    runId: number;
    candidates: FeatureCandidate[];
  }> {
    const parseResult = await db
      .selectFrom('raw_work_parse_results')
      .selectAll()
      .where('id', '=', parseResultId)
      .executeTakeFirst();

    if (!parseResult) {
      throw new Error(`Parse result ${parseResultId} not found`);
    }

    // Create run
    const run = await db
      .insertInto('refined_work_feature_runs')
      .values({
        raw_parse_id: parseResultId,
        status: 'pending',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const candidateSources: FeatureCandidate[][] = [];

    // 1. Ridi keywords
    if (parseResult.keywords) {
      candidateSources.push(this.extractFromKeywords(parseResult.keywords));
    }

    // 2. Ridi description
    if (parseResult.description) {
      candidateSources.push(this.extractFromDescription(parseResult.description));
    }

    // 3. Enrichment data
    const enrichments = await db
      .selectFrom('raw_work_enrichments')
      .selectAll()
      .where('external_id', '=', parseResult.external_id)
      .execute();

    for (const enrichment of enrichments) {
      if (enrichment.tags) {
        candidateSources.push(this.extractFromTags(enrichment.tags));
      }
      if (enrichment.negative_tags) {
        candidateSources.push(this.extractNegativeFromTags(enrichment.negative_tags));
      }
    }

    // Merge: keep highest confidence per feature
    const allCandidates = this.mergeCandidates(candidateSources);

    // Save candidates
    if (allCandidates.length > 0) {
      await db
        .insertInto('refined_work_feature_candidates')
        .values(
          allCandidates.map((c) => ({
            run_id: run.id,
            feature_name: c.featureName,
            source: c.source,
            confidence: c.confidence,
          }))
        )
        .execute();
    }

    // Update run status
    await db
      .updateTable('refined_work_feature_runs')
      .set({
        status: 'completed',
        finished_at: new Date(),
      })
      .where('id', '=', run.id)
      .execute();

    const enrichmentCount = enrichments.length;
    console.log(
      `Extracted ${allCandidates.length} features for parse result ${parseResultId}` +
      (enrichmentCount > 0 ? ` (with ${enrichmentCount} enrichment(s))` : '')
    );

    return { runId: run.id, candidates: allCandidates };
  }

  getFeatureDefinitions(): FeatureDefinition[] {
    return FEATURE_DEFINITIONS;
  }

  getFeatureByName(name: string): FeatureDefinition | undefined {
    return this.featureMap.get(name);
  }
}
