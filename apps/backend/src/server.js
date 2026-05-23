import http from "http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { initSockets } from "./sockets/index.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

async function bootstrap() {
  await connectDatabase();

  const app = createApp();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: env.corsOrigins, credentials: true },
  });

  app.set("io", io);
  initSockets(io);

  server.listen(env.port, () => {
    logger.info(`API running on ${env.apiBaseUrl} [${env.nodeEnv}]`);
    logger.info(`Swagger: ${env.apiBaseUrl}/api/docs`);
  });
}

bootstrap().catch((err) => {
  logger.error("Failed to start server", { error: err.message });
  process.exit(1);
});
