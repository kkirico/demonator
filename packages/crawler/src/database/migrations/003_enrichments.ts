import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('raw_work_enrichments')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('external_id', 'varchar(100)', (col) => col.notNull().unique())
    .addColumn('tags', sql`text[]`)
    .addColumn('negative_tags', sql`text[]`)
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`NOW()`).notNull()
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('raw_work_enrichments').ifExists().execute();
}
