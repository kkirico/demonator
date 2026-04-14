import { z } from 'zod';

export const EnrichmentWorkSchema = z.object({
  external_id: z.string(),
  title: z.string().optional(),
  tags: z.array(z.string()).default([]),
  negative_tags: z.array(z.string()).default([]),
});
export type EnrichmentWork = z.infer<typeof EnrichmentWorkSchema>;

export const EnrichmentImportSchema = z.object({
  works: z.array(EnrichmentWorkSchema).min(1),
});
export type EnrichmentImport = z.infer<typeof EnrichmentImportSchema>;
