"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { motion } from "motion/react";

import { Icon } from "@/components/icons";
import { tap } from "@/lib/haptics";
import { cropToDataUrl, fileToDataUrl, PORTRAIT_RATIO } from "@/lib/image";

const MAX_ZOOM = 3;

// Выбор кадра перед загрузкой. Раньше фото уезжало в анкету как есть, а
// карточка каталога режет его под портрет 3:4 — люди теряли половину лица и
// перезаливали снимок по три раза. Здесь видно ровно то, что попадёт в каталог.
export function PhotoCropper({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (dataUrl: string) => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const dataUrl = await fileToDataUrl(file);
        const image = new Image();
        image.onload = () => { if (alive) { setSrc(dataUrl); setNatural({ w: image.width, h: image.height }); } };
        image.onerror = () => { if (alive) setFailed(true); };
        image.src = dataUrl;
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [file]);

  // Рамка вписывает картинку по принципу cover: при зуме 1 пустых полей нет,
  // дальше человек приближает и двигает кадр сам.
  const view = () => {
    const width = frame.current?.offsetWidth ?? 0;
    return { width, height: width / PORTRAIT_RATIO };
  };
  const scaleOf = () => {
    if (!natural) return 1;
    const { width, height } = view();
    return Math.max(width / natural.w, height / natural.h) * zoom;
  };
  const clamp = (next: { x: number; y: number }, k = scaleOf()) => {
    if (!natural) return { x: 0, y: 0 };
    const { width, height } = view();
    const limitX = Math.max(0, (natural.w * k - width) / 2);
    const limitY = Math.max(0, (natural.h * k - height) / 2);
    return {
      x: Math.min(limitX, Math.max(-limitX, next.x)),
      y: Math.min(limitY, Math.max(-limitY, next.y)),
    };
  };

  const onDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { px: event.clientX, py: event.clientY, ox: offset.x, oy: offset.y };
  };
  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    setOffset(clamp({ x: start.ox + (event.clientX - start.px), y: start.oy + (event.clientY - start.py) }));
  };
  const onUp = () => { drag.current = null; };

  const changeZoom = (next: number) => {
    const value = Math.min(MAX_ZOOM, Math.max(1, next));
    setZoom(value);
    if (!natural) return;
    const { width, height } = view();
    const k = Math.max(width / natural.w, height / natural.h) * value;
    setOffset((current) => clamp(current, k));
  };

  const save = async () => {
    if (!src || !natural) return;
    setBusy(true);
    try {
      const { width, height } = view();
      const k = scaleOf();
      const crop = {
        x: natural.w / 2 - (width / 2 + offset.x) / k,
        y: natural.h / 2 - (height / 2 + offset.y) / k,
        size: width / k,
      };
      onDone(await cropToDataUrl(src, crop));
      tap();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-3 @md:items-center" role="dialog" aria-label="Выбор кадра">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[380px] space-y-3 rounded-[var(--r-block)] bg-[var(--paper)] p-4 stroke"
      >
        <div className="flex items-center gap-2">
          <Icon name="image" width={16} weight="bold" color="var(--muted)" />
          <p className="t-head">Выберите кадр</p>
        </div>

        <div
          ref={frame}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="relative mx-auto w-full max-w-[280px] touch-none overflow-hidden rounded-[18px] bg-white stroke"
          style={{ aspectRatio: `${PORTRAIT_RATIO}`, cursor: drag.current ? "grabbing" : "grab" }}
        >
          {src && natural ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              draggable={false}
              className="absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                width: natural.w * scaleOf(),
                height: natural.h * scaleOf(),
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              }}
            />
          ) : (
            <div className="skeleton absolute inset-0" style={{ borderRadius: 18 }} />
          )}
          {/* Границы карточки каталога: третями видно, где окажется лицо. */}
          <span className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }).map((_, i) => <span key={i} style={{ boxShadow: "inset 0 0 0 0.5px rgba(255,255,255,.45)" }} />)}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <Icon name="zoom" width={13} weight="bold" color="var(--muted-2)" />
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.02}
            value={zoom}
            onChange={(event) => changeZoom(Number(event.target.value))}
            aria-label="Приближение"
            className="h-1.5 w-full appearance-none rounded-full"
            style={{ background: "var(--tiffany-soft)", accentColor: "var(--tiffany-edge)" }}
          />
        </div>
        <p className="t-cap text-center">Потяните фото, чтобы сдвинуть кадр</p>

        {failed && <p className="rounded-[12px] px-3 py-2 text-[11px] font-bold" style={{ background: "var(--salmon-soft)" }}>Не получилось обработать это фото — попробуйте другое.</p>}

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => { tap(); onCancel(); }} className="btn" style={{ background: "#fff" }}>Отмена</button>
          <button onClick={() => void save()} disabled={busy || !src} className="btn btn-accent disabled:opacity-60">
            {busy ? "Сохраняем…" : "Готово"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
