import { config } from 'dotenv';
import { resolve } from 'path';
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { Database } from './types';

config({ path: resolve(__dirname, '../../../../.env') });

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});

export async function closeDb(): Promise<void> {
  await db.destroy();
}
