import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Raw Zone

  await db.schema
    .createTable('raw_list_items')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('platform', 'varchar(50)', (col) => col.notNull())
    .addColumn('list_type', 'varchar(50)', (col) => col.notNull())
    .addColumn('external_id', 'varchar(100)', (col) => col.notNull())
    .addColumn('title', 'varchar(255)')
    .addColumn('author', 'varchar(255)')
    .addColumn('crawled_at', 'timestamp', (col) =>
      col.defaultTo(sql`NOW()`).notNull()
    )
    .addUniqueConstraint('raw_list_items_platform_external_id_unique', [
      'platform',
      'external_id',
    ])
    .execute();

  await db.schema
    .createTable('raw_work_pages')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('platform', 'varchar(50)', (col) => col.notNull())
    .addColumn('external_id', 'varchar(100)', (col) => col.notNull())
    .addColumn('url', 'text', (col) => col.notNull())
    .addColumn('html_content', 'text', (col) => col.notNull())
    .addColumn('crawled_at', 'timestamp', (col) =>
      col.defaultTo(sql`NOW()`).notNull()
    )
    .addUniqueConstraint('raw_work_pages_platform_external_id_unique', [
      'platform',
      'external_id',
    ])
    .execute();

  await db.schema
    .createTable('raw_work_parse_results')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('raw_page_id', 'integer', (col) =>
      col.references('raw_work_pages.id').onDelete('cascade').notNull()
    )
    .addColumn('external_id', 'varchar(100)', (col) => col.notNull())
    .addColumn('title', 'varchar(255)')
    .addColumn('author', 'varchar(255)')
    .addColumn('description', 'text')
    .addColumn('keywords', sql`text[]`)
    .addColumn('episode_count', 'integer')
    .addColumn('cover_image_url', 'text')
    .addColumn('introduction_images', sql`text[]`)
    .addColumn('parsed_at', 'timestamp', (col) =>
      col.defaultTo(sql`NOW()`).notNull()
    )
    .execute();

  // Refined Zone

  await db.schema
    .createTable('refined_work_feature_runs')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('raw_parse_id', 'integer', (col) =>
      col.references('raw_work_parse_results.id').onDelete('cascade').notNull()
    )
    .addColumn('status', 'varchar(20)', (col) =>
      col.defaultTo('pending').notNull()
    )
    .addColumn('started_at', 'timestamp', (col) =>
      col.defaultTo(sql`NOW()`).notNull()
    )
    .addColumn('finished_at', 'timestamp')
    .execute();

  await db.schema
    .createTable('refined_work_feature_candidates')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('run_id', 'integer', (col) =>
      col.references('refined_work_feature_runs.id').onDelete('cascade').notNull()
    )
    .addColumn('feature_name', 'varchar(100)', (col) => col.notNull())
    .addColumn('source', 'varchar(50)')
    .addColumn('confidence', sql`decimal(3,2)`)
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`NOW()`).notNull()
    )
    .execute();

  await db.schema
    .createTable('refined_work_feature_rejections')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('run_id', 'integer', (col) =>
      col.references('refined_work_feature_runs.id').onDelete('cascade').notNull()
    )
    .addColumn('feature_name', 'varchar(100)')
    .addColumn('rejection_reason', 'varchar(50)')
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`NOW()`).notNull()
    )
    .execute();

  // Serving Zone

  await db.schema
    .createTable('works')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('title', 'varchar(255)', (col) => col.notNull())
    .addColumn('author', 'varchar(255)')
    .addColumn('platform', 'varchar(50)')
    .addColumn('external_id', 'varchar(100)')
    .addColumn('thumbnail_url', 'text')
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`NOW()`).notNull()
    )
    .addColumn('updated_at', 'timestamp', (col) =>
      col.defaultTo(sql`NOW()`).notNull()
    )
    .addUniqueConstraint('works_platform_external_id_unique', [
      'platform',
      'external_id',
    ])
    .execute();

  await db.schema
    .createTable('features')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar(100)', (col) => col.notNull().unique())
    .addColumn('category', 'varchar(50)', (col) => col.notNull())
    .addColumn('display_name', 'varchar(100)', (col) => col.notNull())
    .addColumn('mutual_exclusive_group', 'varchar(50)')
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`NOW()`).notNull()
    )
    .execute();

  await db.schema
    .createTable('work_features')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('work_id', 'integer', (col) =>
      col.references('works.id').onDelete('cascade').notNull()
    )
    .addColumn('feature_id', 'integer', (col) =>
      col.references('features.id').onDelete('cascade').notNull()
    )
    .addColumn('confidence', sql`decimal(3,2)`, (col) =>
      col.defaultTo(1.0).notNull()
    )
    .addUniqueConstraint('work_features_work_id_feature_id_unique', [
      'work_id',
      'feature_id',
    ])
    .execute();

  // Indexes
  await db.schema
    .createIndex('idx_raw_list_items_external_id')
    .on('raw_list_items')
    .column('external_id')
    .execute();

  await db.schema
    .createIndex('idx_raw_work_pages_platform')
    .on('raw_work_pages')
    .column('platform')
    .execute();

  await db.schema
    .createIndex('idx_raw_work_parse_results_external_id')
    .on('raw_work_parse_results')
    .column('external_id')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('work_features').ifExists().execute();
  await db.schema.dropTable('features').ifExists().execute();
  await db.schema.dropTable('works').ifExists().execute();
  await db.schema.dropTable('refined_work_feature_rejections').ifExists().execute();
  await db.schema.dropTable('refined_work_feature_candidates').ifExists().execute();
  await db.schema.dropTable('refined_work_feature_runs').ifExists().execute();
  await db.schema.dropTable('raw_work_parse_results').ifExists().execute();
  await db.schema.dropTable('raw_work_pages').ifExists().execute();
  await db.schema.dropTable('raw_list_items').ifExists().execute();
}
