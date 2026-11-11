import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`reviews\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`rating\` numeric DEFAULT 5 NOT NULL,
  	\`date\` text,
  	\`text\` text NOT NULL,
  	\`featured\` integer DEFAULT false,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`reviews_updated_at_idx\` ON \`reviews\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`reviews_created_at_idx\` ON \`reviews\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`reviews_id\` integer REFERENCES reviews(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_reviews_id_idx\` ON \`payload_locked_documents_rels\` (\`reviews_id\`);`)
  await db.run(sql`ALTER TABLE \`store_settings\` ADD \`google_rating\` text DEFAULT '5.0';`)
  await db.run(sql`ALTER TABLE \`store_settings\` ADD \`google_review_count\` numeric DEFAULT 34;`)
  await db.run(sql`ALTER TABLE \`store_settings\` ADD \`google_review_url\` text DEFAULT 'https://www.google.com/maps?cid=6229617616978653533';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`reviews\`;`)
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
  	\`stock_adjustments_id\` integer,
  	\`stock_movements_id\` integer,
  	\`stock_holds_id\` integer,
  	\`members_id\` integer,
  	\`reward_entries_id\` integer,
  	\`reward_adjustments_id\` integer,
  	\`media_id\` integer,
  	\`tax_classes_id\` integer,
  	\`users_id\` integer,
  	\`audit_log_id\` integer,
  	\`outbox_id\` integer,
  	\`sync_jobs_id\` integer,
  	\`source_records_id\` integer,
  	\`carts_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`orders_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`reservations_id\`) REFERENCES \`reservations\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`inquiries_id\`) REFERENCES \`inquiries\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`stock_adjustments_id\`) REFERENCES \`stock_adjustments\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`stock_movements_id\`) REFERENCES \`stock_movements\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`stock_holds_id\`) REFERENCES \`stock_holds\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`members_id\`) REFERENCES \`members\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`reward_entries_id\`) REFERENCES \`reward_entries\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`reward_adjustments_id\`) REFERENCES \`reward_adjustments\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`tax_classes_id\`) REFERENCES \`tax_classes\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`audit_log_id\`) REFERENCES \`audit_log\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`outbox_id\`) REFERENCES \`outbox\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`sync_jobs_id\`) REFERENCES \`sync_jobs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`source_records_id\`) REFERENCES \`source_records\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`carts_id\`) REFERENCES \`carts\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "orders_id", "reservations_id", "inquiries_id", "products_id", "categories_id", "stock_adjustments_id", "stock_movements_id", "stock_holds_id", "members_id", "reward_entries_id", "reward_adjustments_id", "media_id", "tax_classes_id", "users_id", "audit_log_id", "outbox_id", "sync_jobs_id", "source_records_id", "carts_id") SELECT "id", "order", "parent_id", "path", "orders_id", "reservations_id", "inquiries_id", "products_id", "categories_id", "stock_adjustments_id", "stock_movements_id", "stock_holds_id", "members_id", "reward_entries_id", "reward_adjustments_id", "media_id", "tax_classes_id", "users_id", "audit_log_id", "outbox_id", "sync_jobs_id", "source_records_id", "carts_id" FROM \`payload_locked_documents_rels\`;`)
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
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_stock_adjustments_id_idx\` ON \`payload_locked_documents_rels\` (\`stock_adjustments_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_stock_movements_id_idx\` ON \`payload_locked_documents_rels\` (\`stock_movements_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_stock_holds_id_idx\` ON \`payload_locked_documents_rels\` (\`stock_holds_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_members_id_idx\` ON \`payload_locked_documents_rels\` (\`members_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_reward_entries_id_idx\` ON \`payload_locked_documents_rels\` (\`reward_entries_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_reward_adjustments_id_idx\` ON \`payload_locked_documents_rels\` (\`reward_adjustments_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_tax_classes_id_idx\` ON \`payload_locked_documents_rels\` (\`tax_classes_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_audit_log_id_idx\` ON \`payload_locked_documents_rels\` (\`audit_log_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_outbox_id_idx\` ON \`payload_locked_documents_rels\` (\`outbox_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_sync_jobs_id_idx\` ON \`payload_locked_documents_rels\` (\`sync_jobs_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_source_records_id_idx\` ON \`payload_locked_documents_rels\` (\`source_records_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_carts_id_idx\` ON \`payload_locked_documents_rels\` (\`carts_id\`);`)
  await db.run(sql`ALTER TABLE \`store_settings\` DROP COLUMN \`google_rating\`;`)
  await db.run(sql`ALTER TABLE \`store_settings\` DROP COLUMN \`google_review_count\`;`)
  await db.run(sql`ALTER TABLE \`store_settings\` DROP COLUMN \`google_review_url\`;`)
}
