/**
 * Custom Next.js server for LiteSpeed / Phusion Passenger (cPanel Node.js app).
 *
 * IMPORTANT: No top-level await. LiteSpeed's lsnode.js loads this file via
 * require(), and require() throws ERR_REQUIRE_ASYNC_MODULE on an ESM module
 * that uses top-level await. Keep all async work inside .then() callbacks.
 *
 * PORT may be a numeric TCP port (manual/dev) or a Unix socket path (Passenger).
 *
 * After deploy or code changes: touch tmp/restart.txt to reload the app.
 */

import { createServer } from "node:http";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const portOrSocket = process.env.PORT || "3000";
const isSocket = isNaN(Number(portOrSocket));
const listenTarget = isSocket ? portOrSocket : parseInt(portOrSocket, 10);
const hostname = isSocket ? undefined : (process.env.HOST || "localhost");

const app = next({ dev, hostname, port: isSocket ? 0 : listenTarget });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = createServer((req, res) => {
      handle(req, res);
    });

    server.listen(listenTarget, hostname, () => {
      if (isSocket) {
        console.log(`> Lodelicious ready on socket ${listenTarget}`);
      } else {
        console.log(`> Lodelicious ready on http://${hostname}:${listenTarget}`);
      }
    });
  })
  .catch((err) => {
    console.error("Failed to start Next.js server:", err);
    process.exit(1);
  });
