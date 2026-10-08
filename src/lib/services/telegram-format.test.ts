import assert from "node:assert/strict";
import { test } from "node:test";
import { escapeHtml, formatDigest, formatTasks, parseBotCommand } from "./telegram-format";

test("parseBotCommand handles slash, bot suffix, payload and Arabic words", () => {
  assert.deepEqual(parseBotCommand("/start ABC123"), { command: "start", arg: "ABC123" });
  assert.deepEqual(parseBotCommand("/start@MyBot ABC123"), { command: "start", arg: "ABC123" });
  assert.equal(parseBotCommand("/today").command, "today");
  assert.equal(parseBotCommand("المهام").command, "tasks");
  assert.equal(parseBotCommand("hello there").command, "unknown");
  assert.equal(parseBotCommand("").command, "unknown");
});

test("user text is HTML-escaped so a title cannot inject markup", () => {
  assert.equal(escapeHtml("<b>x</b> & y"), "&lt;b&gt;x&lt;/b&gt; &amp; y");
  const msg = formatTasks([{ title: "<script>", priority: 0, dueDate: null, lateSince: null }]);
  assert.ok(msg.includes("&lt;script&gt;"));
  assert.ok(!msg.includes("<script>"));
});

test("formatDigest is empty when there is nothing, and caps long lists", () => {
  const empty = { name: "Ann", todayYmd: "2026-10-09", meetings: [], reminders: [], tasks: [] };
  assert.equal(formatDigest(empty), "");
  const tasks = Array.from({ length: 13 }, (_, i) => ({ title: `t${i}`, priority: 0, dueDate: null, lateSince: null }));
  const msg = formatDigest({ ...empty, tasks });
  assert.ok(msg.includes("t9"));
  assert.ok(!msg.includes("t10"));
  assert.ok(msg.includes("و 3 أخرى"));
});
