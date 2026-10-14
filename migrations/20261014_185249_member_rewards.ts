import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`members\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`email\` text NOT NULL,
  	\`phone\` text,
  	\`points_balance\` numeric DEFAULT 0,
  	\`status\` text DEFAULT 'active' NOT NULL,
  	\`terms_accepted_at\` text,
  	\`last_sign_in_at\` text,
  	\`password_hash\` text,
  	\`session_version\` numeric DEFAULT 0,
  	\`failed_sign_ins\` numeric DEFAULT 0,
  	\`locked_until\` text,
  	\`reset_token_hash\` text,
  	\`reset_expires_at\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`members_email_idx\` ON \`members\` (\`email\`);`)
  await db.run(sql`CREATE INDEX \`members_reset_token_hash_idx\` ON \`members\` (\`reset_token_hash\`);`)
  await db.run(sql`CREATE INDEX \`members_updated_at_idx\` ON \`members\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`members_created_at_idx\` ON \`members\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`reward_entries\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`member_id\` integer,
  	\`kind\` text NOT NULL,
  	\`points\` numeric NOT NULL,
  	\`balance_after\` numeric,
  	\`order_id\` integer,
  	\`reservation_id\` integer,
  	\`reference\` text,
  	\`user_id\` integer,
  	\`note\` text,
  	\`idempotency_key\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`member_id\`) REFERENCES \`members\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`reservation_id\`) REFERENCES \`reservations\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`reward_entries_member_idx\` ON \`reward_entries\` (\`member_id\`);`)
  await db.run(sql`CREATE INDEX \`reward_entries_order_idx\` ON \`reward_entries\` (\`order_id\`);`)
  await db.run(sql`CREATE INDEX \`reward_entries_reservation_idx\` ON \`reward_entries\` (\`reservation_id\`);`)
  await db.run(sql`CREATE INDEX \`reward_entries_user_idx\` ON \`reward_entries\` (\`user_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`reward_entries_idempotency_key_idx\` ON \`reward_entries\` (\`idempotency_key\`);`)
  await db.run(sql`CREATE INDEX \`reward_entries_updated_at_idx\` ON \`reward_entries\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`reward_entries_created_at_idx\` ON \`reward_entries\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`reward_adjustments\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`member_id\` integer,
  	\`points\` numeric NOT NULL,
  	\`note\` text NOT NULL,
  	\`balance_after\` numeric,
  	\`user_id\` integer,
  	\`request_id\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`member_id\`) REFERENCES \`members\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`reward_adjustments_member_idx\` ON \`reward_adjustments\` (\`member_id\`);`)
  await db.run(sql`CREATE INDEX \`reward_adjustments_user_idx\` ON \`reward_adjustments\` (\`user_id\`);`)
  await db.run(sql`CREATE INDEX \`reward_adjustments_updated_at_idx\` ON \`reward_adjustments\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`reward_adjustments_created_at_idx\` ON \`reward_adjustments\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`rewards_settings_rewards\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`points_required\` numeric NOT NULL,
  	\`discount_cents\` numeric NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`rewards_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`rewards_settings_rewards_order_idx\` ON \`rewards_settings_rewards\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`rewards_settings_rewards_parent_id_idx\` ON \`rewards_settings_rewards\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`rewards_settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`enabled\` integer DEFAULT false,
  	\`approved\` integer DEFAULT false,
  	\`program_name\` text DEFAULT 'Rewards',
  	\`points_per_dollar\` numeric,
  	\`welcome_points\` numeric DEFAULT 0,
  	\`terms\` text,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`totals_discount_cents\` numeric DEFAULT 0;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`rewards_member_id\` integer REFERENCES members(id);`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`rewards_redeemed_points\` numeric;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`rewards_earn_points\` numeric;`)
  await db.run(sql`CREATE INDEX \`orders_rewards_rewards_member_idx\` ON \`orders\` (\`rewards_member_id\`);`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`rewards_member_id\` integer REFERENCES members(id);`)
  await db.run(sql`ALTER TABLE \`reservations\` ADD \`rewards_earn_points\` numeric;`)
  await db.run(sql`CREATE INDEX \`reservations_rewards_rewards_member_idx\` ON \`reservations\` (\`rewards_member_id\`);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`members_id\` integer REFERENCES members(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`reward_entries_id\` integer REFERENCES reward_entries(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`reward_adjustments_id\` integer REFERENCES reward_adjustments(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_members_id_idx\` ON \`payload_locked_documents_rels\` (\`members_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_reward_entries_id_idx\` ON \`payload_locked_documents_rels\` (\`reward_entries_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_reward_adjustments_id_idx\` ON \`payload_locked_documents_rels\` (\`reward_adjustments_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`members\`;`)
  await db.run(sql`DROP TABLE \`reward_entries\`;`)
  await db.run(sql`DROP TABLE \`reward_adjustments\`;`)
  await db.run(sql`DROP TABLE \`rewards_settings_rewards\`;`)
  await db.run(sql`DROP TABLE \`rewards_settings\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_orders\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`number\` text NOT NULL,
  	\`access_token_hash\` text NOT NULL,
  	\`idempotency_key\` text NOT NULL,
  	\`test_mode\` integer DEFAULT false,
  	\`payment_status\` text DEFAULT 'pending' NOT NULL,
  	\`fulfillment_status\` text DEFAULT 'awaiting_payment' NOT NULL,
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
  	\`payment_attempts\` numeric DEFAULT 0,
  	\`stock_status\` text DEFAULT 'none',
  	\`stock_owner\` text,
  	\`stock_plan\` text,
  	\`stock_note\` text,
  	\`emails_confirmation_sent_at\` text,
  	\`emails_staff_notified_at\` text,
  	\`emails_unknown_notified_at\` text,
  	\`emails_attention_notified_at\` text,
  	\`staff_notes\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`INSERT INTO \`__new_orders\`("id", "number", "access_token_hash", "idempotency_key", "test_mode", "payment_status", "fulfillment_status", "customer_name", "customer_email", "customer_phone", "pickup_date", "pickup_start", "pickup_end", "pickup_label", "notes", "lines", "totals_subtotal_cents", "totals_tax_cents", "totals_total_cents", "totals_tax_approved", "payment_provider", "payment_reference", "payment_attempts", "stock_status", "stock_owner", "stock_plan", "stock_note", "emails_confirmation_sent_at", "emails_staff_notified_at", "emails_unknown_notified_at", "emails_attention_notified_at", "staff_notes", "updated_at", "created_at") SELECT "id", "number", "access_token_hash", "idempotency_key", "test_mode", "payment_status", "fulfillment_status", "customer_name", "customer_email", "customer_phone", "pickup_date", "pickup_start", "pickup_end", "pickup_label", "notes", "lines", "totals_subtotal_cents", "totals_tax_cents", "totals_total_cents", "totals_tax_approved", "payment_provider", "payment_reference", "payment_attempts", "stock_status", "stock_owner", "stock_plan", "stock_note", "emails_confirmation_sent_at", "emails_staff_notified_at", "emails_unknown_notified_at", "emails_attention_notified_at", "staff_notes", "updated_at", "created_at" FROM \`orders\`;`)
  await db.run(sql`DROP TABLE \`orders\`;`)
  await db.run(sql`ALTER TABLE \`__new_orders\` RENAME TO \`orders\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE UNIQUE INDEX \`orders_number_idx\` ON \`orders\` (\`number\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`orders_idempotency_key_idx\` ON \`orders\` (\`idempotency_key\`);`)
  await db.run(sql`CREATE INDEX \`orders_pickup_pickup_date_idx\` ON \`orders\` (\`pickup_date\`);`)
  await db.run(sql`CREATE INDEX \`orders_stock_status_idx\` ON \`orders\` (\`stock_status\`);`)
  await db.run(sql`CREATE INDEX \`orders_updated_at_idx\` ON \`orders\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`orders_created_at_idx\` ON \`orders\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`__new_reservations\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`number\` text NOT NULL,
  	\`access_token_hash\` text NOT NULL,
  	\`idempotency_key\` text NOT NULL,
  	\`test_mode\` integer DEFAULT false,
  	\`reservation_status\` text DEFAULT 'awaiting_payment' NOT NULL,
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
  	\`payment_attempts\` numeric DEFAULT 0,
  	\`stock_status\` text DEFAULT 'none',
  	\`stock_owner\` text,
  	\`stock_plan\` text,
  	\`stock_note\` text,
  	\`emails_confirmation_sent_at\` text,
  	\`emails_staff_notified_at\` text,
  	\`emails_unknown_notified_at\` text,
  	\`emails_attention_notified_at\` text,
  	\`staff_notes\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`INSERT INTO \`__new_reservations\`("id", "number", "access_token_hash", "idempotency_key", "test_mode", "reservation_status", "payment_status", "customer_name", "customer_email", "customer_phone", "pickup_date", "pickup_start", "pickup_end", "pickup_label", "assembly", "basket", "total_cents", "tax_cents", "deposit_cents", "amount_paid_cents", "balance_due_cents", "tax_approved", "payment_provider", "payment_reference", "payment_attempts", "stock_status", "stock_owner", "stock_plan", "stock_note", "emails_confirmation_sent_at", "emails_staff_notified_at", "emails_unknown_notified_at", "emails_attention_notified_at", "staff_notes", "updated_at", "created_at") SELECT "id", "number", "access_token_hash", "idempotency_key", "test_mode", "reservation_status", "payment_status", "customer_name", "customer_email", "customer_phone", "pickup_date", "pickup_start", "pickup_end", "pickup_label", "assembly", "basket", "total_cents", "tax_cents", "deposit_cents", "amount_paid_cents", "balance_due_cents", "tax_approved", "payment_provider", "payment_reference", "payment_attempts", "stock_status", "stock_owner", "stock_plan", "stock_note", "emails_confirmation_sent_at", "emails_staff_notified_at", "emails_unknown_notified_at", "emails_attention_notified_at", "staff_notes", "updated_at", "created_at" FROM \`reservations\`;`)
  await db.run(sql`DROP TABLE \`reservations\`;`)
  await db.run(sql`ALTER TABLE \`__new_reservations\` RENAME TO \`reservations\`;`)
  await db.run(sql`CREATE UNIQUE INDEX \`reservations_number_idx\` ON \`reservations\` (\`number\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`reservations_idempotency_key_idx\` ON \`reservations\` (\`idempotency_key\`);`)
  await db.run(sql`CREATE INDEX \`reservations_pickup_pickup_date_idx\` ON \`reservations\` (\`pickup_date\`);`)
  await db.run(sql`CREATE INDEX \`reservations_stock_status_idx\` ON \`reservations\` (\`stock_status\`);`)
  await db.run(sql`CREATE INDEX \`reservations_updated_at_idx\` ON \`reservations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`reservations_created_at_idx\` ON \`reservations\` (\`created_at\`);`)
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
  	\`stock_movements_id\` integer,
  	\`stock_holds_id\` integer,
  	\`stock_adjustments_id\` integer,
  	\`outbox_id\` integer,
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
  	FOREIGN KEY (\`sync_jobs_id\`) REFERENCES \`sync_jobs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`stock_movements_id\`) REFERENCES \`stock_movements\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`stock_holds_id\`) REFERENCES \`stock_holds\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`stock_adjustments_id\`) REFERENCES \`stock_adjustments\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`outbox_id\`) REFERENCES \`outbox\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "orders_id", "reservations_id", "inquiries_id", "products_id", "categories_id", "media_id", "tax_classes_id", "carts_id", "source_records_id", "users_id", "audit_log_id", "sync_jobs_id", "stock_movements_id", "stock_holds_id", "stock_adjustments_id", "outbox_id") SELECT "id", "order", "parent_id", "path", "orders_id", "reservations_id", "inquiries_id", "products_id", "categories_id", "media_id", "tax_classes_id", "carts_id", "source_records_id", "users_id", "audit_log_id", "sync_jobs_id", "stock_movements_id", "stock_holds_id", "stock_adjustments_id", "outbox_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
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
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_stock_movements_id_idx\` ON \`payload_locked_documents_rels\` (\`stock_movements_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_stock_holds_id_idx\` ON \`payload_locked_documents_rels\` (\`stock_holds_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_stock_adjustments_id_idx\` ON \`payload_locked_documents_rels\` (\`stock_adjustments_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_outbox_id_idx\` ON \`payload_locked_documents_rels\` (\`outbox_id\`);`)
}
