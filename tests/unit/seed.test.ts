// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { betterAuth } from "better-auth";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { drizzle } from "drizzle-orm/libsql/node";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { authOptions } from "@/lib/auth-config";
import { todos, user } from "@/lib/schema";
import { DEMO_STUDENT, seedDemoStudent } from "@/scripts/seed";

let dir: string;
let db: ReturnType<typeof drizzle>;

const now = new Date("2026-09-13T12:00:00Z");

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "ai-tutor-seed-"));
  db = drizzle({ connection: { url: `file:${join(dir, "seed.db")}` } });
  await migrate(db, { migrationsFolder: "./drizzle" });

  // The seed's Better Auth instance reads these itself; Vitest loads no .env.
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-at-least-32-characters-long");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
});

afterAll(async () => {
  db.$client.close();
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

test("creates the demo student with a dozen recent to-dos, some done", async () => {
  const { userId, count } = await seedDemoStudent(db, now);

  const rows = await db.select().from(todos).where(eq(todos.userId, userId));
  expect(rows).toHaveLength(12);
  expect(count).toBe(12);

  const done = rows.filter((row) => row.done).length;
  expect(done).toBeGreaterThan(0);
  expect(done).toBeLessThan(rows.length);

  const twoWeeksAgo = now.getTime() - 14 * 24 * 60 * 60 * 1000;
  for (const row of rows) {
    expect(row.createdAt.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(row.createdAt.getTime()).toBeGreaterThan(twoWeeksAgo);
  }
  expect(new Set(rows.map((row) => row.createdAt.getTime())).size).toBe(12);
});

test("re-running reuses the account and replaces its list", async () => {
  const first = await seedDemoStudent(db, now);
  const second = await seedDemoStudent(db, now);

  expect(second.userId).toBe(first.userId);
  expect(
    await db.select().from(user).where(eq(user.email, DEMO_STUDENT.email)),
  ).toHaveLength(1);
  expect(
    await db.select().from(todos).where(eq(todos.userId, second.userId)),
  ).toHaveLength(12);
});

test("the published demo password signs in", async () => {
  await seedDemoStudent(db, now);

  const auth = betterAuth({
    ...authOptions(db),
    secret: "test-secret-at-least-32-characters-long",
    baseURL: "http://localhost:3000",
    plugins: [],
  });
  const session = await auth.api.signInEmail({
    body: { email: DEMO_STUDENT.email, password: DEMO_STUDENT.password },
  });

  expect(session.user.email).toBe(DEMO_STUDENT.email);
});
