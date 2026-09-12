// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RequestContext } from "@mastra/core/request-context";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { drizzle } from "drizzle-orm/libsql/node";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { todos, user } from "@/lib/schema";

// lib/todos.ts reaches the database through the `server-only` lib/db.ts, which
// binds DATABASE_URL at import time — hence the stub and the late import below.
vi.mock("server-only", () => ({}));

let dir: string;
let db: ReturnType<typeof drizzle>;
let tools: typeof import("@/lib/todos");

/** What the CopilotKit route hands the tools for a signed-in user. */
function contextFor(userId: string) {
  const requestContext = new RequestContext();
  requestContext.set("userId", userId);
  return { requestContext };
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "ai-tutor-todos-"));
  const url = `file:${join(dir, "test.db")}`;

  db = drizzle({ connection: { url } });
  await migrate(db, { migrationsFolder: "./drizzle" });

  // todos.userId is a FK onto the Better Auth user table.
  await db.insert(user).values([
    { id: "user-1", name: "User One", email: "one@example.com" },
    { id: "user-2", name: "User Two", email: "two@example.com" },
  ]);

  vi.stubEnv("DATABASE_URL", url);
  // lib/db.ts caches its connection on globalThis; drop it so the tools open
  // this file rather than whatever another test file left behind.
  delete (globalThis as { db?: unknown }).db;
  tools = await import("@/lib/todos");
});

afterAll(async () => {
  db.$client.close();
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

beforeEach(async () => {
  await db.delete(todos);
});

test("adds an item for one user and reads it back", async () => {
  const added = await tools.addUserTodo("user-1", "buy milk");

  expect(added).toMatchObject({ title: "buy milk", done: false });
  expect(added.id).toEqual(expect.any(String));

  const listed = await tools.listUserTodos("user-1");
  expect(listed).toEqual([added]);
});

test("never reads one user's list into another's", async () => {
  await tools.addUserTodo("user-1", "buy milk");

  expect(await tools.listUserTodos("user-2")).toEqual([]);
});

test("completes and reopens the user's own item", async () => {
  const { id } = await tools.addUserTodo("user-1", "buy milk");

  await expect(
    tools.setUserTodoDone("user-1", id, true),
  ).resolves.toMatchObject({ id, done: true });
  await expect(
    tools.setUserTodoDone("user-1", id, false),
  ).resolves.toMatchObject({ id, done: false });
});

test("refuses to complete an item belonging to someone else", async () => {
  const { id } = await tools.addUserTodo("user-1", "buy milk");

  expect(await tools.setUserTodoDone("user-2", id, true)).toBeNull();

  // The row is matched on owner as well as id, so it is untouched rather than
  // merely unreported.
  const [row] = await db.select().from(todos).where(eq(todos.id, id));
  expect(row.done).toBe(false);
});

test("takes the user id from the request context the route builds", () => {
  expect(tools.requireUserId(contextFor("user-1"))).toBe("user-1");
});

test("refuses to run unscoped when no user id is on the request context", () => {
  expect(() =>
    tools.requireUserId({ requestContext: new RequestContext() }),
  ).toThrow(/user id/i);
  expect(() => tools.requireUserId({})).toThrow(/user id/i);
});

test("registers the three tools under the names the model and client use", () => {
  // components/todos-refresh.tsx keys its refresh off these two names.
  expect(Object.keys(tools.todoTools)).toEqual([
    "listTodos",
    "addTodo",
    "setTodoDone",
  ]);
});
