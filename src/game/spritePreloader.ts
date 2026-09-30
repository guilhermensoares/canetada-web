import { useEffect, useState } from "react";
import { BUILDING_SPRITES } from "@/assets/sprites";
import { ALL_VEHICLE_SRCS } from "@/assets/vehicles";

/**
 * Asset preloader — the standard technique games use to avoid
 * "broken image" icons flashing while browsers fetch dozens of files.
 *
 * We kick off downloads for every sprite src once (at module load) and
 * track per-src completion in a shared registry. Components can query
 * `isSpriteLoaded(src)` synchronously or subscribe via `useSpritesReady()`
 * to gate rendering until everything is decoded and ready to paint.
 */

type Status = "pending" | "loaded" | "error";

const status = new Map<string, Status>();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

const ALL_SRCS: string[] = Array.from(
  new Set([
    ...Object.values(BUILDING_SPRITES)
      .map((s) => s?.src)
      .filter((s): s is string => Boolean(s)),
    ...ALL_VEHICLE_SRCS,
  ]),
);

// Kick off preloads immediately (module init) — apenas no browser. Em SSR
// (workerd/node) `Image` não existe e o módulo era importado pela árvore do
// SpriteCityCanvas, quebrando renderToReadableStream com "Image is not defined".
if (typeof window !== "undefined" && typeof Image !== "undefined") {
  for (const src of ALL_SRCS) {
    status.set(src, "pending");
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      // decode() ensures the browser has fully parsed the bitmap before we
      // let the SVG <image> reference it — prevents the broken-icon flash.
      const done = () => {
        status.set(src, "loaded");
        notify();
      };
      if (typeof img.decode === "function") {
        img.decode().then(done).catch(done);
      } else {
        done();
      }
    };
    img.onerror = () => {
      status.set(src, "error");
      notify();
    };
    img.src = src;
  }
}

export function isSpriteLoaded(src: string | undefined): boolean {
  if (!src) return false;
  const s = status.get(src);
  return s === "loaded" || s === "error";
}

export function getSpriteProgress(): { loaded: number; total: number } {
  let loaded = 0;
  for (const s of status.values()) if (s === "loaded" || s === "error") loaded++;
  return { loaded, total: ALL_SRCS.length };
}

/**
 * Subscribe to sprite loading state. Returns { ready, loaded, total }.
 * `ready` flips to true once every sprite has resolved (loaded or failed).
 */
export function useSpritesReady(): {
  ready: boolean;
  loaded: number;
  total: number;
} {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const { loaded, total } = getSpriteProgress();
  return { ready: total === 0 || loaded >= total, loaded, total };
}
