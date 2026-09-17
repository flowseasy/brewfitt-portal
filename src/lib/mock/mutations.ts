import type { MockDb } from "./db";

/** Collections that hold records (everything except scalars and the rules document). */
export type Collection = {
  [K in keyof MockDb]: MockDb[K] extends unknown[] ? K : never;
}[keyof MockDb];

type Match = { field: string; value: string };

export type Change =
  | { type: "insert"; collection: Collection; record: object }
  | { type: "patch"; collection: Collection; match: Match; set: object }
  | { type: "remove"; collection: Collection; match: Match };

/**
 * One user action as stored in the demo log: a label (e.g. "quotes.accept")
 * and the fully computed record changes, including generated ids and
 * timestamps, so replaying it gives exactly the same result.
 */
export type MutationEntry = { op: string; asOf: string; changes: Change[] };

function list(db: MockDb, collection: Collection): Record<string, unknown>[] {
  return db[collection] as unknown as Record<string, unknown>[];
}

export function applyMutation(db: MockDb, entry: MutationEntry): void {
  // Check every target exists first so a change that no longer applies leaves the data untouched.
  const pending = new Map<string, Set<unknown>>();
  for (const change of entry.changes) {
    if (change.type === "insert") continue;
    const key = `${change.collection}|${change.match.field}`;
    if (!pending.has(key))
      pending.set(
        key,
        new Set(list(db, change.collection).map((item) => item[change.match.field])),
      );
  }
  for (const change of entry.changes) {
    if (change.type === "insert") {
      for (const [key, values] of pending) {
        const [collection, field] = key.split("|");
        if (collection === change.collection)
          values.add((change.record as Record<string, unknown>)[field!]);
      }
      continue;
    }
    if (!pending.get(`${change.collection}|${change.match.field}`)!.has(change.match.value)) {
      throw new Error(
        `${entry.op}: no ${change.collection} with ${change.match.field} ${change.match.value}`,
      );
    }
  }

  for (const change of entry.changes) {
    const items = list(db, change.collection);
    if (change.type === "insert") {
      items.push(structuredClone(change.record) as Record<string, unknown>);
      continue;
    }
    const index = items.findIndex((item) => item[change.match.field] === change.match.value);
    if (index < 0)
      throw new Error(
        `${entry.op}: no ${change.collection} with ${change.match.field} ${change.match.value}`,
      );
    if (change.type === "patch") items[index] = { ...items[index], ...structuredClone(change.set) };
    else items.splice(index, 1);
  }
}

// Small helpers so handlers read clearly.
export const insert = (collection: Collection, record: object): Change => ({
  type: "insert",
  collection,
  record,
});
export const patch = (collection: Collection, id: string, set: object, field = "id"): Change => ({
  type: "patch",
  collection,
  match: { field, value: id },
  set,
});
export const remove = (collection: Collection, id: string, field = "id"): Change => ({
  type: "remove",
  collection,
  match: { field, value: id },
});
