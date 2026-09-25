#!/usr/bin/env bash
# Start/stop the project-local MariaDB instance in .local/mysql. Usage: bin/db.sh start|stop|status
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$ROOT/.env" ] || cp "$ROOT/.env.example" "$ROOT/.env"
set -a; . "$ROOT/.env"; set +a

LOCAL="$ROOT/.local"
DB_DIR="$LOCAL/mysql"
SOCK="$LOCAL/mysql.sock"
PID="$LOCAL/mysql.pid"

running() { [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; }

case "${1:-status}" in
	start)
		if running; then echo "    MariaDB already running"; exit 0; fi
		if [ ! -d "$DB_DIR/mysql" ]; then
			mkdir -p "$DB_DIR"
			mariadb-install-db --user="$(id -un)" --datadir="$DB_DIR" --auth-root-authentication-method=socket >/dev/null
		fi
		mariadbd --user="$(id -un)" --datadir="$DB_DIR" --socket="$SOCK" --pid-file="$PID" \
			--bind-address=127.0.0.1 --port="$LDL_DB_PORT" --log-error="$LOCAL/logs/mariadb.err" \
			--innodb-buffer-pool-size=128M >/dev/null 2>&1 &
		for _ in $(seq 1 30); do
			if mariadb-admin --socket="$SOCK" -uroot ping >/dev/null 2>&1; then echo "    MariaDB started"; exit 0; fi
			sleep 1
		done
		echo "MariaDB failed to start; see .local/logs/mariadb.err" >&2
		exit 1
		;;
	stop)
		if running; then mariadb-admin --socket="$SOCK" -uroot shutdown; echo "    MariaDB stopped"; fi
		;;
	status)
		if running; then echo "running"; else echo "stopped"; exit 1; fi
		;;
	*)
		echo "usage: $0 start|stop|status" >&2
		exit 2
		;;
esac
