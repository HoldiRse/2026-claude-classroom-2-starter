// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// Counts connections: every LibSQLStore opens its own libSQL client.
const { storesOpened } = vi.hoisted(() => ({ storesOpened: vi.fn() }));
vi.mock("@mastra/libsql", async (importOriginal) => {
  const { LibSQLStore } =
    await importOriginal<typeof import("@mastra/libsql")>();
  return {
    LibSQLStore: class extends LibSQLStore {
      constructor(...args: ConstructorParameters<typeof LibSQLStore>) {
        super(...args);
        storesOpened();
      }
    },
  };
});
vi.mock("server-only", () => ({}));

const globals = globalThis as { tutorStorage?: unknown; mastra?: unknown };

// A fresh module registry stands in for a `next dev` hot reload.
async function reload() {
  vi.resetModules();
  const { mastra, TUTOR_AGENT_ID } = await import("@/lib/tutor");
  return { mastra, agent: mastra.getAgent(TUTOR_AGENT_ID) };
}

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", ":memory:");
  storesOpened.mockClear();
  delete globals.tutorStorage;
  delete globals.mastra;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test("development rebuilds the agent on reload but keeps the connection", async () => {
  vi.stubEnv("NODE_ENV", "development");

  const first = await reload();
  const second = await reload();

  expect(second.mastra).not.toBe(first.mastra);
  expect(second.agent).not.toBe(first.agent);
  expect(storesOpened).toHaveBeenCalledTimes(1);
});

test("production keeps one instance across re-evaluations", async () => {
  vi.stubEnv("NODE_ENV", "production");

  const first = await reload();
  const second = await reload();

  expect(second.mastra).toBe(first.mastra);
  expect(storesOpened).toHaveBeenCalledTimes(1);
});
