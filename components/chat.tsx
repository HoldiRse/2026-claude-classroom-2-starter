"use client";

import {
  CopilotChat,
  CopilotKit,
  defineToolCallRenderer,
  UseAgentUpdate,
  useAgent,
} from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import type { ComponentProps, ReactNode } from "react";
import { TodosRefresh } from "@/components/todos-refresh";
import { ToolCallCard } from "@/components/tool-call-card";

/**
 * Supplies the one thing the card cannot know from its props: whether the run
 * is still going. Mastra emits no result for a tool that throws, so a call still
 * without one after the run ends has failed rather than being in progress.
 */
function ToolCall(props: Omit<ComponentProps<typeof ToolCallCard>, "running">) {
  // No agentId: inside CopilotChat this resolves to the chat's own agent.
  const { agent } = useAgent({ updates: [UseAgentUpdate.OnRunStatusChanged] });
  return <ToolCallCard {...props} running={agent.isRunning} />;
}

// Without a renderer CopilotChat paints a tool call as blank space. Module-level
// because the provider requires `renderToolCalls` to be a stable array.
const renderToolCalls = [
  defineToolCallRenderer({
    name: "*",
    render: ({ name, status, args, result }) => (
      <ToolCall name={name} status={status} args={args} result={result} />
    ),
  }),
];

/**
 * `threadId` is handed down from the server-rendered session rather than picked
 * here, so a reload rejoins the same Mastra thread instead of starting a new
 * one. See lib/tutor.ts for why a forged one is useless.
 *
 * `sidebar` is the server-rendered to-do list; it is passed through as a node so
 * it stays a Server Component inside this client shell.
 */
export function Chat({
  agentId,
  threadId,
  sidebar,
}: {
  agentId: string;
  threadId: string;
  sidebar: ReactNode;
}) {
  return (
    // The Inspector is on by default in development builds and never loads in a
    // production one, so `enableInspector` is left unset deliberately;
    // `showDevConsole` is deprecated and no longer controls it either way.
    // app/globals.css moves its launcher off the header's sign-out button.
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      credentials="include"
      renderToolCalls={renderToolCalls}
    >
      <div className="flex h-full">
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-zinc-200 bg-white sm:block dark:border-zinc-800 dark:bg-zinc-950">
          {sidebar}
        </aside>
        <div className="min-w-0 flex-1">
          <CopilotChat
            agentId={agentId}
            threadId={threadId}
            className="mx-auto h-full w-full max-w-3xl"
            labels={{
              chatInputPlaceholder: "Add something to the list…",
            }}
          />
        </div>
      </div>
      <TodosRefresh agentId={agentId} />
    </CopilotKit>
  );
}
