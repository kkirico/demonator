import { z } from 'zod';

export const PlatformSchema = z.enum(['ridi']);
export type Platform = z.infer<typeof PlatformSchema>;

export const ListTypeSchema = z.enum(['bestseller', 'new', 'genre']);
export type ListType = z.infer<typeof ListTypeSchema>;

export const RawListItemSchema = z.object({
  id: z.number(),
  platform: PlatformSchema,
  listType: z.string(),
  externalId: z.string(),
  crawledAt: z.date(),
});
export type RawListItem = z.infer<typeof RawListItemSchema>;

export const RawWorkPageSchema = z.object({
  id: z.number(),
  platform: PlatformSchema,
  externalId: z.string(),
  url: z.string().url(),
  htmlContent: z.string(),
  crawledAt: z.date(),
});
export type RawWorkPage = z.infer<typeof RawWorkPageSchema>;

export const RawWorkParseResultSchema = z.object({
  id: z.number(),
  rawPageId: z.number(),
  title: z.string().nullable(),
  author: z.string().nullable(),
  description: z.string().nullable(),
  keywords: z.array(z.string()).nullable(),
  episodeCount: z.number().nullable(),
  coverImageUrl: z.string().nullable(),
  introductionImages: z.array(z.string()).nullable(),
  parsedAt: z.date(),
});
export type RawWorkParseResult = z.infer<typeof RawWorkParseResultSchema>;

export const ParsedWorkDataSchema = z.object({
  title: z.string(),
  author: z.string().optional(),
  description: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  episodeCount: z.number().optional(),
  coverImageUrl: z.string().optional(),
  introductionImages: z.array(z.string()).default([]),
});
export type ParsedWorkData = z.infer<typeof ParsedWorkDataSchema>;
