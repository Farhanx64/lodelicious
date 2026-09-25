import * as migration_20260925_182201_initial from './20260925_182201_initial';

export const migrations = [
  {
    up: migration_20260925_182201_initial.up,
    down: migration_20260925_182201_initial.down,
    name: '20260925_182201_initial'
  },
];
