import http from "http";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { expressMiddleware } from "@as-integrations/express5";
import { GraphQLError } from "graphql";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/use/ws";

import { schema } from "./graphql/schema.js";
import { createContext, createWsContext } from "./graphql/context.js";
import { AppError } from "./utils/errors.js";
import { prisma } from "./config/prisma.js";

export async function createApp() {
  const app = express();
  const httpServer = http.createServer(app);

  const corsOrigin = process.env.CORS_ORIGIN ?? "*";
  app.use(cors({ origin: corsOrigin === "*" ? true : corsOrigin.split(",") }));
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.json({
      message: "Welcome to DevConnectQL API",
      graphql: "/graphql",
      health: "/health"
    });
  });

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "devconnectql-api",
      database: "postgresql",
      auth: "jwt"
    });
  });

  const wsServer = new WebSocketServer({ server: httpServer, path: "/graphql" });
  const wsServerCleanup = useServer({ schema, context: createWsContext }, wsServer);

  const apolloServer = new ApolloServer({
    schema,
    includeStacktraceInErrorResponses: false,
    formatError: (formattedError, error) => {
      const isAppError =
        error instanceof AppError ||
        (error instanceof GraphQLError && error.originalError instanceof AppError);

      if (isAppError) {
        return formattedError;
      }

      console.error(error);

      return new GraphQLError("Internal server error", {
        extensions: { code: "INTERNAL_SERVER_ERROR", http: { status: 500 } }
      }).toJSON();
    },
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await wsServerCleanup.dispose();
            }
          };
        }
      }
    ]
  });

  await apolloServer.start();

  app.use(
    "/graphql",
    expressMiddleware(apolloServer, {
      context: async ({ req }) => createContext({ req })
    })
  );

  async function shutdown() {
    await apolloServer.stop();
    await prisma.$disconnect();
  }

  return { httpServer, shutdown };
}
