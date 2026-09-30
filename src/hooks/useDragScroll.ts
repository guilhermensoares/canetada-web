import { useEffect, useRef } from "react";

/**
 * useDragScroll — permite arrastar (mouse OU dedo/touch) para rolar horizontal
 * e verticalmente qualquer container com overflow:auto. No desktop dá a sensação
 * de "grab" tipo mapa; no mobile funciona como "swipe" nativo estendido.
 *
 * Uso: const ref = useDragScroll<HTMLDivElement>(); <div ref={ref} className="overflow-auto ..." />
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let isDown = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;
    // Só ativa o "grab" do mouse quando o clique NÃO cair em um controle
    // interativo (botão, link, input) — assim não roubamos cliques.
    const shouldIgnore = (target: EventTarget | null): boolean => {
      const node = target as HTMLElement | null;
      if (!node) return false;
      return !!node.closest(
        'button, a, input, textarea, select, [role="button"], [role="slider"], [role="tab"], [contenteditable="true"]',
      );
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (shouldIgnore(e.target)) return;
      isDown = true;
      startX = e.pageX;
      startY = e.pageY;
      scrollLeft = el.scrollLeft;
      scrollTop = el.scrollTop;
      el.classList.add("is-dragging");
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      el.scrollLeft = scrollLeft - (e.pageX - startX);
      el.scrollTop = scrollTop - (e.pageY - startY);
    };
    const stop = () => {
      if (!isDown) return;
      isDown = false;
      el.classList.remove("is-dragging");
    };

    // Touch: só interceptamos quando o usuário arrasta HORIZONTAL —
    // o scroll vertical fica com o navegador (rolagem natural do dedo).
    let touchStartX = 0;
    let touchStartY = 0;
    let touchScrollLeft = 0;
    let touchDragging = false;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (shouldIgnore(e.target)) return;
      touchStartX = e.touches[0].pageX;
      touchStartY = e.touches[0].pageY;
      touchScrollLeft = el.scrollLeft;
      touchDragging = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const dx = e.touches[0].pageX - touchStartX;
      const dy = e.touches[0].pageY - touchStartY;
      if (!touchDragging) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
          touchDragging = true;
        } else {
          return;
        }
      }
      el.scrollLeft = touchScrollLeft - dx;
      e.preventDefault();
    };

    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stop);
    window.addEventListener("mouseleave", stop);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", () => { touchDragging = false; });

    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("mouseleave", stop);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return ref;
}
