import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`orders\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`number\` text NOT NULL,
  	\`access_token_hash\` text NOT NULL,
  	\`idempotency_key\` text NOT NULL,
  	\`test_mode\` integer DEFAULT false,
  	\`payment_status\` text DEFAULT 'pending' NOT NULL,
  	\`fulfillment_status\` text DEFAULT 'preparing' NOT NULL,
  	\`customer_name\` text NOT NULL,
  	\`customer_email\` text NOT NULL,
  	\`customer_phone\` text NOT NULL,
  	\`pickup_date\` text NOT NULL,
  	\`pickup_start\` text NOT NULL,
  	\`pickup_end\` text NOT NULL,
  	\`pickup_label\` text,
  	\`notes\` text,
  	\`lines\` text NOT NULL,
  	\`totals_subtotal_cents\` numeric NOT NULL,
  	\`totals_tax_cents\` numeric NOT NULL,
  	\`totals_total_cents\` numeric NOT NULL,
  	\`totals_tax_approved\` integer,
  	\`payment_provider\` text,
  	\`payment_reference\` text,
  	\`staff_notes\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`orders_number_idx\` ON \`orders\` (\`number\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`orders_idempotency_key_idx\` ON \`orders\` (\`idempotency_key\`);`)
  await db.run(sql`CREATE INDEX \`orders_pickup_pickup_date_idx\` ON \`orders\` (\`pickup_date\`);`)
  await db.run(sql`CREATE INDEX \`orders_updated_at_idx\` ON \`orders\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`orders_created_at_idx\` ON \`orders\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`reservations\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`number\` text NOT NULL,
  	\`access_token_hash\` text NOT NULL,
  	\`idempotency_key\` text NOT NULL,
  	\`test_mode\` integer DEFAULT false,
  	\`reservation_status\` text DEFAULT 'confirmed' NOT NULL,
  	\`payment_status\` text DEFAULT 'deposit_pending' NOT NULL,
  	\`customer_name\` text NOT NULL,
  	\`customer_email\` text NOT NULL,
  	\`customer_phone\` text NOT NULL,
  	\`pickup_date\` text NOT NULL,
  	\`pickup_start\` text NOT NULL,
  	\`pickup_end\` text NOT NULL,
  	\`pickup_label\` text,
  	\`assembly\` text,
  	\`basket\` text NOT NULL,
  	\`total_cents\` numeric NOT NULL,
  	\`tax_cents\` numeric NOT NULL,
  	\`deposit_cents\` numeric NOT NULL,
  	\`amount_paid_cents\` numeric NOT NULL,
  	\`balance_due_cents\` numeric NOT NULL,
  	\`tax_approved\` integer,
  	\`payment_provider\` text,
  	\`payment_reference\` text,
  	\`staff_notes\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`reservations_number_idx\` ON \`reservations\` (\`number\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`reservations_idempotency_key_idx\` ON \`reservations\` (\`idempotency_key\`);`)
  await db.run(sql`CREATE INDEX \`reservations_pickup_pickup_date_idx\` ON \`reservations\` (\`pickup_date\`);`)
  await db.run(sql`CREATE INDEX \`reservations_updated_at_idx\` ON \`reservations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`reservations_created_at_idx\` ON \`reservations\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`tax_classes\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`rate_basis_points\` numeric NOT NULL,
  	\`approved\` integer DEFAULT false,
  	\`notes\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`tax_classes_updated_at_idx\` ON \`tax_classes\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`tax_classes_created_at_idx\` ON \`tax_classes\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`carts_lines\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`unit_id\` text NOT NULL,
  	\`quantity\` numeric NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`carts\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`carts_lines_order_idx\` ON \`carts_lines\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`carts_lines_parent_id_idx\` ON \`carts_lines\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`carts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`token_hash\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`carts_token_hash_idx\` ON \`carts\` (\`token_hash\`);`)
  await db.run(sql`CREATE INDEX \`carts_updated_at_idx\` ON \`carts\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`carts_created_at_idx\` ON \`carts\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`checkout_settings_pickup_hours\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`weekday\` text NOT NULL,
  	\`open\` text NOT NULL,
  	\`close\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`checkout_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`checkout_settings_pickup_hours_order_idx\` ON \`checkout_settings_pickup_hours\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`checkout_settings_pickup_hours_parent_id_idx\` ON \`checkout_settings_pickup_hours\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`checkout_settings_closed_dates\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`date\` text NOT NULL,
  	\`label\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`checkout_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`checkout_settings_closed_dates_order_idx\` ON \`checkout_settings_closed_dates\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`checkout_settings_closed_dates_parent_id_idx\` ON \`checkout_settings_closed_dates\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`checkout_settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`default_tax_class_id\` integer,
  	\`packaging_tax_class_id\` integer,
  	\`slot_minutes\` numeric DEFAULT 60 NOT NULL,
  	\`lead_time_hours\` numeric DEFAULT 24 NOT NULL,
  	\`reservation_lead_hours\` numeric DEFAULT 48 NOT NULL,
  	\`days_ahead\` numeric DEFAULT 14 NOT NULL,
  	\`deposit_type\` text DEFAULT 'percent' NOT NULL,
  	\`deposit_percent_basis_points\` numeric DEFAULT 2500 NOT NULL,
  	\`deposit_flat_cents\` numeric DEFAULT 2000 NOT NULL,
  	\`allow_pay_in_full\` integer DEFAULT true,
  	\`updated_at\` text,
  	\`created_at\` text,
  	FOREIGN KEY (\`default_tax_class_id\`) REFERENCES \`tax_classes\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`packaging_tax_class_id\`) REFERENCES \`tax_classes\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`checkout_settings_default_tax_class_idx\` ON \`checkout_settings\` (\`default_tax_class_id\`);`)
  await db.run(sql`CREATE INDEX \`checkout_settings_packaging_tax_class_idx\` ON \`checkout_settings\` (\`packaging_tax_class_id\`);`)
  await db.run(sql`ALTER TABLE \`products\` ADD \`tax_class_id\` integer REFERENCES tax_classes(id);`)
  await db.run(sql`CREATE INDEX \`products_tax_class_idx\` ON \`products\` (\`tax_class_id\`);`)
  await db.run(sql`ALTER TABLE \`_products_v\` ADD \`version_tax_class_id\` integer REFERENCES tax_classes(id);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_version_tax_class_idx\` ON \`_products_v\` (\`version_tax_class_id\`);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`orders_id\` integer REFERENCES orders(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`reservations_id\` integer REFERENCES reservations(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`tax_classes_id\` integer REFERENCES tax_classes(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`carts_id\` integer REFERENCES carts(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_orders_id_idx\` ON \`payload_locked_documents_rels\` (\`orders_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_reservations_id_idx\` ON \`payload_locked_documents_rels\` (\`reservations_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_tax_classes_id_idx\` ON \`payload_locked_documents_rels\` (\`tax_classes_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_carts_id_idx\` ON \`payload_locked_documents_rels\` (\`carts_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`orders\`;`)
  await db.run(sql`DROP TABLE \`reservations\`;`)
  await db.run(sql`DROP TABLE \`tax_classes\`;`)
  await db.run(sql`DROP TABLE \`carts_lines\`;`)
  await db.run(sql`DROP TABLE \`carts\`;`)
  await db.run(sql`DROP TABLE \`checkout_settings_pickup_hours\`;`)
  await db.run(sql`DROP TABLE \`checkout_settings_closed_dates\`;`)
  await db.run(sql`DROP TABLE \`checkout_settings\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_products\` (
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
  	\`online_reserve\` numeric DEFAULT 1,
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
  await db.run(sql`INSERT INTO \`__new_products\`("id", "title", "category_id", "brand", "size_label", "short_description", "description", "featured", "price_cents", "price_approved", "price_source", "channel", "stock_state", "stock_quantity", "low_stock_threshold", "online_reserve", "stock_counted_at", "basket_eligible", "premium", "max_per_gift", "fit_units", "exclusive_to", "assembly_notes", "nut_free", "vegan", "allergen_notes", "dietary_source", "pickup", "shippable", "perishable", "packed_weight_oz", "sku", "clover_id", "slug", "updated_at", "created_at", "_status") SELECT "id", "title", "category_id", "brand", "size_label", "short_description", "description", "featured", "price_cents", "price_approved", "price_source", "channel", "stock_state", "stock_quantity", "low_stock_threshold", "online_reserve", "stock_counted_at", "basket_eligible", "premium", "max_per_gift", "fit_units", "exclusive_to", "assembly_notes", "nut_free", "vegan", "allergen_notes", "dietary_source", "pickup", "shippable", "perishable", "packed_weight_oz", "sku", "clover_id", "slug", "updated_at", "created_at", "_status" FROM \`products\`;`)
  await db.run(sql`DROP TABLE \`products\`;`)
  await db.run(sql`ALTER TABLE \`__new_products\` RENAME TO \`products\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`products_category_idx\` ON \`products\` (\`category_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`products_sku_idx\` ON \`products\` (\`sku\`);`)
  await db.run(sql`CREATE INDEX \`products_clover_id_idx\` ON \`products\` (\`clover_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`products_slug_idx\` ON \`products\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`products_updated_at_idx\` ON \`products\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`products_created_at_idx\` ON \`products\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`products__status_idx\` ON \`products\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`__new__products_v\` (
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
  	\`version_online_reserve\` numeric DEFAULT 1,
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
  await db.run(sql`INSERT INTO \`__new__products_v\`("id", "parent_id", "version_title", "version_category_id", "version_brand", "version_size_label", "version_short_description", "version_description", "version_featured", "version_price_cents", "version_price_approved", "version_price_source", "version_channel", "version_stock_state", "version_stock_quantity", "version_low_stock_threshold", "version_online_reserve", "version_stock_counted_at", "version_basket_eligible", "version_premium", "version_max_per_gift", "version_fit_units", "version_exclusive_to", "version_assembly_notes", "version_nut_free", "version_vegan", "version_allergen_notes", "version_dietary_source", "version_pickup", "version_shippable", "version_perishable", "version_packed_weight_oz", "version_sku", "version_clover_id", "version_slug", "version_updated_at", "version_created_at", "version__status", "created_at", "updated_at", "latest") SELECT "id", "parent_id", "version_title", "version_category_id", "version_brand", "version_size_label", "version_short_description", "version_description", "version_featured", "version_price_cents", "version_price_approved", "version_price_source", "version_channel", "version_stock_state", "version_stock_quantity", "version_low_stock_threshold", "version_online_reserve", "version_stock_counted_at", "version_basket_eligible", "version_premium", "version_max_per_gift", "version_fit_units", "version_exclusive_to", "version_assembly_notes", "version_nut_free", "version_vegan", "version_allergen_notes", "version_dietary_source", "version_pickup", "version_shippable", "version_perishable", "version_packed_weight_oz", "version_sku", "version_clover_id", "version_slug", "version_updated_at", "version_created_at", "version__status", "created_at", "updated_at", "latest" FROM \`_products_v\`;`)
  await db.run(sql`DROP TABLE \`_products_v\`;`)
  await db.run(sql`ALTER TABLE \`__new__products_v\` RENAME TO \`_products_v\`;`)
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
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`products_id\` integer,
  	\`categories_id\` integer,
  	\`media_id\` integer,
  	\`source_records_id\` integer,
  	\`users_id\` integer,
  	\`audit_log_id\` integer,
  	\`sync_jobs_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`source_records_id\`) REFERENCES \`source_records\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`audit_log_id\`) REFERENCES \`audit_log\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`sync_jobs_id\`) REFERENCES \`sync_jobs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "products_id", "categories_id", "media_id", "source_records_id", "users_id", "audit_log_id", "sync_jobs_id") SELECT "id", "order", "parent_id", "path", "products_id", "categories_id", "media_id", "source_records_id", "users_id", "audit_log_id", "sync_jobs_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_products_id_idx\` ON \`payload_locked_documents_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_categories_id_idx\` ON \`payload_locked_documents_rels\` (\`categories_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_source_records_id_idx\` ON \`payload_locked_documents_rels\` (\`source_records_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_audit_log_id_idx\` ON \`payload_locked_documents_rels\` (\`audit_log_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_sync_jobs_id_idx\` ON \`payload_locked_documents_rels\` (\`sync_jobs_id\`);`)
}
