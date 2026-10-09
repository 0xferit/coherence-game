/** Identifies records with the ordinary object prototype, excluding arrays and class instances. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype
  );
}

/** Merges nested records; arrays and scalars replace their fields. Neither input is mutated. */
export function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const current = merged[key];
    Object.defineProperty(merged, key, {
      value: isPlainObject(value) && isPlainObject(current) ? deepMerge(current, value) : value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return merged;
}
