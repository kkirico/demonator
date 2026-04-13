import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('features')
    .addColumn('keywords', sql`text[]`)
    .execute();

  await db.schema
    .alterTable('features')
    .addColumn('questions', sql`text[]`)
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('features').dropColumn('keywords').execute();
  await db.schema.alterTable('features').dropColumn('questions').execute();
}
