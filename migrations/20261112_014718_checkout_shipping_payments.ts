import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * D54: shipping settings, pickup-or-shipping on orders and reservations, the Clover order id on a
 * payment, "Always available (stock not tracked)" per product and as a store default, and the order
 * alert email default.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`shipping_settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`shipping_enabled\` integer DEFAULT true,
  	\`flat_rate_cents\` numeric DEFAULT 895 NOT NULL,
  	\`basket_small_cents\` numeric DEFAULT 1000 NOT NULL,
  	\`basket_medium_cents\` numeric DEFAULT 1500 NOT NULL,
  	\`basket_large_cents\` numeric DEFAULT 2000 NOT NULL,
  	\`basket_larger_cents\` numeric DEFAULT 2500 NOT NULL,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  // Hand-trimmed (D54, as in D42): Payload proposed rebuilding store_settings only to give
  // notification_email a stored DEFAULT. Rebuilding drops the table, which on D1 (foreign keys always
  // on) would cascade-delete its hours and promo-slide rows. Payload applies the configured default
  // itself on create; the existing row gets the order alert address here. The snapshot .json is the
  // generated one, so the CI drift check stays clean.
  await db.run(sql`UPDATE \`store_settings\` SET \`notification_email\` = 'Lodeliciousorderss@gmail.com' WHERE \`notification_email\` IS NULL OR \`notification_email\` = '';`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`fulfillment_method\` text DEFAULT 'pickup';`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`fulfillment_shipping_cents\` numeric DEFAULT 0;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`fulfillment_ship_to_name\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`fulfillment_ship_to_line1\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`fulfillment_ship_to_line2\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`fulfillment_ship_to_city\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`fulfillment_ship_to_state\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`fulfillment_ship_to_zip\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`totals_shipping_cents\` numeric DEFAULT 0;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`payment_provider_order_id\` text;`)
  await db.run(sql`CREATE INDEX \`orders_fulfillment_fulfillment_method_idx\` ON \`orders\` (\`fulfillment_method\`);`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`fulfillment_method\` text DEFAULT 'pickup';`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`fulfillment_shipping_cents\` numeric DEFAULT 0;`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`fulfillment_ship_to_name\` text;`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`fulfillment_ship_to_line1\` text;`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`fulfillment_ship_to_line2\` text;`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`fulfillment_ship_to_city\` text;`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`fulfillment_ship_to_state\` text;`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`fulfillment_ship_to_zip\` text;`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`payment_provider_order_id\` text;`)
  await db.run(sql`CREATE INDEX \`reservations_fulfillment_fulfillment_method_idx\` ON \`reservations\` (\`fulfillment_method\`);`)
  await db.run(sql`ALTER TABLE \`products\` ADD \`always_available\` text DEFAULT 'store_default';`)
  await db.run(sql`ALTER TABLE \`_products_v\` ADD \`version_always_available\` text DEFAULT 'store_default';`)
  await db.run(sql`ALTER TABLE \`inventory_settings\` ADD \`untracked_available\` integer DEFAULT true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`shipping_settings\`;`)
  await db.run(sql`DROP INDEX \`orders_fulfillment_fulfillment_method_idx\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`fulfillment_method\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`fulfillment_shipping_cents\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`fulfillment_ship_to_name\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`fulfillment_ship_to_line1\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`fulfillment_ship_to_line2\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`fulfillment_ship_to_city\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`fulfillment_ship_to_state\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`fulfillment_ship_to_zip\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`totals_shipping_cents\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`payment_provider_order_id\`;`)
  await db.run(sql`DROP INDEX \`reservations_fulfillment_fulfillment_method_idx\`;`)
  await db.run(sql`ALTER TABLE \`reservations\` DROP COLUMN \`fulfillment_method\`;`)
  await db.run(sql`ALTER TABLE \`reservations\` DROP COLUMN \`fulfillment_shipping_cents\`;`)
  await db.run(sql`ALTER TABLE \`reservations\` DROP COLUMN \`fulfillment_ship_to_name\`;`)
  await db.run(sql`ALTER TABLE \`reservations\` DROP COLUMN \`fulfillment_ship_to_line1\`;`)
  await db.run(sql`ALTER TABLE \`reservations\` DROP COLUMN \`fulfillment_ship_to_line2\`;`)
  await db.run(sql`ALTER TABLE \`reservations\` DROP COLUMN \`fulfillment_ship_to_city\`;`)
  await db.run(sql`ALTER TABLE \`reservations\` DROP COLUMN \`fulfillment_ship_to_state\`;`)
  await db.run(sql`ALTER TABLE \`reservations\` DROP COLUMN \`fulfillment_ship_to_zip\`;`)
  await db.run(sql`ALTER TABLE \`reservations\` DROP COLUMN \`payment_provider_order_id\`;`)
  // store_settings.notification_email keeps its value (the up step only filled an empty one).
  await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`always_available\`;`)
  await db.run(sql`ALTER TABLE \`_products_v\` DROP COLUMN \`version_always_available\`;`)
  await db.run(sql`ALTER TABLE \`inventory_settings\` DROP COLUMN \`untracked_available\`;`)
}
