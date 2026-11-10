import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_gift_builder_settings_sizes\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`code\` text NOT NULL,
  	\`label\` text NOT NULL,
  	\`basket_size_in\` text,
  	\`enabled\` integer DEFAULT true,
  	\`min_items\` numeric NOT NULL,
  	\`max_items\` numeric NOT NULL,
  	\`premium_cap\` numeric,
  	\`packaging_cents\` numeric NOT NULL,
  	\`capacity_units\` numeric,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`gift_builder_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_gift_builder_settings_sizes\`("_order", "_parent_id", "id", "code", "label", "basket_size_in", "enabled", "min_items", "max_items", "premium_cap", "packaging_cents", "capacity_units") SELECT "_order", "_parent_id", "id", "code", "label", "basket_size_in", "enabled", "min_items", "max_items", "premium_cap", "packaging_cents", "capacity_units" FROM \`gift_builder_settings_sizes\`;`)
  await db.run(sql`DROP TABLE \`gift_builder_settings_sizes\`;`)
  await db.run(sql`ALTER TABLE \`__new_gift_builder_settings_sizes\` RENAME TO \`gift_builder_settings_sizes\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`gift_builder_settings_sizes_order_idx\` ON \`gift_builder_settings_sizes\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`gift_builder_settings_sizes_parent_id_idx\` ON \`gift_builder_settings_sizes\` (\`_parent_id\`);`)
  // Lody (2026-11-10): every item is premium, so baskets have no premium limit. Staff can set one again in the admin.
  await db.run(sql`UPDATE \`gift_builder_settings_sizes\` SET \`premium_cap\` = NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_gift_builder_settings_sizes\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`code\` text NOT NULL,
  	\`label\` text NOT NULL,
  	\`basket_size_in\` text,
  	\`enabled\` integer DEFAULT true,
  	\`min_items\` numeric NOT NULL,
  	\`max_items\` numeric NOT NULL,
  	\`premium_cap\` numeric NOT NULL,
  	\`packaging_cents\` numeric NOT NULL,
  	\`capacity_units\` numeric,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`gift_builder_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_gift_builder_settings_sizes\`("_order", "_parent_id", "id", "code", "label", "basket_size_in", "enabled", "min_items", "max_items", "premium_cap", "packaging_cents", "capacity_units") SELECT "_order", "_parent_id", "id", "code", "label", "basket_size_in", "enabled", "min_items", "max_items", COALESCE("premium_cap", CASE "code" WHEN 'small' THEN 1 WHEN 'medium' THEN 2 WHEN 'large' THEN 3 ELSE 4 END), "packaging_cents", "capacity_units" FROM \`gift_builder_settings_sizes\`;`)
  await db.run(sql`DROP TABLE \`gift_builder_settings_sizes\`;`)
  await db.run(sql`ALTER TABLE \`__new_gift_builder_settings_sizes\` RENAME TO \`gift_builder_settings_sizes\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`gift_builder_settings_sizes_order_idx\` ON \`gift_builder_settings_sizes\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`gift_builder_settings_sizes_parent_id_idx\` ON \`gift_builder_settings_sizes\` (\`_parent_id\`);`)
}
