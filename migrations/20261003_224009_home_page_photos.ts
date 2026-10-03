import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`home_page_feature_images\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`image_id\` integer NOT NULL,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`home_page\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`home_page_feature_images_order_idx\` ON \`home_page_feature_images\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`home_page_feature_images_parent_id_idx\` ON \`home_page_feature_images\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`home_page_feature_images_image_idx\` ON \`home_page_feature_images\` (\`image_id\`);`)
  await db.run(sql`ALTER TABLE \`home_page\` ADD \`hero_image_id\` integer REFERENCES media(id);`)
  await db.run(sql`CREATE INDEX \`home_page_hero_image_idx\` ON \`home_page\` (\`hero_image_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`home_page_feature_images\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_home_page\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`INSERT INTO \`__new_home_page\`("id", "updated_at", "created_at") SELECT "id", "updated_at", "created_at" FROM \`home_page\`;`)
  await db.run(sql`DROP TABLE \`home_page\`;`)
  await db.run(sql`ALTER TABLE \`__new_home_page\` RENAME TO \`home_page\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
}
