import assert from "node:assert/strict";
import React from "react";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import MarkdownPreview from "../src/components/MarkdownPreview.tsx";

test("renders headings, GFM tables, lists and fenced code", () => {
  const html = renderToStaticMarkup(<MarkdownPreview content={'## 标题\n\n- **重点**\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```js\nconst a = 1;\n```'} />);
  assert.match(html, /<h2 id="标题">标题<\/h2>/);
  assert.match(html, /<strong>重点<\/strong>/);
  assert.match(html, /<table>/);
  assert.match(html, /<pre><code class="language-js">/);
});

test("does not execute embedded HTML or dangerous link protocols", () => {
  const html = renderToStaticMarkup(<MarkdownPreview content={'<script>alert(1)</script>\n\n[危险](javascript:alert%281%29)'} />);
  assert.doesNotMatch(html, /<script|href="javascript:/);
});

test("resolves snapshot images against backend and keeps TOC anchors in place", () => {
  const html = renderToStaticMarkup(<MarkdownPreview content={'[目录](#标题)\n\n![截图](/api/snapshots/task/frame.jpg)'} assetBaseUrl="http://localhost:8000" />);
  assert.match(decodeURI(html), /href="#标题"/);
  assert.match(html, /src="http:\/\/localhost:8000\/api\/snapshots\/task\/frame.jpg"/);
});
