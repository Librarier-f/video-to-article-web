import assert from "node:assert/strict";
import test from "node:test";
import { mergePolledTasks } from "../src/utils/taskPolling.ts";

test("polling preserves tasks created while a previous poll was in flight", () => {
  const old = { id: "a", status: "writing" };
  const added = { id: "b", status: "pending" };
  assert.deepEqual(mergePolledTasks([old, added], new Set(["a"]), [{ ...old, status: "enriching" }]),
    [{ id: "a", status: "enriching" }, added]);
});

test("completed tasks are removed while newly submitted tasks remain", () => {
  assert.deepEqual(mergePolledTasks([{ id: "a" }, { id: "b" }], new Set(["a"]), []), [{ id: "b" }]);
});
