import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * D60: shipping boxes by weight. Additive only: one new table and nullable columns, no table
 * rebuilt (safe on D1). A Shipping settings row saved before this gets Lody's four boxes, the same
 * as DEFAULT_BOXES in src/lib/shipping/boxes.ts; "Charge by box" starts off, so no price changes.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`shipping_settings_boxes\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`max_weight_lbs\` numeric NOT NULL,
  	\`price_cents\` numeric NOT NULL,
  	\`length_in\` numeric,
  	\`width_in\` numeric,
  	\`height_in\` numeric,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`shipping_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`shipping_settings_boxes_order_idx\` ON \`shipping_settings_boxes\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`shipping_settings_boxes_parent_id_idx\` ON \`shipping_settings_boxes\` (\`_parent_id\`);`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`fulfillment_box\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`fulfillment_weight_lbs\` numeric;`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`fulfillment_box\` text;`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`fulfillment_weight_lbs\` numeric;`)
  await db.run(sql`ALTER TABLE \`products\` ADD \`shipping_weight_lbs\` numeric;`)
  await db.run(sql`ALTER TABLE \`_products_v\` ADD \`version_shipping_weight_lbs\` numeric;`)
  await db.run(sql`ALTER TABLE \`shipping_settings\` ADD \`charge_by_box\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`gift_builder_settings_sizes\` ADD \`shipping_weight_lbs\` numeric;`)
  // Hand-added: prefill the boxes on an existing settings row (a new row gets them from the field default).
  await db.run(sql`INSERT INTO \`shipping_settings_boxes\` (\`_order\`, \`_parent_id\`, \`id\`, \`name\`, \`max_weight_lbs\`, \`price_cents\`, \`length_in\`, \`width_in\`, \`height_in\`)
    SELECT b.ord, s.id, 'd60-box-' || b.ord || '-' || s.id, b.name, b.max_lbs, b.price, b.l, b.w, b.h
    FROM \`shipping_settings\` s,
      (SELECT 1 AS ord, 'Small box' AS name, 3 AS max_lbs, 1000 AS price, 14 AS l, 9 AS w, 14 AS h
       UNION ALL SELECT 2, 'Medium box', 4, 1500, 16, 10, 16
       UNION ALL SELECT 3, 'Large box', 6, 2000, 18, 12, 20
       UNION ALL SELECT 4, 'Extra large box', 7, 2500, 22, 22, 18) b;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`shipping_settings_boxes\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`fulfillment_box\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`fulfillment_weight_lbs\`;`)
  await db.run(sql`ALTER TABLE \`reservations\` DROP COLUMN \`fulfillment_box\`;`)
  await db.run(sql`ALTER TABLE \`reservations\` DROP COLUMN \`fulfillment_weight_lbs\`;`)
  await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`shipping_weight_lbs\`;`)
  await db.run(sql`ALTER TABLE \`_products_v\` DROP COLUMN \`version_shipping_weight_lbs\`;`)
  await db.run(sql`ALTER TABLE \`shipping_settings\` DROP COLUMN \`charge_by_box\`;`)
  await db.run(sql`ALTER TABLE \`gift_builder_settings_sizes\` DROP COLUMN \`shipping_weight_lbs\`;`)
}
