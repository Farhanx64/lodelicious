import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`products\` ADD \`online_reserve\` numeric DEFAULT 1;`)
  await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`local_delivery\`;`)
  await db.run(sql`ALTER TABLE \`_products_v\` ADD \`version_online_reserve\` numeric DEFAULT 1;`)
  await db.run(sql`ALTER TABLE \`_products_v\` DROP COLUMN \`version_local_delivery\`;`)
  await db.run(sql`ALTER TABLE \`store_settings\` ADD \`doordash_url\` text;`)
  await db.run(sql`ALTER TABLE \`gift_builder_settings_sizes\` ADD \`enabled\` integer DEFAULT true;`)
  // Lody, 2026-09-30: no Extra Large basket until there is enough variety to fill it (D27).
  await db.run(sql`UPDATE \`gift_builder_settings_sizes\` SET \`enabled\` = false WHERE \`code\` = 'extra_large';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`products\` ADD \`local_delivery\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`online_reserve\`;`)
  await db.run(sql`ALTER TABLE \`_products_v\` ADD \`version_local_delivery\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`_products_v\` DROP COLUMN \`version_online_reserve\`;`)
  await db.run(sql`ALTER TABLE \`store_settings\` DROP COLUMN \`doordash_url\`;`)
  await db.run(sql`ALTER TABLE \`gift_builder_settings_sizes\` DROP COLUMN \`enabled\`;`)
}
