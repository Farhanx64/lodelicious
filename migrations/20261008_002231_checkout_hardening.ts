import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Checkout hardening (D42). The only change to the tables is the new `payment_attempts` column.
 * Payload's generator also proposed rebuilding `orders` and `reservations` to change the stored
 * DEFAULT of the status columns (now awaiting_payment). That rebuild drops the table, which would
 * null `stock_adjustments.order_id` / `reservation_id` if foreign keys are enforced, and nothing
 * needs it: Payload applies the configured default itself when it creates a record, and the new
 * select options ("awaiting_payment", "unknown") are plain text values. The snapshot (.json) is
 * the generated one, so the schema-drift check stays clean.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`orders\` ADD \`payment_attempts\` numeric DEFAULT 0;`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`payment_attempts\` numeric DEFAULT 0;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`payment_attempts\`;`)
  await db.run(sql`ALTER TABLE \`reservations\` DROP COLUMN \`payment_attempts\`;`)
}
