import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`products_components\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`product_id\` integer,
  	\`variant_key\` text,
  	\`quantity\` numeric DEFAULT 1,
  	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_components_order_idx\` ON \`products_components\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_components_parent_id_idx\` ON \`products_components\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_components_product_idx\` ON \`products_components\` (\`product_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_version_components\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`product_id\` integer,
  	\`variant_key\` text,
  	\`quantity\` numeric DEFAULT 1,
  	\`_uuid\` text,
  	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_version_components_order_idx\` ON \`_products_v_version_components\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_components_parent_id_idx\` ON \`_products_v_version_components\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_components_product_idx\` ON \`_products_v_version_components\` (\`product_id\`);`)
  await db.run(sql`CREATE TABLE \`stock_movements\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`product_id\` integer,
  	\`product_title\` text,
  	\`variant_key\` text DEFAULT '',
  	\`delta\` numeric NOT NULL,
  	\`reason\` text NOT NULL,
  	\`quantity_after\` numeric NOT NULL,
  	\`reference\` text,
  	\`user_id\` integer,
  	\`note\` text,
  	\`idempotency_key\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`stock_movements_product_idx\` ON \`stock_movements\` (\`product_id\`);`)
  await db.run(sql`CREATE INDEX \`stock_movements_reason_idx\` ON \`stock_movements\` (\`reason\`);`)
  await db.run(sql`CREATE INDEX \`stock_movements_reference_idx\` ON \`stock_movements\` (\`reference\`);`)
  await db.run(sql`CREATE INDEX \`stock_movements_user_idx\` ON \`stock_movements\` (\`user_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`stock_movements_idempotency_key_idx\` ON \`stock_movements\` (\`idempotency_key\`);`)
  await db.run(sql`CREATE INDEX \`stock_movements_updated_at_idx\` ON \`stock_movements\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`stock_movements_created_at_idx\` ON \`stock_movements\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`stock_holds\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`product_id\` integer,
  	\`variant_key\` text DEFAULT '',
  	\`quantity\` numeric NOT NULL,
  	\`owner\` text NOT NULL,
  	\`reference\` text,
  	\`status\` text DEFAULT 'active' NOT NULL,
  	\`expires_at\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`stock_holds_key_idx\` ON \`stock_holds\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`stock_holds_product_idx\` ON \`stock_holds\` (\`product_id\`);`)
  await db.run(sql`CREATE INDEX \`stock_holds_owner_idx\` ON \`stock_holds\` (\`owner\`);`)
  await db.run(sql`CREATE INDEX \`stock_holds_status_idx\` ON \`stock_holds\` (\`status\`);`)
  await db.run(sql`CREATE INDEX \`stock_holds_expires_at_idx\` ON \`stock_holds\` (\`expires_at\`);`)
  await db.run(sql`CREATE INDEX \`stock_holds_updated_at_idx\` ON \`stock_holds\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`stock_holds_created_at_idx\` ON \`stock_holds\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`stock_adjustments_restock_lines\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`product_id\` integer,
  	\`variant_key\` text,
  	\`quantity\` numeric,
  	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`stock_adjustments\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`stock_adjustments_restock_lines_order_idx\` ON \`stock_adjustments_restock_lines\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`stock_adjustments_restock_lines_parent_id_idx\` ON \`stock_adjustments_restock_lines\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`stock_adjustments_restock_lines_product_idx\` ON \`stock_adjustments_restock_lines\` (\`product_id\`);`)
  await db.run(sql`CREATE TABLE \`stock_adjustments\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`kind\` text DEFAULT 'count' NOT NULL,
  	\`product_id\` integer,
  	\`variant_key\` text,
  	\`counted_quantity\` numeric,
  	\`delta\` numeric,
  	\`order_id\` integer,
  	\`reservation_id\` integer,
  	\`confirm_perishable\` integer DEFAULT false,
  	\`note\` text NOT NULL,
  	\`user_id\` integer,
  	\`request_id\` text,
  	\`result\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`reservation_id\`) REFERENCES \`reservations\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`stock_adjustments_product_idx\` ON \`stock_adjustments\` (\`product_id\`);`)
  await db.run(sql`CREATE INDEX \`stock_adjustments_order_idx\` ON \`stock_adjustments\` (\`order_id\`);`)
  await db.run(sql`CREATE INDEX \`stock_adjustments_reservation_idx\` ON \`stock_adjustments\` (\`reservation_id\`);`)
  await db.run(sql`CREATE INDEX \`stock_adjustments_user_idx\` ON \`stock_adjustments\` (\`user_id\`);`)
  await db.run(sql`CREATE INDEX \`stock_adjustments_updated_at_idx\` ON \`stock_adjustments\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`stock_adjustments_created_at_idx\` ON \`stock_adjustments\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`outbox\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`event_type\` text DEFAULT 'stock_changed' NOT NULL,
  	\`payload\` text NOT NULL,
  	\`status\` text DEFAULT 'pending' NOT NULL,
  	\`attempts\` numeric DEFAULT 0,
  	\`next_attempt_at\` text,
  	\`last_attempt_at\` text,
  	\`sent_at\` text,
  	\`last_error\` text,
  	\`idempotency_key\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`outbox_status_idx\` ON \`outbox\` (\`status\`);`)
  await db.run(sql`CREATE INDEX \`outbox_next_attempt_at_idx\` ON \`outbox\` (\`next_attempt_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`outbox_idempotency_key_idx\` ON \`outbox\` (\`idempotency_key\`);`)
  await db.run(sql`CREATE INDEX \`outbox_updated_at_idx\` ON \`outbox\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`outbox_created_at_idx\` ON \`outbox\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`inventory_settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`hold_minutes\` numeric DEFAULT 15 NOT NULL,
  	\`max_stock_age_hours\` numeric,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`stock_status\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`stock_owner\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`stock_plan\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`stock_note\` text;`)
  await db.run(sql`CREATE INDEX \`orders_stock_status_idx\` ON \`orders\` (\`stock_status\`);`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`stock_status\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`stock_owner\` text;`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`stock_plan\` text;`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`stock_note\` text;`)
  await db.run(sql`CREATE INDEX \`reservations_stock_status_idx\` ON \`reservations\` (\`stock_status\`);`)
  await db.run(sql`ALTER TABLE \`products_variants\` ADD \`stock_counted_at\` text;`)
  await db.run(sql`ALTER TABLE \`_products_v_version_variants\` ADD \`stock_counted_at\` text;`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`stock_movements_id\` integer REFERENCES stock_movements(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`stock_holds_id\` integer REFERENCES stock_holds(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`stock_adjustments_id\` integer REFERENCES stock_adjustments(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`outbox_id\` integer REFERENCES outbox(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_stock_movements_id_idx\` ON \`payload_locked_documents_rels\` (\`stock_movements_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_stock_holds_id_idx\` ON \`payload_locked_documents_rels\` (\`stock_holds_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_stock_adjustments_id_idx\` ON \`payload_locked_documents_rels\` (\`stock_adjustments_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_outbox_id_idx\` ON \`payload_locked_documents_rels\` (\`outbox_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`products_components\`;`)
  await db.run(sql`DROP TABLE \`_products_v_version_components\`;`)
  await db.run(sql`DROP TABLE \`stock_movements\`;`)
  await db.run(sql`DROP TABLE \`stock_holds\`;`)
  await db.run(sql`DROP TABLE \`stock_adjustments_restock_lines\`;`)
  await db.run(sql`DROP TABLE \`stock_adjustments\`;`)
  await db.run(sql`DROP TABLE \`outbox\`;`)
  await db.run(sql`DROP TABLE \`inventory_settings\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`orders_id\` integer,
  	\`reservations_id\` integer,
  	\`inquiries_id\` integer,
  	\`products_id\` integer,
  	\`categories_id\` integer,
  	\`media_id\` integer,
  	\`tax_classes_id\` integer,
  	\`carts_id\` integer,
  	\`source_records_id\` integer,
  	\`users_id\` integer,
  	\`audit_log_id\` integer,
  	\`sync_jobs_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`orders_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`reservations_id\`) REFERENCES \`reservations\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`inquiries_id\`) REFERENCES \`inquiries\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`tax_classes_id\`) REFERENCES \`tax_classes\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`carts_id\`) REFERENCES \`carts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`source_records_id\`) REFERENCES \`source_records\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`audit_log_id\`) REFERENCES \`audit_log\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`sync_jobs_id\`) REFERENCES \`sync_jobs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "orders_id", "reservations_id", "inquiries_id", "products_id", "categories_id", "media_id", "tax_classes_id", "carts_id", "source_records_id", "users_id", "audit_log_id", "sync_jobs_id") SELECT "id", "order", "parent_id", "path", "orders_id", "reservations_id", "inquiries_id", "products_id", "categories_id", "media_id", "tax_classes_id", "carts_id", "source_records_id", "users_id", "audit_log_id", "sync_jobs_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_orders_id_idx\` ON \`payload_locked_documents_rels\` (\`orders_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_reservations_id_idx\` ON \`payload_locked_documents_rels\` (\`reservations_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_inquiries_id_idx\` ON \`payload_locked_documents_rels\` (\`inquiries_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_products_id_idx\` ON \`payload_locked_documents_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_categories_id_idx\` ON \`payload_locked_documents_rels\` (\`categories_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_tax_classes_id_idx\` ON \`payload_locked_documents_rels\` (\`tax_classes_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_carts_id_idx\` ON \`payload_locked_documents_rels\` (\`carts_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_source_records_id_idx\` ON \`payload_locked_documents_rels\` (\`source_records_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_audit_log_id_idx\` ON \`payload_locked_documents_rels\` (\`audit_log_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_sync_jobs_id_idx\` ON \`payload_locked_documents_rels\` (\`sync_jobs_id\`);`)
  await db.run(sql`DROP INDEX \`orders_stock_status_idx\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`stock_status\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`stock_owner\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`stock_plan\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`stock_note\`;`)
  await db.run(sql`DROP INDEX \`reservations_stock_status_idx\`;`)
  await db.run(sql`ALTER TABLE \`reservations\` DROP COLUMN \`stock_status\`;`)
  await db.run(sql`ALTER TABLE \`reservations\` DROP COLUMN \`stock_owner\`;`)
  await db.run(sql`ALTER TABLE \`reservations\` DROP COLUMN \`stock_plan\`;`)
  await db.run(sql`ALTER TABLE \`reservations\` DROP COLUMN \`stock_note\`;`)
  await db.run(sql`ALTER TABLE \`products_variants\` DROP COLUMN \`stock_counted_at\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_version_variants\` DROP COLUMN \`stock_counted_at\`;`)
}
