import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`home_page_strip_images\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`image_id\` integer NOT NULL,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`home_page\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`home_page_strip_images_order_idx\` ON \`home_page_strip_images\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`home_page_strip_images_parent_id_idx\` ON \`home_page_strip_images\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`home_page_strip_images_image_idx\` ON \`home_page_strip_images\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`home_page\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_store_settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text DEFAULT 'Souset-Pink' NOT NULL,
  	\`tagline\` text DEFAULT 'Sweets · Chocolates · Gifts',
  	\`street\` text DEFAULT '24 Manomet Point Rd.' NOT NULL,
  	\`locality\` text DEFAULT 'Plymouth, MA 02360' NOT NULL,
  	\`phone\` text DEFAULT '(774) 283-4676' NOT NULL,
  	\`email\` text DEFAULT 'lodelicious1@gmail.com' NOT NULL,
  	\`doordash_url\` text,
  	\`story_heading\` text DEFAULT 'Our story',
  	\`story\` text,
  	\`timezone\` text DEFAULT 'America/New_York' NOT NULL,
  	\`hours_label\` text DEFAULT 'Fall & winter hours' NOT NULL,
  	\`allergy_notice\` text DEFAULT 'Our chocolates and fudge contain common allergens and may be made in facilities that process nuts and other allergens. We cannot guarantee products are completely free from traces of nuts or other allergens. Please contact us before ordering if you have a food allergy or specific dietary requirement so we can check current product information.' NOT NULL,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`INSERT INTO \`__new_store_settings\`("id", "name", "tagline", "street", "locality", "phone", "email", "doordash_url", "story_heading", "story", "timezone", "hours_label", "allergy_notice", "updated_at", "created_at") SELECT "id", "name", 'Sweets · Chocolates · Gifts', "street", "locality", "phone", "email", "doordash_url", "story_heading", "story", "timezone", "hours_label", "allergy_notice", "updated_at", "created_at" FROM \`store_settings\`;`)
  await db.run(sql`DROP TABLE \`store_settings\`;`)
  await db.run(sql`ALTER TABLE \`__new_store_settings\` RENAME TO \`store_settings\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  // The tagline column is new, so the copy above fills it with its default. Rename the shop to the
  // mood board's brand unless staff already chose a different name (D31).
  await db.run(sql`UPDATE \`store_settings\` SET \`name\` = 'Souset-Pink' WHERE \`name\` = 'Lodelicious Gifts & Sweets';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`home_page_strip_images\`;`)
  await db.run(sql`DROP TABLE \`home_page\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_store_settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text DEFAULT 'Lodelicious Gifts & Sweets' NOT NULL,
  	\`street\` text DEFAULT '24 Manomet Point Rd.' NOT NULL,
  	\`locality\` text DEFAULT 'Plymouth, MA 02360' NOT NULL,
  	\`phone\` text DEFAULT '(774) 283-4676' NOT NULL,
  	\`email\` text DEFAULT 'lodelicious1@gmail.com' NOT NULL,
  	\`doordash_url\` text,
  	\`story_heading\` text DEFAULT 'Our story',
  	\`story\` text,
  	\`timezone\` text DEFAULT 'America/New_York' NOT NULL,
  	\`hours_label\` text DEFAULT 'Fall & winter hours' NOT NULL,
  	\`allergy_notice\` text DEFAULT 'Our chocolates and fudge contain common allergens and may be made in facilities that process nuts and other allergens. We cannot guarantee products are completely free from traces of nuts or other allergens. Please contact us before ordering if you have a food allergy or specific dietary requirement so we can check current product information.' NOT NULL,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`INSERT INTO \`__new_store_settings\`("id", "name", "street", "locality", "phone", "email", "doordash_url", "story_heading", "story", "timezone", "hours_label", "allergy_notice", "updated_at", "created_at") SELECT "id", "name", "street", "locality", "phone", "email", "doordash_url", "story_heading", "story", "timezone", "hours_label", "allergy_notice", "updated_at", "created_at" FROM \`store_settings\`;`)
  await db.run(sql`DROP TABLE \`store_settings\`;`)
  await db.run(sql`ALTER TABLE \`__new_store_settings\` RENAME TO \`store_settings\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
}
