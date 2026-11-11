#!/bin/sh
# Turn a SQLite database file from the Node host into one SQL file that D1 accepts (D51).
#
#   sh scripts/export-for-d1.sh .data/lodelicious.db d1-import.sql
#   npx wrangler d1 execute D1 --remote --file d1-import.sql      (--local to rehearse)
#
# Why not a plain `.dump`: D1 refuses BEGIN/COMMIT and `PRAGMA foreign_keys`, and it checks foreign
# keys while it loads, so a row cannot be inserted before the table it points to exists. This
# writes every table first, then every row, parents first: the real D1 does not honour
# `PRAGMA defer_foreign_keys` during a `--file` import (the local emulation does), so the rows of a
# table only come after the rows of every table it points to. A cycle between tables stops the
# export. A table that points to itself keeps its rows in rowid order.
# The row ids, the `payload_migrations` history and the indexes come across unchanged.
# Run it while nothing is writing to the database (stop the site or work on a copy).
set -eu

db="${1:?usage: export-for-d1.sh <database.db> <output.sql>}"
out="${2:?usage: export-for-d1.sh <database.db> <output.sql>}"

[ -f "$db" ] || { echo "No database file at $db" >&2; exit 1; }
command -v sqlite3 >/dev/null || { echo "sqlite3 is not installed" >&2; exit 1; }
# `.dump --data-only` needs sqlite3 3.37 or newer.
sqlite3 :memory: ".dump --data-only" >/dev/null 2>&1 || { echo "sqlite3 is too old (needs 3.37+): $(sqlite3 --version)" >&2; exit 1; }

# Every table, parents before the tables that point to them: depth = longest chain of foreign keys
# down to a table that points nowhere. A chain longer than the number of tables means a cycle.
order_sql="
WITH RECURSIVE
  t(name) AS (SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'),
  e(child, parent) AS (
    SELECT DISTINCT t.name, f.\"table\" FROM t, pragma_foreign_key_list(t.name) AS f
    WHERE f.\"table\" <> t.name AND f.\"table\" IN (SELECT name FROM t)),
  d(name, depth) AS (
    SELECT name, 0 FROM t
    UNION
    SELECT e.child, d.depth + 1 FROM e JOIN d ON e.parent = d.name WHERE d.depth <= (SELECT count(*) FROM t))
SELECT name, max(depth) FROM d GROUP BY name ORDER BY max(depth), name;"
ranked=$(sqlite3 -readonly -separator ' ' "$db" "$order_sql")
ntables=$(sqlite3 -readonly "$db" "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';")
cyclic=$(echo "$ranked" | awk -v n="$ntables" '$2 > n { print $1 }')
[ -z "$cyclic" ] || { echo "Foreign keys form a cycle; cannot order the rows parents-first. Tables: $(echo $cyclic)" >&2; exit 1; }
order=$(echo "$ranked" | awk '{ print $1 }')

{
  echo "PRAGMA defer_foreign_keys = true;"
  # Tables only; indexes go last so the rows load faster and in any order.
  sqlite3 -readonly "$db" "SELECT sql || ';' FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'libsql_%' ORDER BY rowid;"
  sqlite3 -readonly "$db" ".dump --data-only" | grep -vE '^(PRAGMA |BEGIN TRANSACTION;|COMMIT;)' | grep -vE '^(INSERT INTO|DELETE FROM) "?sqlite_' |
    ORDER="$order" awk '
      BEGIN { n = split(ENVIRON["ORDER"], names, "\n") }
      {
        if ($0 !~ /^INSERT INTO /) { print "export-for-d1: unexpected line in the dump: " substr($0, 1, 80) > "/dev/stderr"; bad = 1; exit 1 }
        t = $3; sub(/\(.*/, "", t); gsub(/"/, "", t)
        if (!(t in rows)) seen[++m] = t
        rows[t] = rows[t] $0 "\n"
      }
      END {
        if (bad) exit 1
        for (i = 1; i <= n; i++) if (names[i] in rows) { printf "%s", rows[names[i]]; done[names[i]] = 1 }
        for (i = 1; i <= m; i++) if (!(seen[i] in done)) { print "export-for-d1: rows for unknown table " seen[i] > "/dev/stderr"; exit 1 }
      }'
  sqlite3 -readonly "$db" "SELECT sql || ';' FROM sqlite_master WHERE type IN ('index', 'trigger', 'view') AND sql IS NOT NULL ORDER BY rowid;"
} > "$out"

tables=$(sqlite3 -readonly "$db" "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';")
rows=$(grep -c '^INSERT INTO' "$out" || true)
echo "Wrote $out: $tables tables, $rows rows."
