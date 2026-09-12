import { listUserTodos } from "@/lib/todos";

/**
 * Read-only by design: the agent's tools in lib/todos.ts are the only write
 * path, and this reads through the same query they do.
 * components/todos-refresh.tsx re-renders this route when one of them changes a
 * row.
 */
export async function TodosSidebar({ userId }: { userId: string }) {
  const rows = await listUserTodos(userId);

  const open = rows.filter((todo) => !todo.done).length;

  return (
    <div data-testid="todos-sidebar" className="flex flex-col gap-3 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        To-do{open > 0 ? ` · ${open}` : ""}
      </h2>

      {rows.length === 0 ? (
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Nothing on the list yet. Ask Bartholomew to add something.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((todo) => (
            <li key={todo.id} className="flex items-start gap-2 text-sm">
              <span
                aria-hidden="true"
                className="mt-px select-none text-xs text-zinc-400 dark:text-zinc-600"
              >
                {todo.done ? "✓" : "○"}
              </span>
              <span
                className={
                  todo.done
                    ? "text-zinc-400 line-through dark:text-zinc-600"
                    : "text-zinc-800 dark:text-zinc-200"
                }
              >
                {todo.title}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
