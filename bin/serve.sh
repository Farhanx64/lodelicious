#!/usr/bin/env bash
# Serve the local preview with PHP's built-in server using the production PHP limits.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$ROOT/.env" ] || cp "$ROOT/.env.example" "$ROOT/.env"
set -a; . "$ROOT/.env"; set +a

"$ROOT/bin/db.sh" start
echo "==> http://localhost:$LDL_PORT  (Ctrl+C to stop)"
exec php -d memory_limit=512M -d max_execution_time=300 \
	-S "127.0.0.1:$LDL_PORT" -t "$ROOT/.local/wordpress" "$ROOT/bin/router.php"
