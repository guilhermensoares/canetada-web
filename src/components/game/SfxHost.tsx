import { useEffect } from "react";
import { playSfx, unlockSfx, type SfxName } from "@/game/sfx";

/**
 * Instala os efeitos sonoros da UI de forma global, sem precisar tocar em
 * cada botão: delega cliques, observa modais e toasts.
 *
 * Para forçar um som específico num elemento, basta `data-sfx="stamp"`
 * (ou `data-sfx="none"` para silenciar).
 */
export function SfxHost() {
  useEffect(() => {
    const unlock = () => unlockSfx();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    // ── cliques em controles ──────────────────────────────────────────
    const onPointerDown = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(
        "button, [role='button'], a[href], [role='tab'], [role='menuitem'], [role='option'], [data-sfx]",
      );
      if (!el || el.getAttribute("aria-disabled") === "true" || (el as HTMLButtonElement).disabled) return;

      const explicit = el.dataset.sfx as SfxName | "none" | undefined;
      if (explicit === "none") return;
      if (explicit) return playSfx(explicit);

      const role = el.getAttribute("role");
      if (role === "tab" || role === "option" || el.getAttribute("role") === "switch") return playSfx("tap");
      if (el.dataset.variant === "destructive" || el.className.includes("destructive")) return playSfx("spend");
      playSfx("click");
    };
    window.addEventListener("pointerdown", onPointerDown, true);

    // ── modais, drawers e toasts ──────────────────────────────────────
    const isOverlay = (n: Node): n is HTMLElement =>
      n instanceof HTMLElement &&
      (n.getAttribute("role") === "dialog" || n.getAttribute("role") === "alertdialog" || !!n.querySelector?.("[role='dialog'],[role='alertdialog']"));

    const toastSound = (n: HTMLElement): SfxName => {
      const type = n.getAttribute("data-type") ?? "";
      if (type === "error") return "error";
      if (type === "success") return "success";
      if (type === "warning") return "alert";
      return "message";
    };

    const observer = new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((n) => {
          if (!(n instanceof HTMLElement)) return;
          if (n.matches?.("[data-sonner-toast]")) return playSfx(toastSound(n));
          if (isOverlay(n)) playSfx("open");
        });
        r.removedNodes.forEach((n) => {
          if (n instanceof HTMLElement && isOverlay(n)) playSfx("close");
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("pointerdown", onPointerDown, true);
      observer.disconnect();
    };
  }, []);

  return null;
}
