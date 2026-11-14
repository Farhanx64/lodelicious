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
import * as migration_20261008_010254_email_settings from './20261008_010254_email_settings';
import * as migration_20261014_185249_member_rewards from './20261014_185249_member_rewards';
import * as migration_20261108_050119_promo_banner from './20261108_050119_promo_banner';
import * as migration_20261110_185702_premium_no_limit from './20261110_185702_premium_no_limit';
import * as migration_20261111_120000_brand_color from './20261111_120000_brand_color';
import * as migration_20261111_130000_button_color from './20261111_130000_button_color';
import * as migration_20261111_140000_media_object_key from './20261111_140000_media_object_key';
import * as migration_20261111_211711_reviews from './20261111_211711_reviews';
import * as migration_20261112_013115_color_palette from './20261112_013115_color_palette';
import * as migration_20261112_014718_checkout_shipping_payments from './20261112_014718_checkout_shipping_payments';
import * as migration_20261114_035407_shipping_boxes from './20261114_035407_shipping_boxes';
import * as migration_20261114_171155_status_emails from './20261114_171155_status_emails';

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
    name: '20261008_002231_checkout_hardening',
  },
  {
    up: migration_20261008_010254_email_settings.up,
    down: migration_20261008_010254_email_settings.down,
    name: '20261008_010254_email_settings',
  },
  {
    up: migration_20261014_185249_member_rewards.up,
    down: migration_20261014_185249_member_rewards.down,
    name: '20261014_185249_member_rewards',
  },
  {
    up: migration_20261108_050119_promo_banner.up,
    down: migration_20261108_050119_promo_banner.down,
    name: '20261108_050119_promo_banner',
  },
  {
    up: migration_20261110_185702_premium_no_limit.up,
    down: migration_20261110_185702_premium_no_limit.down,
    name: '20261110_185702_premium_no_limit',
  },
  {
    up: migration_20261111_120000_brand_color.up,
    down: migration_20261111_120000_brand_color.down,
    name: '20261111_120000_brand_color',
  },
  {
    up: migration_20261111_130000_button_color.up,
    down: migration_20261111_130000_button_color.down,
    name: '20261111_130000_button_color',
  },
  {
    up: migration_20261111_140000_media_object_key.up,
    down: migration_20261111_140000_media_object_key.down,
    name: '20261111_140000_media_object_key',
  },
  {
    up: migration_20261111_211711_reviews.up,
    down: migration_20261111_211711_reviews.down,
    name: '20261111_211711_reviews',
  },
  {
    up: migration_20261112_013115_color_palette.up,
    down: migration_20261112_013115_color_palette.down,
    name: '20261112_013115_color_palette',
  },
  {
    up: migration_20261112_014718_checkout_shipping_payments.up,
    down: migration_20261112_014718_checkout_shipping_payments.down,
    name: '20261112_014718_checkout_shipping_payments',
  },
  {
    up: migration_20261114_035407_shipping_boxes.up,
    down: migration_20261114_035407_shipping_boxes.down,
    name: '20261114_035407_shipping_boxes',
  },
  {
    up: migration_20261114_171155_status_emails.up,
    down: migration_20261114_171155_status_emails.down,
    name: '20261114_171155_status_emails'
  },
];
