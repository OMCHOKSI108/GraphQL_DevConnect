import "dotenv/config";
import { createApp } from "./app.js";

const port = Number(process.env.PORT || 4000);

const { httpServer, shutdown } = await createApp();

httpServer.listen(port, () => {
  console.log(`DevConnectQL API running on http://localhost:${port}`);
  console.log(`GraphQL endpoint: http://localhost:${port}/graphql`);
  console.log(`GraphQL subscriptions: ws://localhost:${port}/graphql`);
});

let shuttingDown = false;

async function handleShutdownSignal(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`Received ${signal}, shutting down gracefully...`);

  try {
    await shutdown();
    console.log("Shutdown complete.");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => handleShutdownSignal("SIGTERM"));
process.on("SIGINT", () => handleShutdownSignal("SIGINT"));
