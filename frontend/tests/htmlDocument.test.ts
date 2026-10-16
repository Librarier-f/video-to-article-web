import assert from "node:assert/strict";
import test from "node:test";
import { resolveSnapshotUrls } from "../src/utils/htmlDocument.ts";

test("HTML preview resolves snapshot sources without altering scripts or external images", () => {
  const html = '<img src="/api/snapshots/t/1.jpg"><img src="https://example.com/cover.jpg"><script>const text="/api/snapshots/keep";</script>';
  const output = resolveSnapshotUrls(html, "http://localhost:8000");
  assert.match(output, /src="http:\/\/localhost:8000\/api\/snapshots\/t\/1.jpg"/);
  assert.match(output, /src="https:\/\/example.com\/cover.jpg"/);
  assert.match(output, /const text="\/api\/snapshots\/keep"/);
});
