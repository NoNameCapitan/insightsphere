"use client";

// Account sync for pet cards (v1.31).
//
// The account is the source of truth. Browser storage is a cache that keeps
// the existing screens instant and usable on a weak connection:
//   • every local change is recorded as "pending" and pushed to the account;
//   • a pull replaces the cache with the account's cards, keeping anything
//     that is still pending so an unsent change is never overwritten;
//   • files attached to records never leave the device.
import { readJSON, writeJSON } from "@/lib/storage";
import type { PetProfile } from "@/lib/types";
import { restoreFiles, stripFiles } from "./cloudModel";
import { setPetChangeListener } from "./store";

const KEY = "vetnear:pets";
const ACTIVE_KEY = "vetnear:active-pet";
const PENDING_KEY = "vetnear:pets:pending";
const GUEST_KEY = "vetnear:pets:guest";
const OWNER_KEY = "vetnear:pets:owner";
export const PETS_CHANGED_EVENT = "vetnear:pets-changed";

interface Pending { upsert: string[]; remove: string[] }
const emptyPending = (): Pending => ({ upsert: [], remove: [] });

export class PetSyncError extends Error {}

let ownerId: string | null = null;
let chain: Promise<void> = Promise.resolve();
let timer: number | undefined;
let lastError: string | null = null;
const statusListeners = new Set<(error: string | null) => void>();

function setError(message: string | null) {
  lastError = message;
  statusListeners.forEach((listener) => listener(message));
}
export function onPetSyncStatus(listener: (error: string | null) => void): () => void {
  statusListeners.add(listener);
  listener(lastError);
  return () => statusListeners.delete(listener);
}

const cache = () => readJSON<PetProfile[]>(KEY, []);
const pending = () => readJSON<Pending>(PENDING_KEY, emptyPending());
const announce = () => window.dispatchEvent(new Event(PETS_CHANGED_EVENT));

function errorFor(status: number): string {
  if (status === 401) return "Сесія завершилась. Увійдіть ще раз, щоб зберегти зміни.";
  if (status === 409) return "В акаунті вже максимальна кількість карток.";
  if (status === 413) return "Картка завелика. Спробуйте менше фото.";
  if (status === 429) return "Забагато змін за короткий час. Спробуйте за кілька хвилин.";
  return "Не вдалося зберегти в акаунті. Перевірте зʼєднання і спробуйте ще раз.";
}

function onLocalChange(kind: "upsert" | "remove", id: string) {
  if (!ownerId) return;
  const queue = pending();
  queue.upsert = queue.upsert.filter((item) => item !== id);
  queue.remove = queue.remove.filter((item) => item !== id);
  queue[kind].push(id);
  writeJSON(PENDING_KEY, queue);
  if (kind === "upsert") {
    // Cards created while signed in belong to this account.
    const pets = cache();
    const pet = pets.find((item) => item.id === id);
    if (pet && pet.ownerId !== ownerId) {
      pet.ownerId = ownerId;
      writeJSON(KEY, pets);
    }
  }
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void flushPetSync().catch(() => {}), 600);
}

async function push(): Promise<void> {
  const queue = pending();
  if (!ownerId || (!queue.upsert.length && !queue.remove.length)) return;
  const headers = { "content-type": "application/json" };
  const done = (kind: keyof Pending, id: string) => {
    const latest = pending();
    latest[kind] = latest[kind].filter((item) => item !== id);
    writeJSON(PENDING_KEY, latest);
  };
  for (const id of queue.remove) {
    const res = await fetch(`/api/pets/${encodeURIComponent(id)}`, { method: "DELETE", headers });
    if (!res.ok && res.status !== 422) throw new PetSyncError(errorFor(res.status));
    done("remove", id);
  }
  for (const id of queue.upsert) {
    const pet = cache().find((item) => item.id === id);
    if (!pet) { done("upsert", id); continue; }
    const res = await fetch(`/api/pets/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ pet: stripFiles(pet) }),
    });
    if (!res.ok) throw new PetSyncError(errorFor(res.status));
    done("upsert", id);
  }
}

/** Sends pending changes now. Rejects with a user-readable PetSyncError. */
export function flushPetSync(): Promise<void> {
  window.clearTimeout(timer);
  const run = chain.then(async () => {
    try {
      await push();
      setError(null);
    } catch (cause) {
      const message = cause instanceof PetSyncError ? cause.message : errorFor(0);
      setError(message);
      throw new PetSyncError(message);
    }
  });
  chain = run.catch(() => {});
  return run;
}

/** In account mode: saves the latest change and returns an error text, or null. */
export async function commitPetChanges(): Promise<string | null> {
  if (!ownerId) return null;
  try {
    await flushPetSync();
    return null;
  } catch (cause) {
    return cause instanceof Error ? cause.message : errorFor(0);
  }
}

/** Downloads the account's cards into the cache (after sending pending changes). */
export async function pullPets(): Promise<void> {
  if (!ownerId) return;
  await flushPetSync().catch(() => {});
  const res = await fetch("/api/pets", { cache: "no-store", credentials: "same-origin" }).catch(() => null);
  if (!res?.ok) {
    setError(res?.status === 401 ? errorFor(401) : "Не вдалося завантажити картки з акаунта. Показуємо збережені на пристрої.");
    return;
  }
  const { pets: remote } = (await res.json()) as { pets: PetProfile[] };
  const local = new Map(cache().map((pet) => [pet.id, pet]));
  const queue = pending();
  const merged = remote
    .filter((pet) => !queue.remove.includes(pet.id))
    .map((pet) => (queue.upsert.includes(pet.id) && local.has(pet.id) ? local.get(pet.id)! : restoreFiles(pet, local.get(pet.id))));
  const remoteIds = new Set(remote.map((pet) => pet.id));
  for (const id of queue.upsert) {
    if (!remoteIds.has(id) && local.has(id)) merged.unshift(local.get(id)!);
  }
  writeJSON(KEY, merged);
  const active = readJSON<string | null>(ACTIVE_KEY, null);
  if (!merged.some((pet) => pet.id === active)) {
    if (merged[0]) writeJSON(ACTIVE_KEY, merged[0].id);
    else localStorage.removeItem(ACTIVE_KEY);
  }
  if (!queue.upsert.length && !queue.remove.length) setError(null);
  announce();
}

/**
 * Switches this browser to account mode for `userId`. Cards that were created
 * here without an account are set aside (never uploaded silently) so the
 * owner can choose to move them in.
 */
export async function startPetSync(userId: string): Promise<void> {
  if (ownerId === userId) return;
  ownerId = userId;
  setPetChangeListener(onLocalChange);
  if (readJSON<string | null>(OWNER_KEY, null) !== userId) {
    const guest = cache().filter((pet) => !pet.ownerId);
    if (guest.length) {
      const stash = readJSON<PetProfile[]>(GUEST_KEY, []);
      const known = new Set(stash.map((pet) => pet.id));
      writeJSON(GUEST_KEY, [...stash, ...guest.filter((pet) => !known.has(pet.id))]);
    }
    writeJSON(KEY, []);
    writeJSON(PENDING_KEY, emptyPending());
    localStorage.removeItem(ACTIVE_KEY);
    writeJSON(OWNER_KEY, userId);
  }
  await pullPets();
}

/** Leaves account mode; on sign-out the cached cards are removed from this device. */
export function stopPetSync(clearCache: boolean): void {
  window.clearTimeout(timer);
  setPetChangeListener(null);
  ownerId = null;
  setError(null);
  if (clearCache) {
    for (const key of [KEY, ACTIVE_KEY, PENDING_KEY, OWNER_KEY]) localStorage.removeItem(key);
    announce();
  }
}

export function getGuestPets(): PetProfile[] {
  return readJSON<PetProfile[]>(GUEST_KEY, []);
}

/** Cards saved on this device before an account existed (signed-out view). */
export function countLocalGuestPets(): number {
  return getGuestPets().length + cache().filter((pet) => !pet.ownerId).length;
}

export function discardGuestPets(): void {
  localStorage.removeItem(GUEST_KEY);
}

/** One-time import of device-only cards into the signed-in account. */
export async function importGuestPets(): Promise<string | null> {
  if (!ownerId) return "Спершу увійдіть в акаунт.";
  const guest = getGuestPets();
  if (!guest.length) return null;
  const pets = cache();
  const taken = new Set(pets.map((pet) => pet.id));
  const queue = pending();
  for (const pet of guest) {
    const id = taken.has(pet.id) ? `${pet.id}-${Math.random().toString(36).slice(2, 6)}` : pet.id;
    pets.unshift({ ...pet, id, ownerId });
    queue.upsert.push(id);
  }
  writeJSON(KEY, pets);
  writeJSON(PENDING_KEY, queue);
  // The cards now live in the cache as pending changes, so the stash is done
  // either way; a failed upload is retried by the normal sync.
  discardGuestPets();
  const error = await commitPetChanges();
  announce();
  return error;
}
