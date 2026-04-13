import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { db } from '../../database/kysely';
import type { Work, Feature, WorkFeature } from '../../database/types';

export interface CachedWork {
  id: number;
  title: string;
  author: string | null;
  thumbnailUrl: string | null;
  platform: string | null;
  externalId: string | null;
}

export interface CachedFeature {
  id: number;
  name: string;
  category: string;
  displayName: string;
}

@Injectable()
export class WorkFeatureCache implements OnModuleInit {
  private readonly logger = new Logger(WorkFeatureCache.name);

  private works: Map<number, CachedWork> = new Map();
  private features: Map<number, CachedFeature> = new Map();
  /** work_id → (feature_id → confidence) */
  private confidenceMap: Map<number, Map<number, number>> = new Map();

  async onModuleInit() {
    await this.load();
  }

  async load(): Promise<void> {
    const [workRows, featureRows, wfRows] = await Promise.all([
      db.selectFrom('works').selectAll().execute(),
      db.selectFrom('features').selectAll().execute(),
      db.selectFrom('work_features').selectAll().execute(),
    ]);

    this.works.clear();
    for (const w of workRows) {
      this.works.set(w.id, {
        id: w.id,
        title: w.title,
        author: w.author,
        thumbnailUrl: w.thumbnail_url,
        platform: w.platform,
        externalId: w.external_id,
      });
    }

    this.features.clear();
    for (const f of featureRows) {
      this.features.set(f.id, {
        id: f.id,
        name: f.name,
        category: f.category,
        displayName: f.display_name,
      });
    }

    this.confidenceMap.clear();
    for (const wf of wfRows) {
      let featureMap = this.confidenceMap.get(wf.work_id);
      if (!featureMap) {
        featureMap = new Map();
        this.confidenceMap.set(wf.work_id, featureMap);
      }
      featureMap.set(wf.feature_id, Number(wf.confidence));
    }

    // Exclude works with zero features
    const worksWithFeatures = new Set(this.confidenceMap.keys());
    for (const workId of [...this.works.keys()]) {
      if (!worksWithFeatures.has(workId)) {
        this.works.delete(workId);
      }
    }

    this.logger.log(
      `Loaded ${this.works.size} works, ${this.features.size} features, ${wfRows.length} work-feature pairs`,
    );
  }

  getAllWorks(): CachedWork[] {
    return [...this.works.values()];
  }

  getAllFeatures(): CachedFeature[] {
    return [...this.features.values()];
  }

  getWork(workId: number): CachedWork | undefined {
    return this.works.get(workId);
  }

  getFeature(featureId: number): CachedFeature | undefined {
    return this.features.get(featureId);
  }

  getAllWorkIds(): number[] {
    return [...this.works.keys()];
  }

  getAllFeatureIds(): number[] {
    return [...this.features.keys()];
  }

  getConfidence(workId: number, featureId: number): number {
    return this.confidenceMap.get(workId)?.get(featureId) ?? DEFAULT_ABSENT;
  }

  getWorkFeatureMap(workId: number): Map<number, number> | undefined {
    return this.confidenceMap.get(workId);
  }
}

export const DEFAULT_ABSENT = 0.05;
