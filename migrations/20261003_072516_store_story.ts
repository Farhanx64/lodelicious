import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`store_settings\` ADD \`story_heading\` text DEFAULT 'Our story';`)
  await db.run(sql`ALTER TABLE \`store_settings\` ADD \`story\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`store_settings\` DROP COLUMN \`story_heading\`;`)
  await db.run(sql`ALTER TABLE \`store_settings\` DROP COLUMN \`story\`;`)
}
