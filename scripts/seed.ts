// Gives a fresh clone something to show: `npm run db:seed` after
// `npm run db:migrate` creates a demo student with a dozen to-dos. Safe to
// re-run — the account is reused and its list replaced.
//
// Runs under tsx outside Next.js, so it opens its own connection instead of
// importing the `server-only` lib/db.ts.
import { pathToFileURL } from "node:url";
import { betterAuth } from "better-auth";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql/node";
import { authOptions } from "@/lib/auth-config";
import { todos, user } from "@/lib/schema";

type Db = ReturnType<typeof drizzle>;

/** The password is only set when the account is first created. */
export const DEMO_STUDENT = {
  name: "Demo Student",
  email: "demo@example.com",
  password: "demo-password-123",
};

const DAY_MS = 24 * 60 * 60 * 1000;

// [title, days ago, done] — oldest first, all within the past two weeks.
const DEMO_TODOS: [string, number, boolean][] = [
  ["Pay the library fine for the overdue statistics book", 13, true],
  ["Email Dr. Okafor about the lab report extension", 12, true],
  ["Read chapters 4 and 5 of the organic chemistry textbook", 11, true],
  ["Book a slot at the careers service CV clinic", 10, true],
  ["Fill in the scholarship renewal form", 9, false],
  ["Write up the titration lab report", 8, false],
  ["Finish problem set 6 for linear algebra", 7, false],
  ["Draft the introduction for the history essay", 5, false],
  ["Make flashcards for the microbiology midterm", 4, false],
  ["Renew the student bus pass", 3, false],
  ["Buy a lab coat and safety goggles", 2, false],
  ["Reply to the group project thread about Friday's presentation", 0, false],
];

export async function seedDemoStudent(db: Db, now = new Date()) {
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, DEMO_STUDENT.email));

  let userId = existing?.id;
  if (!userId) {
    // Through Better Auth rather than a raw insert, so the password is hashed
    // the way sign-in expects.
    const auth = betterAuth({ ...authOptions(db), plugins: [] });
    const { user: created } = await auth.api.signUpEmail({
      body: DEMO_STUDENT,
    });
    userId = created.id;
  }

  const rows = DEMO_TODOS.map(([title, daysAgo, done]) => ({
    userId,
    title,
    done,
    createdAt: new Date(now.getTime() - daysAgo * DAY_MS),
  }));

  await db.transaction(async (tx) => {
    await tx.delete(todos).where(eq(todos.userId, userId));
    await tx.insert(todos).values(rows);
  });

  return { userId, count: rows.length };
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Refusing to seed: the demo account's password is published in the README.",
    );
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — see .env");
  }

  const db = drizzle({ connection: { url } });
  try {
    const { count } = await seedDemoStudent(db);
    console.log(
      `Seeded ${count} to-dos. Sign in as ${DEMO_STUDENT.email} / ${DEMO_STUDENT.password}`,
    );
  } finally {
    db.$client.close();
  }
}

// Only when run directly, so tests/unit/seed.test.ts can import seedDemoStudent.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
