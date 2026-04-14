import { db } from '../database/kysely';
import type { FeatureCandidate, FeatureRejection, FeatureSource, RejectionReason } from '../schemas/refined.schema';

export interface RefinementResult {
  accepted: FeatureCandidate[];
  rejected: FeatureRejection[];
}

export class FeatureRefiner {
  private readonly minConfidence = 0.5;
  private readonly tooCommonFeatures = new Set<string>([
    // Features that are too generic
  ]);
  private readonly ambiguousFeatures = new Set<string>([
    // Features that need manual review
  ]);

  async refine(runId: number): Promise<RefinementResult> {
    const candidates = await db
      .selectFrom('refined_work_feature_candidates')
      .selectAll()
      .where('run_id', '=', runId)
      .execute();

    const accepted: FeatureCandidate[] = [];
    const rejected: FeatureRejection[] = [];

    for (const candidate of candidates) {
      const rejectionReason = this.checkRejection(candidate);

      if (rejectionReason) {
        rejected.push({
          featureName: candidate.feature_name,
          rejectionReason,
        });
      } else {
        accepted.push({
          featureName: candidate.feature_name,
          source: candidate.source as FeatureSource,
          confidence: Number(candidate.confidence ?? 0),
        });
      }
    }

    // Save rejections
    if (rejected.length > 0) {
      await db
        .insertInto('refined_work_feature_rejections')
        .values(
          rejected.map((r) => ({
            run_id: runId,
            feature_name: r.featureName,
            rejection_reason: r.rejectionReason,
          }))
        )
        .execute();
    }

    console.log(
      `Refined run ${runId}: ${accepted.length} accepted, ${rejected.length} rejected`
    );

    return { accepted, rejected };
  }

  private checkRejection(candidate: {
    feature_name: string;
    source: string | null;
    confidence: unknown;
  }): RejectionReason | null {
    if (candidate.source === 'enrichment_negative') {
      return null;
    }

    const confidence = Number(candidate.confidence ?? 0);

    if (confidence < this.minConfidence) {
      return 'low_confidence';
    }

    if (this.tooCommonFeatures.has(candidate.feature_name)) {
      return 'too_common';
    }

    if (this.ambiguousFeatures.has(candidate.feature_name)) {
      return 'ambiguous';
    }

    return null;
  }

  async getAcceptedFeatures(runId: number): Promise<FeatureCandidate[]> {
    const candidates = await db
      .selectFrom('refined_work_feature_candidates')
      .selectAll()
      .where('run_id', '=', runId)
      .execute();

    const rejections = await db
      .selectFrom('refined_work_feature_rejections')
      .select('feature_name')
      .where('run_id', '=', runId)
      .execute();

    const rejectedNames = new Set(rejections.map((r) => r.feature_name));

    return candidates
      .filter((c) => !rejectedNames.has(c.feature_name))
      .map((c) => ({
        featureName: c.feature_name,
        source: c.source as FeatureSource,
        confidence: Number(c.confidence ?? 0),
      }));
  }
}
