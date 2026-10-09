import { buildApp } from "./app.js";
import { buildSyncApp } from "./modules/sync/routes.js";
import { env } from "./env.js";

async function main() {
  const app = await buildApp();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info(`NyaySetu Gov API listening on :${env.PORT} (${env.NODE_ENV})`);

  // The internal listener is a separate server. In Docker its port is NOT published; only the citizen API
  // (on the private sync network) can reach it.
  const sync = await buildSyncApp();
  await sync.listen({ port: env.SYNC_PORT, host: "0.0.0.0" });
  sync.log.info(`internal sync listener on :${env.SYNC_PORT}`);
}

main().catch((err) => {
  console.error("failed to start:", err);
  process.exit(1);
});
