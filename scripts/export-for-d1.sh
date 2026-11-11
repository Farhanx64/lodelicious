#!/bin/sh
# Turn a SQLite database file from the Node host into one SQL file that D1 accepts (D51).
#
#   sh scripts/export-for-d1.sh .data/lodelicious.db d1-import.sql
#   npx wrangler d1 execute D1 --remote --file d1-import.sql      (--local to rehearse)
#
# Why not a plain `.dump`: D1 refuses BEGIN/COMMIT and `PRAGMA foreign_keys`, and it checks foreign
# keys while it loads, so a row cannot be inserted before the table it points to exists. This
# writes every table first, then every row, with the checks deferred to the end of the import.
# The row ids, the `payload_migrations` history and the indexes come across unchanged.
# Run it while nothing is writing to the database (stop the site or work on a copy).
set -eu

db="${1:?usage: export-for-d1.sh <database.db> <output.sql>}"
out="${2:?usage: export-for-d1.sh <database.db> <output.sql>}"

[ -f "$db" ] || { echo "No database file at $db" >&2; exit 1; }
command -v sqlite3 >/dev/null || { echo "sqlite3 is not installed" >&2; exit 1; }
# `.dump --data-only` needs sqlite3 3.37 or newer.
sqlite3 :memory: ".dump --data-only" >/dev/null 2>&1 || { echo "sqlite3 is too old (needs 3.37+): $(sqlite3 --version)" >&2; exit 1; }

{
  echo "PRAGMA defer_foreign_keys = true;"
  # Tables only; indexes go last so the rows load faster and in any order.
  sqlite3 -readonly "$db" "SELECT sql || ';' FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'libsql_%' ORDER BY rowid;"
  sqlite3 -readonly "$db" ".dump --data-only" | grep -vE '^(PRAGMA |BEGIN TRANSACTION;|COMMIT;)' | grep -vE '^(INSERT INTO|DELETE FROM) "?sqlite_'
  sqlite3 -readonly "$db" "SELECT sql || ';' FROM sqlite_master WHERE type IN ('index', 'trigger', 'view') AND sql IS NOT NULL ORDER BY rowid;"
} > "$out"

tables=$(sqlite3 -readonly "$db" "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';")
rows=$(grep -c '^INSERT INTO' "$out" || true)
echo "Wrote $out: $tables tables, $rows rows."
