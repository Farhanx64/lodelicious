import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`orders\` ADD \`tracking_carrier\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`tracking_number\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`emails_ready_sent_at\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`emails_shipped_sent_at\` text;`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`emails_ready_sent_at\` text;`)
  // Hand-added (D64): records already Ready for pickup were set before this email existed. Mark them as
  // handled so the send-pending-emails job does not email those customers late.
  await db.run(sql`UPDATE \`orders\` SET \`emails_ready_sent_at\` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE \`fulfillment_status\` = 'ready' AND \`emails_ready_sent_at\` IS NULL;`)
  await db.run(sql`UPDATE \`reservations\` SET \`emails_ready_sent_at\` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE \`reservation_status\` = 'ready' AND \`emails_ready_sent_at\` IS NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`tracking_carrier\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`tracking_number\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`emails_ready_sent_at\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`emails_shipped_sent_at\`;`)
  await db.run(sql`ALTER TABLE \`reservations\` DROP COLUMN \`emails_ready_sent_at\`;`)
}
