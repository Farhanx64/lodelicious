import * as migration_20260925_182201_initial from './20260925_182201_initial';
import * as migration_20260925_184633_gift_builder_settings from './20260925_184633_gift_builder_settings';
import * as migration_20260926_203209_catalog_products_baby_containers from './20260926_203209_catalog_products_baby_containers';

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
    name: '20260926_203209_catalog_products_baby_containers'
  },
];
