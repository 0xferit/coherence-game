import { describe, expect, it } from "vitest";
import { deepMerge, isPlainObject } from "../../src/merge";

describe("deepMerge", () => {
  it("merges nested objects and replaces arrays and scalars", () => {
    const base = { a: { b: 1, keep: true }, list: [1, 2], n: 1 };
    const out = deepMerge(base, { a: { c: 2 }, list: [3], n: 2 });
    expect(out).toEqual({ a: { b: 1, keep: true, c: 2 }, list: [3], n: 2 });
    expect(base).toEqual({ a: { b: 1, keep: true }, list: [1, 2], n: 1 });
  });

  it("replaces a scalar with an object and an object with a scalar", () => {
    expect(deepMerge({ a: 1 }, { a: { b: 2 } })).toEqual({ a: { b: 2 } });
    expect(deepMerge({ a: { b: 2 } }, { a: null })).toEqual({ a: null });
  });

  it("merges a JSON key named __proto__ as data without changing object ownership", () => {
    const patch = JSON.parse('{"__proto__":{"polluted":true}}') as Record<string, unknown>;
    const out = deepMerge({}, patch);
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(Object.hasOwn(out, "__proto__")).toBe(true);
    expect(Object.getOwnPropertyDescriptor(out, "__proto__")?.value).toEqual({ polluted: true });
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
  });
});

describe("isPlainObject", () => {
  it("accepts only objects without a custom prototype", () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject(JSON.parse('{"x":1}'))).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject(new Date())).toBe(false);
  });
});
