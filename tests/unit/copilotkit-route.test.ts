// @vitest-environment node
import type { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, test, vi } from "vitest";

// All three are `server-only` and open a database on import, so the gate is
// tested against stand-ins; only the branch before them is under test here.
const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/lib/tutor", () => ({ TUTOR_AGENT_ID: "tutor", mastra: {} }));
vi.mock("@/lib/todos", () => ({ USER_ID_KEY: "userId" }));

const getLocalAgent = vi.fn(
  (_options: { resourceId: string; requestContext: RequestContext }) => ({
    agentId: "tutor",
  }),
);
vi.mock("@ag-ui/mastra", () => ({ MastraAgent: { getLocalAgent } }));

const runtimeHandler = vi.fn(async () => new Response("ok"));
vi.mock("@copilotkit/runtime/v2", () => ({
  CopilotRuntime: vi.fn(function CopilotRuntime(this: unknown) {}),
  createCopilotRuntimeHandler: vi.fn(() => runtimeHandler),
}));

const { GET, POST } = await import("@/app/api/copilotkit/[...all]/route");

const runRequest = () =>
  new Request("http://localhost/api/copilotkit/agent/tutor/run", {
    method: "POST",
    body: "{}",
  });

describe("the CopilotKit route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("rejects a request without a session and never reaches the agent", async () => {
    getSession.mockResolvedValue(null);

    const response = await POST(runRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(getLocalAgent).not.toHaveBeenCalled();
    expect(runtimeHandler).not.toHaveBeenCalled();
  });

  test("gates GET as well, so the agent is not discoverable either", async () => {
    getSession.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/copilotkit/info"),
    );

    expect(response.status).toBe(401);
    expect(runtimeHandler).not.toHaveBeenCalled();
  });

  test("scopes the agent's memory to the session's user id", async () => {
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const response = await POST(runRequest());

    expect(response.status).toBe(200);
    expect(getLocalAgent).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: "tutor", resourceId: "user-a" }),
    );
  });

  test("hands the to-do tools the session's user id on the request context", async () => {
    getSession.mockResolvedValue({ user: { id: "user-c" } });

    await POST(runRequest());

    const options = getLocalAgent.mock.calls[0][0];
    expect(options.requestContext.get("userId")).toBe("user-c");
  });

  test("takes the user id from the session, not from the request", async () => {
    getSession.mockResolvedValue({ user: { id: "user-b" } });

    await POST(
      new Request("http://localhost/api/copilotkit/agent/tutor/run", {
        method: "POST",
        headers: { "x-user-id": "user-a" },
        body: JSON.stringify({ threadId: "tutor:user-a" }),
      }),
    );

    expect(getLocalAgent).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: "user-b" }),
    );
  });
});
