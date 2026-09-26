import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`gift_builder_settings_count_overrides\` ADD \`basket_size_in\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`gift_builder_settings_count_overrides\` DROP COLUMN \`basket_size_in\`;`)
}
