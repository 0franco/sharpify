import test from "node:test";
import assert from "node:assert/strict";
import { buildOutputPath, normalizeSuffix, resolveOutputFormat, toSavedPercent } from "./core.js";

test("resolveOutputFormat keeps explicit format", () => {
  assert.equal(resolveOutputFormat("/tmp/example.png", "webp"), "webp");
});

test("resolveOutputFormat infers extension", () => {
  assert.equal(resolveOutputFormat("/tmp/example.avif", "original"), "avif");
  assert.equal(resolveOutputFormat("/tmp/example.bmp", "original"), "jpeg");
});

test("normalizeSuffix falls back when blank", () => {
  assert.equal(normalizeSuffix(""), "-compressed");
  assert.equal(normalizeSuffix("  web  "), "web");
});

test("buildOutputPath increments duplicate names", () => {
  const existing = new Set<string>();
  const first = buildOutputPath("/tmp/photo.png", "/output", "-compressed", "png", existing);
  const second = buildOutputPath("/tmp/photo.png", "/output", "-compressed", "png", existing);

  assert.equal(first, "/output/photo-compressed.png");
  assert.equal(second, "/output/photo-compressed-2.png");
});

test("toSavedPercent returns reduction percentage", () => {
  assert.equal(toSavedPercent(1000, 750), 25);
  assert.equal(toSavedPercent(0, 300), 0);
});
