import * as migration_20260925_182201_initial from './20260925_182201_initial';
import * as migration_20260925_184633_gift_builder_settings from './20260925_184633_gift_builder_settings';
import * as migration_20260926_203209_catalog_products_baby_containers from './20260926_203209_catalog_products_baby_containers';
import * as migration_20260926_205140_sympathy_basket_size from './20260926_205140_sympathy_basket_size';
import * as migration_20261001_002245_clover_reserve_sizes_doordash from './20261001_002245_clover_reserve_sizes_doordash';
import * as migration_20261003_072516_store_story from './20261003_072516_store_story';

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
];
