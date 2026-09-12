"use client";

import { useAgent } from "@copilotkit/react-core/v2";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

// The two tools in lib/todos.ts that change rows; listTodos only reads.
const WRITE_TOOLS = new Set(["addTodo", "setTodoDone"]);

/**
 * The sidebar is a Server Component, so a write becomes visible by re-rendering
 * the route. Refreshes as soon as a write tool returns, and once more when the
 * run ends, in case no result event arrives for it.
 */
export function TodosRefresh({ agentId }: { agentId: string }) {
  const router = useRouter();
  const { agent, isReady } = useAgent({ agentId });

  // Owned by the component rather than the agent: `agent` is swapped once, when
  // the runtime's /info resolves, and anything hung off it would go with it.
  const pending = useRef(new Set<string>());
  const changed = useRef(false);

  useEffect(() => {
    // Until /info resolves, `agent` is a provisional stand-in that gets replaced.
    if (!isReady) return;

    const subscription = agent.subscribe({
      onToolCallEndEvent: ({ event, toolCallName }) => {
        if (!WRITE_TOOLS.has(toolCallName)) return;
        pending.current.add(event.toolCallId);
        changed.current = true;
      },
      onToolCallResultEvent: ({ event }) => {
        if (!pending.current.delete(event.toolCallId)) return;
        router.refresh();
      },
      onRunFinishedEvent: () => {
        if (!changed.current) return;
        changed.current = false;
        pending.current.clear();
        router.refresh();
      },
    });

    return () => subscription.unsubscribe();
  }, [agent, isReady, router]);

  return null;
}
