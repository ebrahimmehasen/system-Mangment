import assert from "node:assert/strict";
import { test } from "node:test";
import { bucketizeTasks, lateSinceYmd, parseTaskForm, parseTaskPriority, shiftYmd } from "./tasks";

const at = (iso: string) => new Date(iso);
const task = (id: string, dueDate: Date | null, priority = 0, status = "todo") => ({
  id,
  dueDate,
  priority,
  status,
});

test("parseTaskPriority accepts blank, 0..99 and rejects the rest", () => {
  assert.equal(parseTaskPriority(""), 0);
  assert.equal(parseTaskPriority("0"), 0);
  assert.equal(parseTaskPriority("99"), 99);
  assert.equal(parseTaskPriority("100"), null);
  assert.equal(parseTaskPriority("-1"), null);
  assert.equal(parseTaskPriority("5.5"), null);
});

test("parseTaskForm reads and validates the priority field", () => {
  const form = (priority: string) => {
    const f = new FormData();
    f.set("title", "t");
    f.set("priority", priority);
    return parseTaskForm(f);
  };
  assert.equal(form("7").parsed.priority, 7);
  assert.equal(form("").parsed.priority, 0);
  assert.ok(form("100").errors.priority);
});

test("shiftYmd crosses month boundaries", () => {
  assert.equal(shiftYmd("2026-09-30", 1), "2026-10-01");
  assert.equal(shiftYmd("2026-10-01", -1), "2026-09-30");
});

test("a column orders open tasks 1 (most important) first, no-priority after, done last", () => {
  const due = at("2026-10-05T10:00:00Z");
  const { days } = bucketizeTasks(
    [task("b", due, 5), task("done1", due, 1, "done"), task("a", due, 2), task("none", due, 0)],
    "2026-10-05",
    "2026-10-05",
    "2026-10-05",
  );
  assert.deepEqual(days[0].tasks.map((t) => t.id), ["a", "b", "none", "done1"]);
});

test("no-date and overdue columns are sorted by priority too", () => {
  const { noDate, overdue } = bucketizeTasks(
    [
      task("n1", null, 1),
      task("n2", null, 9),
      task("o1", at("2026-10-01T10:00:00Z"), 1),
      task("o2", at("2026-10-02T10:00:00Z"), 9),
    ],
    "2026-10-05",
    "2026-10-06", // today is outside the window, so late tasks fall back to the overdue list
    "2026-10-07",
  );
  assert.deepEqual(noDate.map((t) => t.id), ["n1", "n2"]);
  assert.deepEqual(overdue.map((t) => t.id), ["o1", "o2"]);
});

test("a task at 23:30 UTC lands on the next Cairo day", () => {
  const { days } = bucketizeTasks(
    [task("late", at("2026-10-05T23:30:00Z"))],
    "2026-10-05",
    "2026-10-05",
    "2026-10-07",
    true,
  );
  assert.equal(days.find((d) => d.ymd === "2026-10-06")?.tasks.length, 1);
  assert.equal(days.find((d) => d.ymd === "2026-10-05")?.tasks.length, 0);
});

test("an open task from a past day shows on today's column, not in a separate overdue list", () => {
  const { overdue, days } = bucketizeTasks(
    [task("late", at("2026-10-03T10:00:00Z"))],
    "2026-10-05",
    "2026-10-05",
    "2026-10-07",
    true,
  );
  assert.equal(overdue.length, 0);
  assert.deepEqual(days.find((d) => d.ymd === "2026-10-05")?.tasks.map((t) => t.id), ["late"]);
});

test("a late task that was finished stays findable on the day it was finished", () => {
  const done = { ...task("d", at("2026-10-03T10:00:00Z"), 0, "done"), completedAt: at("2026-10-05T09:00:00Z") };
  const { days } = bucketizeTasks([done], "2026-10-05", "2026-10-05", "2026-10-07", true);
  assert.deepEqual(days.find((d) => d.ymd === "2026-10-05")?.tasks.map((t) => t.id), ["d"]);
});

test("a task finished early stays on its due day", () => {
  const done = { ...task("e", at("2026-10-07T10:00:00Z"), 0, "done"), completedAt: at("2026-10-05T09:00:00Z") };
  const { days } = bucketizeTasks([done], "2026-10-05", "2026-10-05", "2026-10-07", true);
  assert.deepEqual(days.find((d) => d.ymd === "2026-10-07")?.tasks.map((t) => t.id), ["e"]);
});

test("lateSinceYmd reports the first missed day, before and after the nightly roll", () => {
  const today = "2026-10-05";
  assert.equal(lateSinceYmd({ status: "todo", dueDate: at("2026-10-03T10:00:00Z"), overdueSince: null }, today), "2026-10-03");
  assert.equal(
    lateSinceYmd({ status: "todo", dueDate: at("2026-10-05T10:00:00Z"), overdueSince: at("2026-10-03T10:00:00Z") }, today),
    "2026-10-03",
  );
  assert.equal(lateSinceYmd({ status: "done", dueDate: at("2026-10-03T10:00:00Z"), overdueSince: null }, today), null);
  assert.equal(lateSinceYmd({ status: "todo", dueDate: at("2026-10-08T10:00:00Z"), overdueSince: at("2026-10-03T10:00:00Z") }, today), null);
  assert.equal(lateSinceYmd({ status: "todo", dueDate: at("2026-10-05T10:00:00Z"), overdueSince: null }, today), null);
});
