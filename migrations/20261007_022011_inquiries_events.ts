import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`inquiries\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`number\` text NOT NULL,
  	\`sequence\` numeric NOT NULL,
  	\`idempotency_key\` text NOT NULL,
  	\`status\` text DEFAULT 'new' NOT NULL,
  	\`topic\` text NOT NULL,
  	\`customer_name\` text NOT NULL,
  	\`customer_email\` text NOT NULL,
  	\`customer_phone\` text NOT NULL,
  	\`message\` text,
  	\`product_id\` integer,
  	\`item_title\` text,
  	\`event_date\` text,
  	\`event_setup_time\` text,
  	\`event_guests\` numeric,
  	\`event_location\` text,
  	\`estimate_cents\` numeric,
  	\`estimate_terms\` text,
  	\`staff_notes\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`inquiries_number_idx\` ON \`inquiries\` (\`number\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`inquiries_sequence_idx\` ON \`inquiries\` (\`sequence\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`inquiries_idempotency_key_idx\` ON \`inquiries\` (\`idempotency_key\`);`)
  await db.run(sql`CREATE INDEX \`inquiries_status_idx\` ON \`inquiries\` (\`status\`);`)
  await db.run(sql`CREATE INDEX \`inquiries_topic_idx\` ON \`inquiries\` (\`topic\`);`)
  await db.run(sql`CREATE INDEX \`inquiries_product_idx\` ON \`inquiries\` (\`product_id\`);`)
  await db.run(sql`CREATE INDEX \`inquiries_updated_at_idx\` ON \`inquiries\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`inquiries_created_at_idx\` ON \`inquiries\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`event_settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`enabled\` integer DEFAULT true,
  	\`base_cents\` numeric DEFAULT 25000 NOT NULL,
  	\`included_hours\` numeric DEFAULT 2 NOT NULL,
  	\`per_guest_cents\` numeric DEFAULT 850 NOT NULL,
  	\`chocolate_per_guest_cents\` numeric DEFAULT 500,
  	\`fruit_per_guest_cents\` numeric DEFAULT 350,
  	\`deposit_percent_basis_points\` numeric DEFAULT 2500 NOT NULL,
  	\`cancellation_terms\` text,
  	\`service_area\` text,
  	\`minimum_guests\` numeric,
  	\`extension_terms\` text,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`inquiries_id\` integer REFERENCES inquiries(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_inquiries_id_idx\` ON \`payload_locked_documents_rels\` (\`inquiries_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`inquiries\`;`)
  await db.run(sql`DROP TABLE \`event_settings\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`orders_id\` integer,
  	\`reservations_id\` integer,
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
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "orders_id", "reservations_id", "products_id", "categories_id", "media_id", "tax_classes_id", "carts_id", "source_records_id", "users_id", "audit_log_id", "sync_jobs_id") SELECT "id", "order", "parent_id", "path", "orders_id", "reservations_id", "products_id", "categories_id", "media_id", "tax_classes_id", "carts_id", "source_records_id", "users_id", "audit_log_id", "sync_jobs_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_orders_id_idx\` ON \`payload_locked_documents_rels\` (\`orders_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_reservations_id_idx\` ON \`payload_locked_documents_rels\` (\`reservations_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_products_id_idx\` ON \`payload_locked_documents_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_categories_id_idx\` ON \`payload_locked_documents_rels\` (\`categories_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_tax_classes_id_idx\` ON \`payload_locked_documents_rels\` (\`tax_classes_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_carts_id_idx\` ON \`payload_locked_documents_rels\` (\`carts_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_source_records_id_idx\` ON \`payload_locked_documents_rels\` (\`source_records_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_audit_log_id_idx\` ON \`payload_locked_documents_rels\` (\`audit_log_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_sync_jobs_id_idx\` ON \`payload_locked_documents_rels\` (\`sync_jobs_id\`);`)
}
