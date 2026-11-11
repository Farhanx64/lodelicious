import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

// The real D1 checks foreign keys row by row during a `--file` import (it ignores
// `PRAGMA defer_foreign_keys`), so the export must write parent rows before child rows.
const hasSqlite = spawnSync("sqlite3", ["-version"]).status === 0;
const script = path.resolve(__dirname, "../scripts/export-for-d1.sh");
const dirs: string[] = [];

function tempDb(sql: string): { db: string; out: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "export-d1-"));
  dirs.push(dir);
  const db = path.join(dir, "source.db");
  execFileSync("sqlite3", [db, sql]);
  return { db, out: path.join(dir, "out.sql") };
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe.skipIf(!hasSqlite)("scripts/export-for-d1.sh", () => {
  it("writes parent rows first, so the file loads with foreign keys enforced and no deferral", () => {
    // "a_child" sorts (and is created) before "z_parent", which is what broke the plain dump order.
    const { db, out } = tempDb(`
      CREATE TABLE a_child (id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL REFERENCES z_parent(id));
      CREATE TABLE z_parent (id INTEGER PRIMARY KEY, grand_id INTEGER REFERENCES m_grand(id));
      CREATE TABLE m_grand (id INTEGER PRIMARY KEY);
      INSERT INTO m_grand VALUES (1);
      INSERT INTO z_parent VALUES (1, 1);
      INSERT INTO a_child VALUES (1, 1), (2, 1);
    `);
    execFileSync("sh", [script, db, out]);
    const sql = fs.readFileSync(out, "utf8");
    const inserts = sql.split("\n").filter((line) => line.startsWith("INSERT INTO"));
    expect(inserts.map((line) => line.split(/[ (]/)[2])).toEqual(["m_grand", "z_parent", "a_child", "a_child"]);

    const strict = path.join(path.dirname(out), "strict.db");
    const load = spawnSync("sqlite3", ["-bail", strict], {
      input: `PRAGMA foreign_keys = ON;\n${sql.replace(/^PRAGMA defer_foreign_keys.*$/m, "")}`,
    });
    expect(load.status, load.stderr.toString()).toBe(0);
    expect(execFileSync("sqlite3", [strict, "SELECT count(*) FROM a_child;"]).toString().trim()).toBe("2");
  });

  it("stops on a cycle between tables instead of writing a file D1 would refuse", () => {
    const { db, out } = tempDb(`
      CREATE TABLE a (id INTEGER PRIMARY KEY, b_id INTEGER REFERENCES b(id));
      CREATE TABLE b (id INTEGER PRIMARY KEY, a_id INTEGER REFERENCES a(id));
      INSERT INTO a VALUES (1, NULL);
    `);
    const run = spawnSync("sh", [script, db, out]);
    expect(run.status).toBe(1);
    expect(run.stderr.toString()).toMatch(/cycle/);
  });
});
