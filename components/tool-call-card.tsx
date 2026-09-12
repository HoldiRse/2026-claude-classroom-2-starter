/**
 * One tool call in the chat transcript: a plain-English line saying what the
 * agent did with the list, expandable to the raw input and output.
 *
 * Purely presentational so it can be tested without CopilotKit;
 * components/chat.tsx registers it for every tool and supplies `running`.
 */

type Status = "inProgress" | "executing" | "complete";

/** `failed` is a call that never returned — Mastra emits no result for a tool that throws. */
type Phase = "running" | "done" | "refused" | "failed";

type Todo = { title?: unknown; done?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function quoted(title: unknown) {
  return typeof title === "string" && title.trim() !== ""
    ? `“${title.trim()}”`
    : null;
}

/** The runtime hands the result over as the JSON the tool returned, stringified. */
function parseResult(result: string | undefined): unknown {
  if (result === undefined) return undefined;
  try {
    return JSON.parse(result);
  } catch {
    return result;
  }
}

function describe(
  name: string,
  args: Record<string, unknown>,
  output: unknown,
  complete: boolean,
): { label: string; refused?: boolean } {
  const out = isRecord(output) ? output : {};

  switch (name) {
    case "listTodos": {
      if (!complete) return { label: "Reading your list" };
      const rows = Array.isArray(out.todos) ? (out.todos as Todo[]) : [];
      if (rows.length === 0) return { label: "Read your list · empty" };
      const open = rows.filter((row) => row?.done !== true).length;
      const items = rows.length === 1 ? "1 item" : `${rows.length} items`;
      return { label: `Read your list · ${items}, ${open} open` };
    }

    case "addTodo": {
      const saved = isRecord(out.todo) ? out.todo.title : undefined;
      const title = quoted(saved) ?? quoted(args.title);
      if (!complete) return { label: `Adding ${title ?? "an item"}` };
      return { label: `Added ${title ?? "an item"}` };
    }

    case "setTodoDone": {
      const reopen = args.done === false;
      if (!complete) {
        return { label: reopen ? "Reopening an item" : "Striking an item off" };
      }
      if (out.updated !== true) {
        return { label: "No such item on your list", refused: true };
      }
      const title =
        quoted(isRecord(out.todo) ? out.todo.title : undefined) ?? "an item";
      return { label: reopen ? `Reopened ${title}` : `Struck off ${title}` };
    }

    default:
      return { label: complete ? `Used ${name}` : `Using ${name}` };
  }
}

function StatusIcon({ phase }: { phase: Phase }) {
  if (phase === "running") {
    return (
      <span
        aria-hidden="true"
        className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-zinc-700 dark:border-t-zinc-200"
      />
    );
  }

  const glyph = { done: "✓", refused: "!", failed: "✕" }[phase];
  const tone = {
    done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    refused:
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    failed: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  }[phase];

  return (
    <span
      aria-hidden="true"
      className={`flex size-4 shrink-0 select-none items-center justify-center rounded-full text-[10px] font-bold ${tone}`}
    >
      {glyph}
    </span>
  );
}

function Payload({ label, value }: { label: string; value: unknown }) {
  const text =
    value === undefined
      ? "—"
      : typeof value === "string"
        ? value
        : JSON.stringify(value, null, 2);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-zinc-50 px-2 py-1.5 font-mono text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        {text}
      </pre>
    </div>
  );
}

export function ToolCallCard({
  name,
  status,
  args,
  result,
  running,
}: {
  name: string;
  status: Status;
  args: unknown;
  result?: string;
  /** Whether the agent's run is still going; a call without a result after it ends failed. */
  running: boolean;
}) {
  const complete = status === "complete";
  const input = isRecord(args) ? args : {};
  const output = parseResult(result);
  const { label, refused } = describe(name, input, output, complete);

  const phase: Phase = complete
    ? refused
      ? "refused"
      : "done"
    : running
      ? "running"
      : "failed";

  const text =
    phase === "running"
      ? `${label}…`
      : phase === "failed"
        ? `${label} — didn’t finish`
        : label;

  return (
    <details
      data-testid="tool-call"
      data-tool={name}
      data-phase={phase}
      className="group my-2 rounded-lg border border-zinc-200 bg-white text-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <StatusIcon phase={phase} />
        <span
          role="status"
          className="min-w-0 flex-1 truncate text-zinc-800 dark:text-zinc-200"
        >
          {text}
        </span>
        <code className="shrink-0 font-mono text-xs text-zinc-400 dark:text-zinc-500">
          {name}
        </code>
        <span
          aria-hidden="true"
          className="shrink-0 select-none text-xs text-zinc-400 transition-transform group-open:rotate-90"
        >
          ›
        </span>
      </summary>
      <div className="flex flex-col gap-2 border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <Payload label="Input" value={args} />
        <Payload label="Output" value={output} />
      </div>
    </details>
  );
}
