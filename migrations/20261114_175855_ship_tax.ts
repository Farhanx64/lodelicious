import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * D65: sales tax by the ship-to state. Additive only: one new table and two nullable columns, no
 * table rebuilt (safe on D1). The existing Checkout settings row gets one state, MA, at the default
 * tax class's rate (6.25% if it has none), so pickup and MA shipping charge exactly as before and
 * every other ship-to state stops being charged MA tax.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`checkout_settings_ship_tax_states\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`state\` text NOT NULL,
  	\`rate_percent\` numeric NOT NULL,
  	\`clover_tax_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`checkout_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`checkout_settings_ship_tax_states_order_idx\` ON \`checkout_settings_ship_tax_states\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`checkout_settings_ship_tax_states_parent_id_idx\` ON \`checkout_settings_ship_tax_states\` (\`_parent_id\`);`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`totals_tax_label\` text;`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`tax_label\` text;`)
  // Hand-added: prefill MA on an existing settings row (a new row gets it from the field default).
  await db.run(sql`INSERT INTO \`checkout_settings_ship_tax_states\` (\`_order\`, \`_parent_id\`, \`id\`, \`state\`, \`rate_percent\`, \`clover_tax_name\`)
    SELECT 1, s.id, 'd65-ma-' || s.id, 'MA', COALESCE(t.rate_basis_points, 625) / 100.0, 'Sales Tax'
    FROM \`checkout_settings\` s LEFT JOIN \`tax_classes\` t ON t.id = s.default_tax_class_id;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`checkout_settings_ship_tax_states\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`totals_tax_label\`;`)
  await db.run(sql`ALTER TABLE \`reservations\` DROP COLUMN \`tax_label\`;`)
}
