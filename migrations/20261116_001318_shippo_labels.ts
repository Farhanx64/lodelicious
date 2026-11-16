import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`orders\` ADD \`shipping_label_shipment_id\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`shipping_label_transaction_id\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`shipping_label_service\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`shipping_label_cost_cents\` numeric;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`shipping_label_label_tracking_number\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`shipping_label_label_url\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`shipping_label_test\` integer;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`shipping_label_bought_at\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_label_shipment_id\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_label_transaction_id\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_label_service\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_label_cost_cents\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_label_label_tracking_number\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_label_label_url\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_label_test\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`shipping_label_bought_at\`;`)
}
