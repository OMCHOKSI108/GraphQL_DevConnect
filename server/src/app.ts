import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { ApolloServerPluginLandingPageDisabled } from "@apollo/server/plugin/disabled";
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
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", "https:", "data:"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "https:", "'unsafe-inline'"],
        upgradeInsecureRequests: [],
      },
    },
  }));
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, private");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    next();
  });
  app.use(cors({ origin: corsOrigin === "*" ? true : corsOrigin.split(",") }));
  app.use(express.json({ limit: "10kb" }));

  const graphqlLimiter = rateLimit({
    windowMs: 60_000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { errors: [{ message: "Too many requests, please try again later" }] }
  });
  app.use("/graphql", graphqlLimiter);

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

  app.get("/graphql", (_req, res) => {
    res.json({ message: "DevConnectQL API — send POST requests with Content-Type: application/json" });
  });

  const wsServer = new WebSocketServer({ server: httpServer, path: "/graphql" });
  const wsServerCleanup = useServer({ schema, context: createWsContext }, wsServer);

  const apolloServer = new ApolloServer({
    schema,
    includeStacktraceInErrorResponses: false,
    maxRecursiveSelections: 7,
    formatError: (formattedError, error) => {
      const code = formattedError.extensions?.code as string | undefined;

      if (code !== "INTERNAL_SERVER_ERROR") {
        return formattedError;
      }

      if (error instanceof AppError) {
        return formattedError;
      }

      if (error instanceof GraphQLError && error.originalError instanceof AppError) {
        return formattedError;
      }

      console.error(error);

      return new GraphQLError("Internal server error", {
        extensions: { code: "INTERNAL_SERVER_ERROR", http: { status: 500 } }
      }).toJSON();
    },
    plugins: [
      ApolloServerPluginLandingPageDisabled(),
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

  app.use((_req, res) => {
    res.json({ error: "Not found" });
  });

  async function shutdown() {
    await apolloServer.stop();
    await prisma.$disconnect();
  }

  return { httpServer, shutdown };
}
