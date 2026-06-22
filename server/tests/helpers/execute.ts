import { graphql } from "graphql";
import { schema } from "../../src/graphql/schema.js";
import type { GraphQLContext } from "../../src/graphql/context.js";

export async function executeOperation(params: {
  query: string;
  variables?: Record<string, unknown>;
  contextValue: GraphQLContext;
}) {
  return graphql({
    schema,
    source: params.query,
    variableValues: params.variables,
    contextValue: params.contextValue
  });
}
