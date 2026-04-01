/**
 * Recursively convert BigInt values to strings so the result is JSON-safe.
 * Returns a new object — original is never mutated.
 */
export type Serializable =
  | string
  | number
  | boolean
  | null
  | undefined
  | Serializable[]
  | { [key: string]: Serializable };

export function serializeBigInt<T>(value: T): Serializable {
  if (value === null || value === undefined) {
    return value as null | undefined;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeBigInt);
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        serializeBigInt(v),
      ]),
    ) as { [key: string]: Serializable };
  }
  return value as Serializable;
}
