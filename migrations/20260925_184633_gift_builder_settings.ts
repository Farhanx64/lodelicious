import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`gift_builder_settings_sizes\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`code\` text NOT NULL,
  	\`label\` text NOT NULL,
  	\`basket_size_in\` text,
  	\`min_items\` numeric NOT NULL,
  	\`max_items\` numeric NOT NULL,
  	\`premium_cap\` numeric NOT NULL,
  	\`packaging_cents\` numeric NOT NULL,
  	\`capacity_units\` numeric,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`gift_builder_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`gift_builder_settings_sizes_order_idx\` ON \`gift_builder_settings_sizes\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`gift_builder_settings_sizes_parent_id_idx\` ON \`gift_builder_settings_sizes\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`gift_builder_settings_count_overrides\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`gift_type\` text NOT NULL,
  	\`size\` text NOT NULL,
  	\`min_items\` numeric NOT NULL,
  	\`max_items\` numeric NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`gift_builder_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`gift_builder_settings_count_overrides_order_idx\` ON \`gift_builder_settings_count_overrides\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`gift_builder_settings_count_overrides_parent_id_idx\` ON \`gift_builder_settings_count_overrides\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`gift_builder_settings_special_presentations_included_components\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`value\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`gift_builder_settings_special_presentations\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`gift_builder_settings_special_presentations_included_components_order_idx\` ON \`gift_builder_settings_special_presentations_included_components\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`gift_builder_settings_special_presentations_included_components_parent_id_idx\` ON \`gift_builder_settings_special_presentations_included_components\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`gift_builder_settings_special_presentations_allowed_categories\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`value\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`gift_builder_settings_special_presentations\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`gift_builder_settings_special_presentations_allowed_categories_order_idx\` ON \`gift_builder_settings_special_presentations_allowed_categories\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`gift_builder_settings_special_presentations_allowed_categories_parent_id_idx\` ON \`gift_builder_settings_special_presentations_allowed_categories\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`gift_builder_settings_special_presentations\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`code\` text NOT NULL,
  	\`name\` text NOT NULL,
  	\`status\` text DEFAULT 'inquiry' NOT NULL,
  	\`base_price_cents\` numeric,
  	\`pricing\` text DEFAULT 'base_plus_contents' NOT NULL,
  	\`min_selections\` numeric NOT NULL,
  	\`max_selections\` numeric NOT NULL,
  	\`premium_cap\` numeric,
  	\`capacity_units\` numeric,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`gift_builder_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`gift_builder_settings_special_presentations_order_idx\` ON \`gift_builder_settings_special_presentations\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`gift_builder_settings_special_presentations_parent_id_idx\` ON \`gift_builder_settings_special_presentations\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`gift_builder_settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`budget_notice\` text DEFAULT 'Your budget covers the gift''s contents and its basket and packaging. Sales tax and delivery or shipping are added at checkout.' NOT NULL,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`gift_builder_settings_sizes\`;`)
  await db.run(sql`DROP TABLE \`gift_builder_settings_count_overrides\`;`)
  await db.run(sql`DROP TABLE \`gift_builder_settings_special_presentations_included_components\`;`)
  await db.run(sql`DROP TABLE \`gift_builder_settings_special_presentations_allowed_categories\`;`)
  await db.run(sql`DROP TABLE \`gift_builder_settings_special_presentations\`;`)
  await db.run(sql`DROP TABLE \`gift_builder_settings\`;`)
}
