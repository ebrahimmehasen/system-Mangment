import assert from "node:assert/strict";
import { test } from "node:test";
import { bucketizeTasks, parseTaskPriority, shiftYmd } from "./tasks";

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

test("shiftYmd crosses month boundaries", () => {
  assert.equal(shiftYmd("2026-09-30", 1), "2026-10-01");
  assert.equal(shiftYmd("2026-10-01", -1), "2026-09-30");
});

test("a column orders open tasks by priority desc, done tasks last", () => {
  const due = at("2026-10-05T10:00:00Z");
  const { days } = bucketizeTasks(
    [task("low", due, 5), task("done-high", due, 99, "done"), task("high", due, 50), task("none", due, 0)],
    "2026-10-05",
    "2026-10-05",
    "2026-10-05",
  );
  assert.deepEqual(days[0].tasks.map((t) => t.id), ["high", "low", "none", "done-high"]);
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
    "2026-10-05",
    "2026-10-06",
  );
  assert.deepEqual(noDate.map((t) => t.id), ["n2", "n1"]);
  assert.deepEqual(overdue.map((t) => t.id), ["o2", "o1"]);
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
