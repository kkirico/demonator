import { Page } from 'playwright';
import { db } from '../../database/kysely';
import type { ParsedWorkData } from '../../schemas/raw.schema';

const NOISE_KEYWORDS = new Set([
  'RIDI_ONLY', '리다무', '웹소설', '웹툰', '연재중',
]);
const STAT_RE = /^(평점|리뷰|별점)\d+/;

export class RidiParser {
  async parseFromPage(page: Page): Promise<ParsedWorkData> {
    const [title, coverImageUrl, author, description, keywords, introductionImages, episodeCount] =
      await Promise.all([
        this.extractTitle(page),
        this.metaContent(page, 'property', 'og:image'),
        this.extractAuthor(page),
        this.extractDescription(page),
        this.extractKeywords(page),
        this.extractIntroductionImages(page),
        this.extractEpisodeCount(page),
      ]);

    return { title, author, description, keywords, episodeCount, coverImageUrl, introductionImages };
  }

  private async metaContent(page: Page, attr: string, value: string): Promise<string | undefined> {
    const el = page.locator(`meta[${attr}="${value}"]`);
    const content = await el.getAttribute('content').catch(() => null);
    return content ?? undefined;
  }

  private async extractTitle(page: Page): Promise<string> {
    const ogTitle = await this.metaContent(page, 'property', 'og:title');
    const raw = ogTitle ?? await page.title();
    return raw.replace(/\s*-\s*리디.*$/, '').replace(/\s+\d+화$/, '').trim();
  }

  private async extractAuthor(page: Page): Promise<string | undefined> {
    const authorLink = page.locator('#ISLANDS__Header li:has-text("저자") a').first();
    if (await authorLink.count() > 0) {
      const text = await authorLink.textContent();
      if (text?.trim()) return text.trim();
    }
    const metaKw = await this.metaContent(page, 'name', 'keywords');
    if (metaKw) {
      const tokens = metaKw.split(',').map((t) => t.trim());
      const idx = tokens.findIndex((t) => t === '저자');
      if (idx > 0) return tokens[idx - 1];
    }
    return undefined;
  }

  private async extractDescription(page: Page): Promise<string | undefined> {
    const heading = page.locator('#ISLANDS__IntroduceTab h2:has-text("작품 소개")').first();
    if (await heading.count() > 0) {
      const text = await heading.locator('~ *').first().textContent().catch(() => null);
      if (text?.trim()) return text.trim();
    }
    const metaDesc = await this.metaContent(page, 'name', 'description');
    if (metaDesc) return metaDesc.replace(/^.+?작품소개:\s*/, '').trim();
    return undefined;
  }

  private async extractKeywords(page: Page): Promise<string[]> {
    const buttons = page.locator('#ISLANDS__Keyword button[aria-label]');
    const count = await buttons.count();
    const tags: string[] = [];
    for (let i = 0; i < count; i++) {
      const label = await buttons.nth(i).getAttribute('aria-label');
      if (label && !NOISE_KEYWORDS.has(label.trim()) && !STAT_RE.test(label.trim())) {
        tags.push(label.trim());
      }
    }
    return tags;
  }

  private async extractIntroductionImages(page: Page): Promise<string[]> {
    const srcs: string[] = [];
    const selectors = ['#ISLANDS__IntroduceTab img', '#ISLANDS__LowerPanelList img'];
    for (const selector of selectors) {
      const imgs = page.locator(selector);
      const count = await imgs.count();
      for (let i = 0; i < count; i++) {
        const img = imgs.nth(i);
        const src = await img.getAttribute('src');
        if (!src || src.startsWith('data:') || src.includes('static.ridicdn.net') || src.includes('/cover/')) {
          continue;
        }
        const isLinked = await img.evaluate(el => !!el.closest('a'));
        if (isLinked) continue;
        srcs.push(src);
      }
    }
    return srcs;
  }

  private async extractEpisodeCount(page: Page): Promise<number | undefined> {
    const headerText = await page.locator('#ISLANDS__Header').textContent().catch(() => null);
    if (headerText) {
      const match = headerText.match(/총\s*([\d,]+)화/);
      if (match) return parseInt(match[1].replace(/,/g, ''), 10);
    }
    return undefined;
  }

  async saveParseResult(rawPageId: number, externalId: string, data: ParsedWorkData): Promise<number> {
    const result = await db
      .insertInto('raw_work_parse_results')
      .values({
        raw_page_id: rawPageId,
        external_id: externalId,
        title: data.title,
        author: data.author ?? null,
        description: data.description ?? null,
        keywords: data.keywords.length > 0 ? data.keywords : null,
        episode_count: data.episodeCount ?? null,
        cover_image_url: data.coverImageUrl ?? null,
        introduction_images:
          data.introductionImages.length > 0 ? data.introductionImages : null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    console.log(`Saved parse result for ${externalId}: "${data.title}"`);
    return result.id;
  }
}
