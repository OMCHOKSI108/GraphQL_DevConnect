import { ValidationError } from "./errors.js";

export type Cursor = { id: string; createdAt: string };

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64");
}

export function decodeCursor(cursor: string): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));

    if (typeof parsed.id !== "string") {
      throw new Error("bad cursor");
    }

    return parsed;
  } catch {
    throw new ValidationError("Invalid pagination cursor");
  }
}

export type ConnectionArgs = { first?: number | null; after?: string | null };

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export type PaginatedResult<T> = {
  edges: { cursor: string; node: T }[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  totalCount: number;
};

export async function paginate<T extends { id: string; createdAt: Date }>(
  fetchPage: (params: { take: number; cursor?: { id: string }; skip?: number }) => Promise<T[]>,
  countTotal: () => Promise<number>,
  args: ConnectionArgs
): Promise<PaginatedResult<T>> {
  const take = Math.min(args.first ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const cursorArg = args.after ? { id: decodeCursor(args.after).id } : undefined;

  const [rows, totalCount] = await Promise.all([
    fetchPage({
      take: take + 1,
      cursor: cursorArg,
      skip: cursorArg ? 1 : 0
    }),
    countTotal()
  ]);

  const hasNextPage = rows.length > take;
  const page = hasNextPage ? rows.slice(0, take) : rows;

  const edges = page.map((node) => ({
    cursor: encodeCursor({ id: node.id, createdAt: node.createdAt.toISOString() }),
    node
  }));

  return {
    edges,
    pageInfo: {
      hasNextPage,
      endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
    },
    totalCount
  };
}
