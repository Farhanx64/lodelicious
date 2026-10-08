import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`orders\` ADD \`emails_confirmation_sent_at\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`emails_staff_notified_at\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`emails_unknown_notified_at\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`emails_attention_notified_at\` text;`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`emails_confirmation_sent_at\` text;`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`emails_staff_notified_at\` text;`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`emails_unknown_notified_at\` text;`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`emails_attention_notified_at\` text;`)
  await db.run(sql`ALTER TABLE \`inquiries\` ADD \`emails_confirmation_sent_at\` text;`)
  await db.run(sql`ALTER TABLE \`inquiries\` ADD \`emails_staff_notified_at\` text;`)
  await db.run(sql`ALTER TABLE \`store_settings\` ADD \`notification_email\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`emails_confirmation_sent_at\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`emails_staff_notified_at\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`emails_unknown_notified_at\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`emails_attention_notified_at\`;`)
  await db.run(sql`ALTER TABLE \`reservations\` DROP COLUMN \`emails_confirmation_sent_at\`;`)
  await db.run(sql`ALTER TABLE \`reservations\` DROP COLUMN \`emails_staff_notified_at\`;`)
  await db.run(sql`ALTER TABLE \`reservations\` DROP COLUMN \`emails_unknown_notified_at\`;`)
  await db.run(sql`ALTER TABLE \`reservations\` DROP COLUMN \`emails_attention_notified_at\`;`)
  await db.run(sql`ALTER TABLE \`inquiries\` DROP COLUMN \`emails_confirmation_sent_at\`;`)
  await db.run(sql`ALTER TABLE \`inquiries\` DROP COLUMN \`emails_staff_notified_at\`;`)
  await db.run(sql`ALTER TABLE \`store_settings\` DROP COLUMN \`notification_email\`;`)
}
