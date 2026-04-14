#!/usr/bin/env node
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { Command } from 'commander';
import { RidiGenre, RidiOrder, RidiListCrawler, type ListItem } from './crawlers/ridi/ridi-list.crawler';
import { RidiCrawler } from './crawlers/ridi/ridi.crawler';
import { RidiParser } from './crawlers/ridi/ridi.parser';
import { ListValidator } from './validators/list-validator';
import { Publisher } from './refiners/publisher';
import { EnrichmentImportSchema } from './schemas/enrichment.schema';
import { closeDb, db } from './database/kysely';

const program = new Command();

program
  .name('demonator-crawler')
  .description('Ridi crawler for demonator')
  .version('1.0.0');

program
  .command('crawl:list')
  .description('Crawl bestseller list pages')
  .requiredOption(
    '-g, --genre <genre>',
    `Genre code (all, ${Object.values(RidiGenre).join(', ')})`
  )
  .option(
    '-o, --order <order>',
    `Order (${Object.values(RidiOrder).join(', ')})`,
    RidiOrder.STEADY
  )
  .option('-p, --page <page>', 'Page number', '1')
  .option('--pages <count>', 'Number of pages to crawl', '1')
  .option('-l, --limit <count>', 'Limit total items per genre (max 60 per page)')
  .action(async (options) => {
    const allGenres = Object.values(RidiGenre) as string[];
    const validGenres = ['all', ...allGenres];
    if (!validGenres.includes(options.genre)) {
      console.error(`Invalid genre: ${options.genre}`);
      console.error(`Valid genres: ${validGenres.join(', ')}`);
      process.exit(1);
    }
    const validOrders = Object.values(RidiOrder) as string[];
    if (!validOrders.includes(options.order)) {
      console.error(`Invalid order: ${options.order}`);
      console.error(`Valid orders: ${validOrders.join(', ')}`);
      process.exit(1);
    }
    const genres: RidiGenre[] = options.genre === 'all'
      ? allGenres as RidiGenre[]
      : [options.genre as RidiGenre];
    const order = options.order as RidiOrder;

    const ITEMS_PER_PAGE = 60;
    const startPage = parseInt(options.page, 10);
    const limit = options.limit ? parseInt(options.limit, 10) : undefined;
    const pageCount = limit
      ? Math.ceil(limit / ITEMS_PER_PAGE)
      : parseInt(options.pages, 10);

    const crawler = new RidiListCrawler();
    await crawler.init();

    try {
      for (const genre of genres) {
        if (genres.length > 1) console.log(`\n=== Genre: ${genre} ===`);

        let collected: ListItem[] = [];

        for (let i = 0; i < pageCount; i++) {
          const page = startPage + i;
          const result = await crawler.crawl({ genre, page, order });
          const items = crawler.parseListItems(result.html);
          collected = collected.concat(items);

          if (limit && collected.length >= limit) break;

          if (i < pageCount - 1) {
            await new Promise((r) => setTimeout(r, 1000));
          }
        }

        if (limit) {
          collected = collected.slice(0, limit);
        }

        await crawler.saveToDb({ genre, page: startPage, order }, collected);
        console.log(`Genre ${genre}: Saved ${collected.length} items`);

        if (genres.length > 1) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    } finally {
      await crawler.close();
      await closeDb();
    }
  });

program
  .command('crawl:detail')
  .description('Crawl work detail pages')
  .option('-i, --id <id>', 'External ID to crawl')
  .option('--new', 'Crawl only new works from list', false)
  .option('--limit <limit>', 'Limit number of works to crawl')
  .action(async (options) => {
    const crawler = new RidiCrawler();
    const parser = new RidiParser();
    await crawler.init();

    try {
      let ids: string[] = [];

      if (options.id) {
        ids = [options.id];
      } else if (options.new) {
        const validator = new ListValidator();
        const result = await validator.findNewWorks('ridi');
        ids = result.newIds;
        console.log(`Found ${ids.length} new works to crawl`);
      }

      if (options.limit) {
        ids = ids.slice(0, parseInt(options.limit, 10));
      }

      let failed = 0;
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        console.log(`[${i + 1}/${ids.length}] Crawling ${id}...`);

        try {
          const result = await crawler.crawl({ externalId: id });
          const pageId = await crawler.saveToDb(id, result);

          const parsed = await parser.parseFromPage(crawler.getPage());
          await parser.saveParseResult(pageId, id, parsed);
        } catch (err) {
          failed++;
          console.error(`Failed ${id}: ${err instanceof Error ? err.message : err}`);
        }

        if (i < ids.length - 1) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      if (failed > 0) console.log(`\nCompleted with ${failed} failures out of ${ids.length}`);
    } finally {
      await crawler.close();
      await closeDb();
    }
  });

program
  .command('validate:list')
  .description('Validate list and find new works')
  .action(async () => {
    const validator = new ListValidator();

    try {
      const result = await validator.findNewWorks('ridi');
      const stats = await validator.getStats('ridi');

      console.log('\n=== Validation Result ===');
      console.log(`Total list items: ${stats.totalListItems}`);
      console.log(`Total work pages: ${stats.totalWorkPages}`);
      console.log(`Parsed: ${stats.totalParsed}`);
      console.log(`Unparsed: ${stats.totalUnparsed}`);
      console.log(`\nNew works to crawl: ${result.newIds.length}`);

      if (result.newIds.length > 0 && result.newIds.length <= 20) {
        console.log('IDs:', result.newIds.join(', '));
      }
    } finally {
      await closeDb();
    }
  });

program
  .command('stats')
  .description('Show crawler statistics')
  .action(async () => {
    const validator = new ListValidator();
    const publisher = new Publisher();

    try {
      const crawlStats = await validator.getStats('ridi');
      const publishStats = await publisher.getPublishStats('ridi');

      console.log('\n=== Crawler Statistics ===');
      console.log('\nRaw Zone:');
      console.log(`  List items: ${crawlStats.totalListItems}`);
      console.log(`  Work pages: ${crawlStats.totalWorkPages}`);
      console.log(`  Parsed: ${crawlStats.totalParsed}`);
      console.log(`  Unparsed: ${crawlStats.totalUnparsed}`);

      console.log('\nServing Zone:');
      console.log(`  Published works: ${publishStats.totalPublished}`);
      console.log(`  Unpublished: ${publishStats.unpublished}`);
    } finally {
      await closeDb();
    }
  });

program
  .command('publish')
  .description('Publish refined data to serving zone')
  .option('--dry-run', 'Show what would be published without actually publishing', false)
  .action(async (options) => {
    const publisher = new Publisher();

    try {
      if (options.dryRun) {
        const stats = await publisher.getPublishStats('ridi');
        console.log(`\nDry run: Would publish ${stats.unpublished} works`);
      } else {
        const result = await publisher.publishAll('ridi');
        console.log(`\nPublished: ${result.published}, Skipped: ${result.skipped}`);
      }
    } finally {
      await closeDb();
    }
  });

program
  .command('pipeline')
  .description('Run full pipeline: crawl list -> crawl details -> publish')
  .requiredOption('-g, --genre <genre>', 'Genre code')
  .option('--pages <count>', 'Number of list pages', '1')
  .option('--limit <limit>', 'Limit detail crawls')
  .action(async (options) => {
    console.log('=== Step 1: Crawl List ===');
    const listCrawler = new RidiListCrawler();
    await listCrawler.init();

    try {
      const pageCount = parseInt(options.pages, 10);
      for (let page = 1; page <= pageCount; page++) {
        const result = await listCrawler.crawl({ genre: options.genre, page });
        const items = listCrawler.parseListItems(result.html);
        await listCrawler.saveToDb({ genre: options.genre, page }, items);
        console.log(`Page ${page}: ${items.length} items`);
        if (page < pageCount) await new Promise((r) => setTimeout(r, 1000));
      }
    } finally {
      await listCrawler.close();
    }

    console.log('\n=== Step 2: Validate & Crawl Details ===');
    const validator = new ListValidator();
    const { newIds } = await validator.findNewWorks('ridi');
    console.log(`Found ${newIds.length} new works`);

    let ids = newIds;
    if (options.limit) {
      ids = ids.slice(0, parseInt(options.limit, 10));
    }

    if (ids.length > 0) {
      const detailCrawler = new RidiCrawler();
      const parser = new RidiParser();
      await detailCrawler.init();

      try {
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i];
          console.log(`[${i + 1}/${ids.length}] ${id}`);
          const result = await detailCrawler.crawl({ externalId: id });
          const pageId = await detailCrawler.saveToDb(id, result);
          const parsed = await parser.parseFromPage(detailCrawler.getPage());
          await parser.saveParseResult(pageId, id, parsed);
          if (i < ids.length - 1) await new Promise((r) => setTimeout(r, 1000));
        }
      } finally {
        await detailCrawler.close();
      }
    }

    console.log('\n=== Step 3: Publish ===');
    const publisher = new Publisher();
    const publishResult = await publisher.publishAll('ridi');
    console.log(`Published: ${publishResult.published}, Skipped: ${publishResult.skipped}`);

    await closeDb();
    console.log('\n=== Pipeline Complete ===');
  });

program
  .command('enrich:list')
  .description('List works that have no enrichment data')
  .option('--limit <limit>', 'Limit number of results')
  .action(async (options) => {
    try {
      const query = db
        .selectFrom('raw_work_parse_results')
        .leftJoin(
          'raw_work_enrichments',
          'raw_work_enrichments.external_id',
          'raw_work_parse_results.external_id'
        )
        .select([
          'raw_work_parse_results.external_id',
          'raw_work_parse_results.title',
          'raw_work_parse_results.author',
          'raw_work_parse_results.keywords',
          db.fn.count('raw_work_enrichments.id').as('enrichment_count'),
        ])
        .where('raw_work_parse_results.title', 'is not', null)
        .groupBy([
          'raw_work_parse_results.external_id',
          'raw_work_parse_results.title',
          'raw_work_parse_results.author',
          'raw_work_parse_results.keywords',
        ])
        .having(db.fn.count('raw_work_enrichments.id'), '=', 0)
        .orderBy('raw_work_parse_results.external_id');

      const results = options.limit
        ? await query.limit(parseInt(options.limit, 10)).execute()
        : await query.execute();

      console.log(`\n=== Works without enrichment: ${results.length} ===\n`);

      for (const r of results) {
        const kwCount = r.keywords?.length ?? 0;
        console.log(
          `  ${r.external_id}  ${r.title}  (${r.author ?? 'unknown'})  keywords: ${kwCount}`
        );
      }

      if (results.length === 0) {
        console.log('  All works have enrichment data.');
      }
    } finally {
      await closeDb();
    }
  });

program
  .command('enrich:import')
  .description('Import enrichment data from JSON file')
  .requiredOption('-f, --file <path>', 'Path to JSON file')
  .action(async (options) => {
    try {
      const raw = await readFile(options.file, 'utf-8');
      const parsed = EnrichmentImportSchema.safeParse(JSON.parse(raw));

      if (!parsed.success) {
        console.error('Validation failed:');
        for (const issue of parsed.error.issues) {
          console.error(`  [${issue.path.join('.')}] ${issue.message}`);
        }
        process.exit(1);
      }

      const { works } = parsed.data;
      let inserted = 0;
      let updated = 0;

      for (const work of works) {
        const exists = await db
          .selectFrom('raw_work_enrichments')
          .select('id')
          .where('external_id', '=', work.external_id)
          .executeTakeFirst();

        const tags = work.tags.length > 0 ? work.tags : null;
        const negativeTags = work.negative_tags.length > 0 ? work.negative_tags : null;

        if (exists) {
          await db
            .updateTable('raw_work_enrichments')
            .set({ tags, negative_tags: negativeTags })
            .where('id', '=', exists.id)
            .execute();
          console.log(`  Updated: ${work.external_id} (${work.tags.length} tags, ${work.negative_tags.length} negative)`);
          updated++;
        } else {
          await db
            .insertInto('raw_work_enrichments')
            .values({ external_id: work.external_id, tags, negative_tags: negativeTags })
            .execute();
          console.log(`  Imported: ${work.external_id} (${work.tags.length} tags, ${work.negative_tags.length} negative)`);
          inserted++;
        }
      }

      console.log(`\nDone: ${inserted} inserted, ${updated} updated`);
    } finally {
      await closeDb();
    }
  });

program.parse();
