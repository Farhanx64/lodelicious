import * as migration_20260925_182201_initial from './20260925_182201_initial';
import * as migration_20260925_184633_gift_builder_settings from './20260925_184633_gift_builder_settings';
import * as migration_20260926_203209_catalog_products_baby_containers from './20260926_203209_catalog_products_baby_containers';
import * as migration_20260926_205140_sympathy_basket_size from './20260926_205140_sympathy_basket_size';
import * as migration_20261001_002245_clover_reserve_sizes_doordash from './20261001_002245_clover_reserve_sizes_doordash';
import * as migration_20261003_072516_store_story from './20261003_072516_store_story';
import * as migration_20261003_092317_home_page_brand from './20261003_092317_home_page_brand';
import * as migration_20261003_225023_home_page_hero from './20261003_225023_home_page_hero';
import * as migration_20261003_232800_home_favorites_layout from './20261003_232800_home_favorites_layout';
import * as migration_20261005_210313_checkout_reservations from './20261005_210313_checkout_reservations';
import * as migration_20261007_022011_inquiries_events from './20261007_022011_inquiries_events';
import * as migration_20261007_023832_policies from './20261007_023832_policies';
import * as migration_20261007_032358_inventory from './20261007_032358_inventory';
import * as migration_20261008_002231_checkout_hardening from './20261008_002231_checkout_hardening';

export const migrations = [
  {
    up: migration_20260925_182201_initial.up,
    down: migration_20260925_182201_initial.down,
    name: '20260925_182201_initial',
  },
  {
    up: migration_20260925_184633_gift_builder_settings.up,
    down: migration_20260925_184633_gift_builder_settings.down,
    name: '20260925_184633_gift_builder_settings',
  },
  {
    up: migration_20260926_203209_catalog_products_baby_containers.up,
    down: migration_20260926_203209_catalog_products_baby_containers.down,
    name: '20260926_203209_catalog_products_baby_containers',
  },
  {
    up: migration_20260926_205140_sympathy_basket_size.up,
    down: migration_20260926_205140_sympathy_basket_size.down,
    name: '20260926_205140_sympathy_basket_size',
  },
  {
    up: migration_20261001_002245_clover_reserve_sizes_doordash.up,
    down: migration_20261001_002245_clover_reserve_sizes_doordash.down,
    name: '20261001_002245_clover_reserve_sizes_doordash',
  },
  {
    up: migration_20261003_072516_store_story.up,
    down: migration_20261003_072516_store_story.down,
    name: '20261003_072516_store_story',
  },
  {
    up: migration_20261003_092317_home_page_brand.up,
    down: migration_20261003_092317_home_page_brand.down,
    name: '20261003_092317_home_page_brand',
  },
  {
    up: migration_20261003_225023_home_page_hero.up,
    down: migration_20261003_225023_home_page_hero.down,
    name: '20261003_225023_home_page_hero',
  },
  {
    up: migration_20261003_232800_home_favorites_layout.up,
    down: migration_20261003_232800_home_favorites_layout.down,
    name: '20261003_232800_home_favorites_layout',
  },
  {
    up: migration_20261005_210313_checkout_reservations.up,
    down: migration_20261005_210313_checkout_reservations.down,
    name: '20261005_210313_checkout_reservations',
  },
  {
    up: migration_20261007_022011_inquiries_events.up,
    down: migration_20261007_022011_inquiries_events.down,
    name: '20261007_022011_inquiries_events',
  },
  {
    up: migration_20261007_023832_policies.up,
    down: migration_20261007_023832_policies.down,
    name: '20261007_023832_policies',
  },
  {
    up: migration_20261007_032358_inventory.up,
    down: migration_20261007_032358_inventory.down,
    name: '20261007_032358_inventory',
  },
  {
    up: migration_20261008_002231_checkout_hardening.up,
    down: migration_20261008_002231_checkout_hardening.down,
    name: '20261008_002231_checkout_hardening'
  },
];
