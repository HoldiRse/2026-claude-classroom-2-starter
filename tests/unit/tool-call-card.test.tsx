import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { ToolCallCard } from "@/components/tool-call-card";

const card = () => screen.getByTestId("tool-call");

test("a call still streaming reads as in progress", () => {
  render(
    <ToolCallCard
      name="addTodo"
      status="executing"
      args={{ title: "buy milk" }}
      running
    />,
  );

  expect(card()).toHaveAttribute("data-phase", "running");
  expect(screen.getByRole("status")).toHaveTextContent("Adding “buy milk”…");
});

test("a finished addTodo names the saved title and shows input and output", () => {
  render(
    <ToolCallCard
      name="addTodo"
      status="complete"
      args={{ title: "buy milk " }}
      result={JSON.stringify({ todo: { id: "t1", title: "buy milk" } })}
      running
    />,
  );

  expect(card()).toHaveAttribute("data-phase", "done");
  expect(screen.getByRole("status")).toHaveTextContent("Added “buy milk”");
  expect(card()).toHaveTextContent('"title": "buy milk "');
  expect(card()).toHaveTextContent('"id": "t1"');
});

test("listTodos summarises the count and how many are open", () => {
  const todos = [
    { id: "a", title: "one", done: false },
    { id: "b", title: "two", done: true },
    { id: "c", title: "three", done: false },
  ];
  render(
    <ToolCallCard
      name="listTodos"
      status="complete"
      args={{}}
      result={JSON.stringify({ todos })}
      running={false}
    />,
  );

  expect(screen.getByRole("status")).toHaveTextContent(
    "Read your list · 3 items, 2 open",
  );
});

test("setTodoDone distinguishes striking off, reopening and a refused id", () => {
  const { rerender } = render(
    <ToolCallCard
      name="setTodoDone"
      status="complete"
      args={{ id: "a", done: true }}
      result={JSON.stringify({ updated: true, todo: { title: "one" } })}
      running={false}
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Struck off “one”");

  rerender(
    <ToolCallCard
      name="setTodoDone"
      status="complete"
      args={{ id: "a", done: false }}
      result={JSON.stringify({ updated: true, todo: { title: "one" } })}
      running={false}
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Reopened “one”");

  rerender(
    <ToolCallCard
      name="setTodoDone"
      status="complete"
      args={{ id: "someone-elses", done: true }}
      result={JSON.stringify({ updated: false, todo: null })}
      running={false}
    />,
  );
  expect(card()).toHaveAttribute("data-phase", "refused");
  expect(screen.getByRole("status")).toHaveTextContent(
    "No such item on your list",
  );
});

test("a call left without a result once the run ends reads as failed", () => {
  render(
    <ToolCallCard
      name="listTodos"
      status="inProgress"
      args={{}}
      running={false}
    />,
  );

  expect(card()).toHaveAttribute("data-phase", "failed");
  expect(screen.getByRole("status")).toHaveTextContent(
    "Reading your list — didn’t finish",
  );
});

test("an unknown tool still gets a card", () => {
  render(
    <ToolCallCard
      name="somethingElse"
      status="complete"
      args={{}}
      result="plain text"
      running={false}
    />,
  );

  expect(screen.getByRole("status")).toHaveTextContent("Used somethingElse");
  expect(card()).toHaveTextContent("plain text");
});
