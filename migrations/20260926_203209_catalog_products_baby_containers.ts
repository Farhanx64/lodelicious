import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`products_images\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`image_id\` integer,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_images_order_idx\` ON \`products_images\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_images_parent_id_idx\` ON \`products_images\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_images_image_idx\` ON \`products_images\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`products_variants\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`label\` text,
  	\`price_cents\` numeric,
  	\`stock_state\` text DEFAULT 'unknown',
  	\`stock_quantity\` numeric,
  	\`image_id\` integer,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_variants_order_idx\` ON \`products_variants\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_variants_parent_id_idx\` ON \`products_variants\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_variants_image_idx\` ON \`products_variants\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`products_gift_types\` (
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_gift_types_order_idx\` ON \`products_gift_types\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`products_gift_types_parent_idx\` ON \`products_gift_types\` (\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`category_id\` integer,
  	\`brand\` text,
  	\`size_label\` text,
  	\`short_description\` text,
  	\`description\` text,
  	\`featured\` integer DEFAULT false,
  	\`price_cents\` numeric,
  	\`price_approved\` integer DEFAULT false,
  	\`price_source\` text,
  	\`channel\` text DEFAULT 'online',
  	\`stock_state\` text DEFAULT 'unknown',
  	\`stock_quantity\` numeric,
  	\`low_stock_threshold\` numeric DEFAULT 3,
  	\`stock_counted_at\` text,
  	\`basket_eligible\` integer DEFAULT false,
  	\`premium\` integer DEFAULT false,
  	\`max_per_gift\` numeric DEFAULT 1,
  	\`fit_units\` numeric DEFAULT 1,
  	\`exclusive_to\` text,
  	\`assembly_notes\` text,
  	\`nut_free\` text DEFAULT 'unknown',
  	\`vegan\` text DEFAULT 'unknown',
  	\`allergen_notes\` text,
  	\`dietary_source\` text,
  	\`pickup\` integer DEFAULT true,
  	\`local_delivery\` integer DEFAULT true,
  	\`shippable\` integer DEFAULT false,
  	\`perishable\` integer DEFAULT false,
  	\`packed_weight_oz\` numeric,
  	\`sku\` text,
  	\`clover_id\` text,
  	\`slug\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`category_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`products_category_idx\` ON \`products\` (\`category_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`products_sku_idx\` ON \`products\` (\`sku\`);`)
  await db.run(sql`CREATE INDEX \`products_clover_id_idx\` ON \`products\` (\`clover_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`products_slug_idx\` ON \`products\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`products_updated_at_idx\` ON \`products\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`products_created_at_idx\` ON \`products\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`products__status_idx\` ON \`products\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`products_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`source_records_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`source_records_id\`) REFERENCES \`source_records\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_rels_order_idx\` ON \`products_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`products_rels_parent_idx\` ON \`products_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_rels_path_idx\` ON \`products_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`products_rels_source_records_id_idx\` ON \`products_rels\` (\`source_records_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_version_images\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`image_id\` integer,
  	\`_uuid\` text,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_version_images_order_idx\` ON \`_products_v_version_images\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_images_parent_id_idx\` ON \`_products_v_version_images\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_images_image_idx\` ON \`_products_v_version_images\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_version_variants\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`label\` text,
  	\`price_cents\` numeric,
  	\`stock_state\` text DEFAULT 'unknown',
  	\`stock_quantity\` numeric,
  	\`image_id\` integer,
  	\`_uuid\` text,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_version_variants_order_idx\` ON \`_products_v_version_variants\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_variants_parent_id_idx\` ON \`_products_v_version_variants\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_variants_image_idx\` ON \`_products_v_version_variants\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_version_gift_types\` (
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_version_gift_types_order_idx\` ON \`_products_v_version_gift_types\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_gift_types_parent_idx\` ON \`_products_v_version_gift_types\` (\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_title\` text,
  	\`version_category_id\` integer,
  	\`version_brand\` text,
  	\`version_size_label\` text,
  	\`version_short_description\` text,
  	\`version_description\` text,
  	\`version_featured\` integer DEFAULT false,
  	\`version_price_cents\` numeric,
  	\`version_price_approved\` integer DEFAULT false,
  	\`version_price_source\` text,
  	\`version_channel\` text DEFAULT 'online',
  	\`version_stock_state\` text DEFAULT 'unknown',
  	\`version_stock_quantity\` numeric,
  	\`version_low_stock_threshold\` numeric DEFAULT 3,
  	\`version_stock_counted_at\` text,
  	\`version_basket_eligible\` integer DEFAULT false,
  	\`version_premium\` integer DEFAULT false,
  	\`version_max_per_gift\` numeric DEFAULT 1,
  	\`version_fit_units\` numeric DEFAULT 1,
  	\`version_exclusive_to\` text,
  	\`version_assembly_notes\` text,
  	\`version_nut_free\` text DEFAULT 'unknown',
  	\`version_vegan\` text DEFAULT 'unknown',
  	\`version_allergen_notes\` text,
  	\`version_dietary_source\` text,
  	\`version_pickup\` integer DEFAULT true,
  	\`version_local_delivery\` integer DEFAULT true,
  	\`version_shippable\` integer DEFAULT false,
  	\`version_perishable\` integer DEFAULT false,
  	\`version_packed_weight_oz\` numeric,
  	\`version_sku\` text,
  	\`version_clover_id\` text,
  	\`version_slug\` text,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`latest\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_category_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_parent_idx\` ON \`_products_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_version_category_idx\` ON \`_products_v\` (\`version_category_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_version_sku_idx\` ON \`_products_v\` (\`version_sku\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_version_clover_id_idx\` ON \`_products_v\` (\`version_clover_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_version_slug_idx\` ON \`_products_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_version_updated_at_idx\` ON \`_products_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_version_created_at_idx\` ON \`_products_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_version__status_idx\` ON \`_products_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_created_at_idx\` ON \`_products_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_updated_at_idx\` ON \`_products_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_latest_idx\` ON \`_products_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`source_records_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`source_records_id\`) REFERENCES \`source_records\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_rels_order_idx\` ON \`_products_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_rels_parent_idx\` ON \`_products_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_rels_path_idx\` ON \`_products_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_rels_source_records_id_idx\` ON \`_products_v_rels\` (\`source_records_id\`);`)
  await db.run(sql`CREATE TABLE \`categories\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`slug\` text,
  	\`description\` text,
  	\`image_id\` integer,
  	\`sort_order\` numeric DEFAULT 100,
  	\`show_in_shop\` integer DEFAULT true,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`categories_slug_idx\` ON \`categories\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`categories_image_idx\` ON \`categories\` (\`image_id\`);`)
  await db.run(sql`CREATE INDEX \`categories_updated_at_idx\` ON \`categories\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`categories_created_at_idx\` ON \`categories\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`gift_builder_settings_special_presentations_variants\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`value\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`gift_builder_settings_special_presentations\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`gift_builder_settings_special_presentations_variants_order_idx\` ON \`gift_builder_settings_special_presentations_variants\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`gift_builder_settings_special_presentations_variants_parent_id_idx\` ON \`gift_builder_settings_special_presentations_variants\` (\`_parent_id\`);`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_source_records\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`ref\` text NOT NULL,
  	\`source\` text NOT NULL,
  	\`source_name\` text NOT NULL,
  	\`source_brand\` text,
  	\`source_price_cents\` numeric,
  	\`clover_id\` text,
  	\`observed_on\` text,
  	\`source_notes\` text,
  	\`disposition\` text DEFAULT 'unreviewed' NOT NULL,
  	\`duplicate_of_id\` integer,
  	\`review_notes\` text,
  	\`reviewed_by_id\` integer,
  	\`reviewed_at\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`duplicate_of_id\`) REFERENCES \`source_records\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`reviewed_by_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new_source_records\`("id", "ref", "source", "source_name", "source_brand", "source_price_cents", "clover_id", "observed_on", "source_notes", "disposition", "duplicate_of_id", "review_notes", "reviewed_by_id", "reviewed_at", "updated_at", "created_at") SELECT "id", "ref", "source", "source_name", "source_brand", "source_price_cents", "clover_id", "observed_on", "source_notes", "disposition", "duplicate_of_id", "review_notes", "reviewed_by_id", "reviewed_at", "updated_at", "created_at" FROM \`source_records\`;`)
  await db.run(sql`DROP TABLE \`source_records\`;`)
  await db.run(sql`ALTER TABLE \`__new_source_records\` RENAME TO \`source_records\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE UNIQUE INDEX \`source_records_ref_idx\` ON \`source_records\` (\`ref\`);`)
  await db.run(sql`CREATE INDEX \`source_records_source_idx\` ON \`source_records\` (\`source\`);`)
  await db.run(sql`CREATE INDEX \`source_records_clover_id_idx\` ON \`source_records\` (\`clover_id\`);`)
  await db.run(sql`CREATE INDEX \`source_records_disposition_idx\` ON \`source_records\` (\`disposition\`);`)
  await db.run(sql`CREATE INDEX \`source_records_duplicate_of_idx\` ON \`source_records\` (\`duplicate_of_id\`);`)
  await db.run(sql`CREATE INDEX \`source_records_reviewed_by_idx\` ON \`source_records\` (\`reviewed_by_id\`);`)
  await db.run(sql`CREATE INDEX \`source_records_updated_at_idx\` ON \`source_records\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`source_records_created_at_idx\` ON \`source_records\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`media\` ADD \`source_file\` text;`)
  await db.run(sql`ALTER TABLE \`media\` ADD \`credit\` text;`)
  await db.run(sql`CREATE INDEX \`media_source_file_idx\` ON \`media\` (\`source_file\`);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`products_id\` integer REFERENCES products(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`categories_id\` integer REFERENCES categories(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_products_id_idx\` ON \`payload_locked_documents_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_categories_id_idx\` ON \`payload_locked_documents_rels\` (\`categories_id\`);`)
  await db.run(sql`ALTER TABLE \`store_settings\` ADD \`allergy_notice\` text DEFAULT 'Our chocolates and fudge contain common allergens and may be made in facilities that process nuts and other allergens. We cannot guarantee products are completely free from traces of nuts or other allergens. Please contact us before ordering if you have a food allergy or specific dietary requirement so we can check current product information.' NOT NULL;`)
  await db.run(sql`ALTER TABLE \`gift_builder_settings_special_presentations\` ADD \`container\` text;`)
  await db.run(sql`ALTER TABLE \`gift_builder_settings_special_presentations\` ADD \`image_id\` integer REFERENCES media(id);`)
  await db.run(sql`CREATE INDEX \`gift_builder_settings_special_presentations_image_idx\` ON \`gift_builder_settings_special_presentations\` (\`image_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`products_images\`;`)
  await db.run(sql`DROP TABLE \`products_variants\`;`)
  await db.run(sql`DROP TABLE \`products_gift_types\`;`)
  await db.run(sql`DROP TABLE \`products\`;`)
  await db.run(sql`DROP TABLE \`products_rels\`;`)
  await db.run(sql`DROP TABLE \`_products_v_version_images\`;`)
  await db.run(sql`DROP TABLE \`_products_v_version_variants\`;`)
  await db.run(sql`DROP TABLE \`_products_v_version_gift_types\`;`)
  await db.run(sql`DROP TABLE \`_products_v\`;`)
  await db.run(sql`DROP TABLE \`_products_v_rels\`;`)
  await db.run(sql`DROP TABLE \`categories\`;`)
  await db.run(sql`DROP TABLE \`gift_builder_settings_special_presentations_variants\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	\`media_id\` integer,
  	\`source_records_id\` integer,
  	\`audit_log_id\` integer,
  	\`sync_jobs_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`source_records_id\`) REFERENCES \`source_records\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`audit_log_id\`) REFERENCES \`audit_log\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`sync_jobs_id\`) REFERENCES \`sync_jobs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "users_id", "media_id", "source_records_id", "audit_log_id", "sync_jobs_id") SELECT "id", "order", "parent_id", "path", "users_id", "media_id", "source_records_id", "audit_log_id", "sync_jobs_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_source_records_id_idx\` ON \`payload_locked_documents_rels\` (\`source_records_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_audit_log_id_idx\` ON \`payload_locked_documents_rels\` (\`audit_log_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_sync_jobs_id_idx\` ON \`payload_locked_documents_rels\` (\`sync_jobs_id\`);`)
  await db.run(sql`CREATE TABLE \`__new_gift_builder_settings_special_presentations\` (
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
  await db.run(sql`INSERT INTO \`__new_gift_builder_settings_special_presentations\`("_order", "_parent_id", "id", "code", "name", "status", "base_price_cents", "pricing", "min_selections", "max_selections", "premium_cap", "capacity_units") SELECT "_order", "_parent_id", "id", "code", "name", "status", "base_price_cents", "pricing", "min_selections", "max_selections", "premium_cap", "capacity_units" FROM \`gift_builder_settings_special_presentations\`;`)
  await db.run(sql`DROP TABLE \`gift_builder_settings_special_presentations\`;`)
  await db.run(sql`ALTER TABLE \`__new_gift_builder_settings_special_presentations\` RENAME TO \`gift_builder_settings_special_presentations\`;`)
  await db.run(sql`CREATE INDEX \`gift_builder_settings_special_presentations_order_idx\` ON \`gift_builder_settings_special_presentations\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`gift_builder_settings_special_presentations_parent_id_idx\` ON \`gift_builder_settings_special_presentations\` (\`_parent_id\`);`)
  await db.run(sql`DROP INDEX \`media_source_file_idx\`;`)
  await db.run(sql`ALTER TABLE \`media\` DROP COLUMN \`source_file\`;`)
  await db.run(sql`ALTER TABLE \`media\` DROP COLUMN \`credit\`;`)
  await db.run(sql`CREATE TABLE \`__new_source_records\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`ref\` text NOT NULL,
  	\`source\` text NOT NULL,
  	\`source_name\` text NOT NULL,
  	\`source_brand\` text,
  	\`source_price_cents\` numeric NOT NULL,
  	\`clover_id\` text,
  	\`observed_on\` text,
  	\`source_notes\` text,
  	\`disposition\` text DEFAULT 'unreviewed' NOT NULL,
  	\`duplicate_of_id\` integer,
  	\`review_notes\` text,
  	\`reviewed_by_id\` integer,
  	\`reviewed_at\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`duplicate_of_id\`) REFERENCES \`source_records\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`reviewed_by_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new_source_records\`("id", "ref", "source", "source_name", "source_brand", "source_price_cents", "clover_id", "observed_on", "source_notes", "disposition", "duplicate_of_id", "review_notes", "reviewed_by_id", "reviewed_at", "updated_at", "created_at") SELECT "id", "ref", "source", "source_name", "source_brand", "source_price_cents", "clover_id", "observed_on", "source_notes", "disposition", "duplicate_of_id", "review_notes", "reviewed_by_id", "reviewed_at", "updated_at", "created_at" FROM \`source_records\`;`)
  await db.run(sql`DROP TABLE \`source_records\`;`)
  await db.run(sql`ALTER TABLE \`__new_source_records\` RENAME TO \`source_records\`;`)
  await db.run(sql`CREATE UNIQUE INDEX \`source_records_ref_idx\` ON \`source_records\` (\`ref\`);`)
  await db.run(sql`CREATE INDEX \`source_records_source_idx\` ON \`source_records\` (\`source\`);`)
  await db.run(sql`CREATE INDEX \`source_records_clover_id_idx\` ON \`source_records\` (\`clover_id\`);`)
  await db.run(sql`CREATE INDEX \`source_records_disposition_idx\` ON \`source_records\` (\`disposition\`);`)
  await db.run(sql`CREATE INDEX \`source_records_duplicate_of_idx\` ON \`source_records\` (\`duplicate_of_id\`);`)
  await db.run(sql`CREATE INDEX \`source_records_reviewed_by_idx\` ON \`source_records\` (\`reviewed_by_id\`);`)
  await db.run(sql`CREATE INDEX \`source_records_updated_at_idx\` ON \`source_records\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`source_records_created_at_idx\` ON \`source_records\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`store_settings\` DROP COLUMN \`allergy_notice\`;`)
}
