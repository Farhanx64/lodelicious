import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`policies\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`pickup_and_delivery_title\` text,
  	\`pickup_and_delivery_body\` text,
  	\`pickup_and_delivery_approved\` integer DEFAULT false,
  	\`pickup_and_delivery_last_reviewed\` text,
  	\`cancellations_and_refunds_title\` text,
  	\`cancellations_and_refunds_body\` text,
  	\`cancellations_and_refunds_approved\` integer DEFAULT false,
  	\`cancellations_and_refunds_last_reviewed\` text,
  	\`substitutions_and_dietary_requests_title\` text,
  	\`substitutions_and_dietary_requests_body\` text,
  	\`substitutions_and_dietary_requests_approved\` integer DEFAULT false,
  	\`substitutions_and_dietary_requests_last_reviewed\` text,
  	\`damaged_or_missing_items_title\` text,
  	\`damaged_or_missing_items_body\` text,
  	\`damaged_or_missing_items_approved\` integer DEFAULT false,
  	\`damaged_or_missing_items_last_reviewed\` text,
  	\`privacy_title\` text,
  	\`privacy_body\` text,
  	\`privacy_approved\` integer DEFAULT false,
  	\`privacy_last_reviewed\` text,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`policies\`;`)
}
