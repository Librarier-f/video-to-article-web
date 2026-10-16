import assert from "node:assert/strict";
import test from "node:test";
import { loadCustomApiConfig, saveCustomApiConfig, validateCustomApiConfig } from "../src/utils/customApiConfig.ts";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test("custom API settings round trip with trimmed inputs and can be cleared", () => {
  const local = storage();
  saveCustomApiConfig({ baseUrl: " https://proxy.example/v1/ ", apiKey: " test-key ", model: " custom-model " }, local);
  assert.deepEqual(loadCustomApiConfig(local), {
    baseUrl: "https://proxy.example/v1", apiKey: "test-key", model: "custom-model",
  });
  saveCustomApiConfig({ baseUrl: "", apiKey: "", model: "" }, local);
  assert.deepEqual(loadCustomApiConfig(local), { baseUrl: "", apiKey: "", model: "" });
});

test("custom configuration requires HTTP URL, key, and model", () => {
  const config = { baseUrl: "https://proxy.example/v1", apiKey: "key", model: "model" };
  assert.equal(validateCustomApiConfig(config), "");
  assert.match(validateCustomApiConfig({ ...config, baseUrl: "ftp://proxy.example/v1" }), /Base URL/);
  assert.match(validateCustomApiConfig({ ...config, apiKey: " " }), /API Key/);
  assert.match(validateCustomApiConfig({ ...config, model: " " }), /模型/);
});
