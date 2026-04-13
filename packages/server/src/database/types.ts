import type { Generated, Selectable } from 'kysely';

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

export interface Database {
  works: WorksTable;
  features: FeaturesTable;
  work_features: WorkFeaturesTable;
}

export type Work = Selectable<WorksTable>;
export type Feature = Selectable<FeaturesTable>;
export type WorkFeature = Selectable<WorkFeaturesTable>;
