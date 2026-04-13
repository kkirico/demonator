import { db } from '../database/kysely';
import { FeatureExtractor } from './feature-extractor';
import { FeatureRefiner } from './feature-refiner';

export interface PublishResult {
  workId: number;
  featuresAdded: number;
  isNew: boolean;
}

export class Publisher {
  private featureExtractor: FeatureExtractor;
  private featureRefiner: FeatureRefiner;

  constructor() {
    this.featureExtractor = new FeatureExtractor();
    this.featureRefiner = new FeatureRefiner();
  }

  async ensureFeatures(): Promise<void> {
    const definitions = this.featureExtractor.getFeatureDefinitions();

    for (const def of definitions) {
      const existing = await db
        .selectFrom('features')
        .select('id')
        .where('name', '=', def.name)
        .executeTakeFirst();

      if (!existing) {
        await db
          .insertInto('features')
          .values({
            name: def.name,
            category: def.category,
            display_name: def.displayName,
            keywords: def.keywords,
            questions: def.questions ?? [],
            mutual_exclusive_group: def.mutualExclusiveGroup ?? null,
          })
          .execute();

        console.log(`Created feature: ${def.name}`);
      } else {
        await db
          .updateTable('features')
          .set({
            keywords: def.keywords,
            questions: def.questions ?? [],
          })
          .where('name', '=', def.name)
          .execute();
      }
    }
  }

  async publishWork(parseResultId: number): Promise<PublishResult | null> {
    // raw_work_parse_results에 external_id가 있고, platform은 raw_work_pages에서 가져옴
    const parseResult = await db
      .selectFrom('raw_work_parse_results')
      .innerJoin('raw_work_pages', 'raw_work_pages.id', 'raw_work_parse_results.raw_page_id')
      .select([
        'raw_work_parse_results.id as parse_id',
        'raw_work_parse_results.external_id',
        'raw_work_parse_results.title',
        'raw_work_parse_results.author',
        'raw_work_parse_results.cover_image_url',
        'raw_work_pages.platform',
      ])
      .where('raw_work_parse_results.id', '=', parseResultId)
      .executeTakeFirst();

    if (!parseResult || !parseResult.title) {
      console.log(`Parse result ${parseResultId} not found or has no title`);
      return null;
    }

    // Extract and refine features
    const { runId } = await this.featureExtractor.extract(parseResultId);
    await this.featureRefiner.refine(runId);
    const acceptedFeatures = await this.featureRefiner.getAcceptedFeatures(runId);

    let workId: number;
    let isNew = false;

    const existingWork = await db
      .selectFrom('works')
      .select('id')
      .where('platform', '=', parseResult.platform)
      .where('external_id', '=', parseResult.external_id)
      .executeTakeFirst();

    if (existingWork) {
      workId = existingWork.id;
      await db
        .updateTable('works')
        .set({
          title: parseResult.title,
          author: parseResult.author,
          thumbnail_url: parseResult.cover_image_url,
          updated_at: new Date(),
        })
        .where('id', '=', workId)
        .execute();
    } else {
      const newWork = await db
        .insertInto('works')
        .values({
          title: parseResult.title,
          author: parseResult.author,
          platform: parseResult.platform,
          external_id: parseResult.external_id,
          thumbnail_url: parseResult.cover_image_url,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      workId = newWork.id;
      isNew = true;
    }

    // Update work_features
    const featureNames = acceptedFeatures.map((f) => f.featureName);
    let featuresAdded = 0;

    if (featureNames.length > 0) {
      const features = await db
        .selectFrom('features')
        .select(['id', 'name'])
        .where('name', 'in', featureNames)
        .execute();

      const featureIdMap = new Map(features.map((f) => [f.name, f.id]));

      // Delete existing and re-insert
      await db.deleteFrom('work_features').where('work_id', '=', workId).execute();

      const workFeatures = acceptedFeatures
        .filter((f) => featureIdMap.has(f.featureName))
        .map((f) => ({
          work_id: workId,
          feature_id: featureIdMap.get(f.featureName)!,
          confidence: f.confidence,
        }));

      if (workFeatures.length > 0) {
        await db.insertInto('work_features').values(workFeatures).execute();
        featuresAdded = workFeatures.length;
      }
    }

    console.log(
      `Published work ${workId} (${isNew ? 'new' : 'updated'}): "${parseResult.title}" with ${featuresAdded} features`
    );

    return { workId, featuresAdded, isNew };
  }

  async publishAll(platform: string): Promise<{ published: number; skipped: number }> {
    await this.ensureFeatures();

    const parseResults = await db
      .selectFrom('raw_work_parse_results')
      .innerJoin('raw_work_pages', 'raw_work_pages.id', 'raw_work_parse_results.raw_page_id')
      .select('raw_work_parse_results.id')
      .where('raw_work_pages.platform', '=', platform)
      .where('raw_work_parse_results.title', 'is not', null)
      .execute();

    let published = 0;
    let skipped = 0;

    for (const result of parseResults) {
      try {
        const publishResult = await this.publishWork(result.id);
        if (publishResult) {
          published++;
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`Failed to publish parse result ${result.id}:`, error);
        skipped++;
      }
    }

    return { published, skipped };
  }

  async getPublishStats(platform: string): Promise<{
    totalParsed: number;
    totalPublished: number;
    unpublished: number;
  }> {
    const [parsed, published] = await Promise.all([
      db
        .selectFrom('raw_work_parse_results')
        .innerJoin('raw_work_pages', 'raw_work_pages.id', 'raw_work_parse_results.raw_page_id')
        .where('raw_work_pages.platform', '=', platform)
        .select((eb) => eb.fn.countAll().as('count'))
        .executeTakeFirst(),
      db
        .selectFrom('works')
        .where('platform', '=', platform)
        .select((eb) => eb.fn.countAll().as('count'))
        .executeTakeFirst(),
    ]);

    const totalParsed = Number(parsed?.count ?? 0);
    const totalPublished = Number(published?.count ?? 0);

    return {
      totalParsed,
      totalPublished,
      unpublished: totalParsed - totalPublished,
    };
  }
}
