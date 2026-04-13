import type { Generated, Insertable, Selectable, Updateable } from 'kysely';

// Raw Zone Tables

export interface RawListItemsTable {
  id: Generated<number>;
  platform: string;
  list_type: string;
  external_id: string;
  title: string | null;
  author: string | null;
  crawled_at: Generated<Date>;
}

export interface RawWorkPagesTable {
  id: Generated<number>;
  platform: string;
  external_id: string;
  url: string;
  html_content: string;
  crawled_at: Generated<Date>;
}

export interface RawWorkParseResultsTable {
  id: Generated<number>;
  raw_page_id: number;
  external_id: string;
  title: string | null;
  author: string | null;
  description: string | null;
  keywords: string[] | null;
  episode_count: number | null;
  cover_image_url: string | null;
  introduction_images: string[] | null;
  parsed_at: Generated<Date>;
}

// Refined Zone Tables

export interface RefinedWorkFeatureRunsTable {
  id: Generated<number>;
  raw_parse_id: number;
  status: string;
  started_at: Generated<Date>;
  finished_at: Date | null;
}

export interface RefinedWorkFeatureCandidatesTable {
  id: Generated<number>;
  run_id: number;
  feature_name: string;
  source: string | null;
  confidence: number | null;
  created_at: Generated<Date>;
}

export interface RefinedWorkFeatureRejectionsTable {
  id: Generated<number>;
  run_id: number;
  feature_name: string | null;
  rejection_reason: string | null;
  created_at: Generated<Date>;
}

// Serving Zone Tables (read-only from crawler)

export interface WorksTable {
  id: Generated<number>;
  title: string;
  author: string | null;
  platform: string | null;
  external_id: string | null;
  thumbnail_url: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface FeaturesTable {
  id: Generated<number>;
  name: string;
  category: string;
  display_name: string;
  mutual_exclusive_group: string | null;
  created_at: Generated<Date>;
}

export interface WorkFeaturesTable {
  id: Generated<number>;
  work_id: number;
  feature_id: number;
  confidence: number;
}

// Database interface

export interface Database {
  // Raw Zone
  raw_list_items: RawListItemsTable;
  raw_work_pages: RawWorkPagesTable;
  raw_work_parse_results: RawWorkParseResultsTable;

  // Refined Zone
  refined_work_feature_runs: RefinedWorkFeatureRunsTable;
  refined_work_feature_candidates: RefinedWorkFeatureCandidatesTable;
  refined_work_feature_rejections: RefinedWorkFeatureRejectionsTable;

  // Serving Zone
  works: WorksTable;
  features: FeaturesTable;
  work_features: WorkFeaturesTable;
}

// Type helpers
export type RawListItem = Selectable<RawListItemsTable>;
export type NewRawListItem = Insertable<RawListItemsTable>;

export type RawWorkPage = Selectable<RawWorkPagesTable>;
export type NewRawWorkPage = Insertable<RawWorkPagesTable>;

export type RawWorkParseResult = Selectable<RawWorkParseResultsTable>;
export type NewRawWorkParseResult = Insertable<RawWorkParseResultsTable>;

export type Work = Selectable<WorksTable>;
export type NewWork = Insertable<WorksTable>;
