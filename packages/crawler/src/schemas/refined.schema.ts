import { z } from 'zod';

export const FeatureRunStatusSchema = z.enum(['pending', 'completed', 'failed']);
export type FeatureRunStatus = z.infer<typeof FeatureRunStatusSchema>;

export const FeatureSourceSchema = z.enum(['keyword', 'description', 'ml']);
export type FeatureSource = z.infer<typeof FeatureSourceSchema>;

export const RejectionReasonSchema = z.enum([
  'low_confidence',
  'ambiguous',
  'too_common',
  'invalid',
]);
export type RejectionReason = z.infer<typeof RejectionReasonSchema>;

export const FeatureCategorySchema = z.enum([
  'genre',
  'setting',
  'protagonist',
  'character',
  'tone',
  'theme',
]);
export type FeatureCategory = z.infer<typeof FeatureCategorySchema>;

export const FeatureCandidateSchema = z.object({
  featureName: z.string(),
  source: FeatureSourceSchema,
  confidence: z.number().min(0).max(1),
});
export type FeatureCandidate = z.infer<typeof FeatureCandidateSchema>;

export const FeatureRejectionSchema = z.object({
  featureName: z.string(),
  rejectionReason: RejectionReasonSchema,
});
export type FeatureRejection = z.infer<typeof FeatureRejectionSchema>;

export const FeatureDefinitionSchema = z.object({
  name: z.string(),
  category: FeatureCategorySchema,
  displayName: z.string(),
  keywords: z.array(z.string()),
  questions: z.array(z.string()).optional(),
  mutualExclusiveGroup: z.string().optional(),
});
export type FeatureDefinition = z.infer<typeof FeatureDefinitionSchema>;
