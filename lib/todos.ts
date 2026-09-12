import "server-only";
import type { RequestContext } from "@mastra/core/request-context";
import { createTool } from "@mastra/core/tools";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { type Todo, todos } from "@/lib/schema";

/**
 * The RequestContext key holding the signed-in user's id. The CopilotKit route
 * sets it from the verified session; nothing the model or the browser sends can
 * reach it, because MastraAgent files client-supplied context under its own
 * "ag-ui" key instead.
 */
export const USER_ID_KEY = "userId";

// The queries live apart from the tools so components/todos-sidebar.tsx reads
// through the same ones, and so tests can drive them without a tool context.

/** Open items first, newest first within each group. */
export async function listUserTodos(userId: string): Promise<Todo[]> {
  return await db
    .select()
    .from(todos)
    .where(eq(todos.userId, userId))
    .orderBy(asc(todos.done), desc(todos.createdAt));
}

export async function addUserTodo(
  userId: string,
  title: string,
): Promise<Todo> {
  const [row] = await db
    .insert(todos)
    .values({ userId, title: title.trim() })
    .returning();

  if (!row) {
    throw new Error("The to-do could not be written.");
  }
  return row;
}

/** Null when the id is not this user's, which is how another user's item is refused. */
export async function setUserTodoDone(
  userId: string,
  id: string,
  done: boolean,
): Promise<Todo | null> {
  // Matched on the owner as well as the id, so another user's item matches
  // nothing here rather than being updated.
  const [row] = await db
    .update(todos)
    .set({ done })
    .where(and(eq(todos.id, id), eq(todos.userId, userId)))
    .returning();

  return row ?? null;
}

/** Every tool is scoped by this, so an absent id must fail, not read everything. */
export function requireUserId(context: {
  requestContext?: RequestContext;
}): string {
  const userId = context?.requestContext?.get(USER_ID_KEY);

  if (typeof userId !== "string" || userId === "") {
    throw new Error(
      "No user id on the request context; the to-do tools refuse to run unscoped.",
    );
  }
  return userId;
}

const todoShape = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
  createdAt: z.string(),
});

function serialize(todo: Todo) {
  return {
    id: todo.id,
    title: todo.title,
    done: todo.done,
    createdAt: todo.createdAt.toISOString(),
  };
}

export const listTodos = createTool({
  id: "listTodos",
  description:
    "Read back the user's to-do list. Call this before answering what is on the list, and before completing an item, since it returns the ids.",
  inputSchema: z.object({}),
  outputSchema: z.object({ todos: z.array(todoShape) }),
  execute: async (_input, context) => {
    const rows = await listUserTodos(requireUserId(context));
    return { todos: rows.map(serialize) };
  },
});

export const addTodo = createTool({
  id: "addTodo",
  description: "Add one item to the user's to-do list.",
  inputSchema: z.object({
    title: z
      .string()
      .min(1)
      .max(200)
      .describe('The item as the user would recognise it, e.g. "buy milk".'),
  }),
  outputSchema: z.object({ todo: todoShape }),
  execute: async ({ title }, context) => {
    const row = await addUserTodo(requireUserId(context), title);
    return { todo: serialize(row) };
  },
});

export const setTodoDone = createTool({
  id: "setTodoDone",
  description:
    "Mark one of the user's to-do items done, or put a completed one back on the list.",
  inputSchema: z.object({
    id: z.string().describe("The item's id, as returned by listTodos."),
    done: z
      .boolean()
      .describe("True to complete the item, false to reopen it."),
  }),
  outputSchema: z.object({ updated: z.boolean(), todo: todoShape.nullable() }),
  execute: async ({ id, done }, context) => {
    const row = await setUserTodoDone(requireUserId(context), id, done);

    return row
      ? { updated: true, todo: serialize(row) }
      : { updated: false, todo: null };
  },
});

/** Keyed by the name the model and the AG-UI stream see. */
export const todoTools = { listTodos, addTodo, setTodoDone };
