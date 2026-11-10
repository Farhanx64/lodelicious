import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`store_settings_promo_slides\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`text\` text NOT NULL,
  	\`link_url\` text,
  	\`link_label\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`store_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`store_settings_promo_slides_order_idx\` ON \`store_settings_promo_slides\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`store_settings_promo_slides_parent_id_idx\` ON \`store_settings_promo_slides\` (\`_parent_id\`);`)
  await db.run(sql`ALTER TABLE \`store_settings\` ADD \`promo_enabled\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`store_settings\` ADD \`promo_seconds\` numeric DEFAULT 5;`)
  // Field defaults only reach a brand-new row, so give an existing Store details row the season's slides.
  const slides = [
    ['November fall deals — fall baskets are coming in', '/shop', 'Shop fall'],
    ['Thanksgiving baskets are in season. Choose your basket now', '/build-a-basket', 'Choose your basket'],
  ]
  for (const [order, [text, linkUrl, linkLabel]] of slides.entries()) {
    const id = crypto.randomUUID().replaceAll('-', '').slice(0, 24)
    await db.run(sql`INSERT INTO \`store_settings_promo_slides\` (\`_order\`, \`_parent_id\`, \`id\`, \`text\`, \`link_url\`, \`link_label\`)
      SELECT ${order + 1}, \`id\`, ${id}, ${text}, ${linkUrl}, ${linkLabel} FROM \`store_settings\` LIMIT 1;`)
  }
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`store_settings_promo_slides\`;`)
  await db.run(sql`ALTER TABLE \`store_settings\` DROP COLUMN \`promo_enabled\`;`)
  await db.run(sql`ALTER TABLE \`store_settings\` DROP COLUMN \`promo_seconds\`;`)
}
