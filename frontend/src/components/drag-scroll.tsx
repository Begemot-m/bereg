"use client";

import { useEffect } from "react";

/**
 * Горизонтальные ленты на компьютере. Пальцем они листаются сами, мышью —
 * никак: полосы прокрутки в них скрыты (`.no-scrollbar`). Вешаем на все такие
 * ленты перетаскивание мышью и колесо, а те, что реально не влезают, помечаем
 * `data-scrollable` — по метке CSS даёт курсор-руку и подтаивающий правый край.
 * Стрелок не рисуем: они съедают место и спорят с общей стрелкой проекта.
 */
export function DragScroll() {
  useEffect(() => {
    const DRAG_START = 5; // px — раньше этого считаем, что это клик, а не тяга

    const mark = (el: HTMLElement) => {
      const scrollable = el.scrollWidth - el.clientWidth > 4;
      if (scrollable) el.dataset.scrollable = "true";
      else delete el.dataset.scrollable;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      const el = (e.target as HTMLElement).closest<HTMLElement>(".no-scrollbar");
      if (!el || el.scrollWidth - el.clientWidth <= 4) return;

      const startX = e.clientX;
      const startLeft = el.scrollLeft;
      let dragging = false;

      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        if (!dragging && Math.abs(dx) < DRAG_START) return;
        if (!dragging) { dragging = true; el.dataset.dragging = "true"; }
        el.scrollLeft = startLeft - dx;
        ev.preventDefault();
      };
      const up = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up, true);
        delete el.dataset.dragging;
        // Тянули — гасим клик, чтобы лента не открыла карточку под курсором.
        if (dragging) { ev.preventDefault(); ev.stopPropagation(); }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up, true);
    };

    // Обычная мышь крутит только по вертикали — переводим её в горизонталь.
    const onWheel = (e: WheelEvent) => {
      if (e.deltaX !== 0 || e.shiftKey) return;
      const el = (e.target as HTMLElement).closest<HTMLElement>(".no-scrollbar");
      if (!el || el.scrollWidth - el.clientWidth <= 4) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };

    const markAll = () => document.querySelectorAll<HTMLElement>(".no-scrollbar").forEach(mark);

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", markAll);
    markAll();
    // Ленты появляются вместе с данными — пересчитываем при изменениях DOM.
    const observer = new MutationObserver(markAll);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", markAll);
      observer.disconnect();
    };
  }, []);

  return null;
}
