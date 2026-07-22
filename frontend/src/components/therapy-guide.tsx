"use client";

import { HelpDeck, type HelpPage } from "@/components/help-deck";
import { MoodBlob } from "@/components/mood-egg";

const GUIDE_KEY = "bereg_therapy_guide_seen_v1";

export function therapyGuideSeen(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(GUIDE_KEY) === "1";
}
export function markTherapyGuideSeen() {
  try { localStorage.setItem(GUIDE_KEY, "1"); } catch { /* ignore */ }
}

const Screen = ({ children, tone = "var(--page)" }: { children: React.ReactNode; tone?: string }) => (
  <div className="mx-auto w-[186px] overflow-hidden rounded-[22px] bg-white p-1.5 stroke-lg" style={{ boxShadow: "0 18px 34px -22px rgba(32,28,24,.5)" }}>
    <div className="overflow-hidden rounded-[16px]" style={{ background: tone }}>
      <div className="flex items-center gap-1 px-2.5 pb-1 pt-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[var(--ink)] opacity-40" /><span className="h-1 w-7 rounded-full bg-[var(--ink)] opacity-20" /></div>
      <div className="min-h-[150px] rounded-t-[13px] bg-[#fffdf7] p-2.5" style={{ borderTop: "1.5px solid rgba(32,28,24,.14)" }}>{children}</div>
    </div>
  </div>
);
const Bar = ({ w = "100%", h = 6, tone = "rgba(32,28,24,.14)" }: { w?: string; h?: number; tone?: string }) => (
  <span className="block rounded-full" style={{ width: w, height: h, background: tone }} />
);

export const THERAPY_HELP: HelpPage[] = [
  {
    title: "Отмечайте настроение каждый день",
    text: "Полминуты в день: покрутите диск и выберите эмоции. Так виден настоящий фон недели, а не только «хорошо / плохо».",
    illo: (
      <Screen tone="var(--amber-soft)">
        <div className="flex items-center gap-2">
          <MoodBlob value={4.4} size={38} still />
          <div className="flex-1 space-y-1"><Bar w="88%" h={6} tone="rgba(32,28,24,.3)" /><Bar w="60%" h={5} /></div>
        </div>
        <div className="mt-2 flex items-end justify-center gap-[3px]">{[10, 15, 12, 20, 24, 20, 28].map((height, index) => <span key={index} className="w-[6px] rounded-full" style={{ height, background: index > 3 ? "var(--green)" : "var(--amber)", border: "1px solid rgba(32,28,24,.18)" }} />)}</div>
      </Screen>
    ),
  },
  {
    title: "Соберите колесо баланса",
    text: "30 коротких вопросов по 10 сферам жизни — и вы видите, где ресурс, а где нехватка. Результат сохраняется и виден вашему терапевту.",
    illo: (
      <Screen tone="var(--purple-soft)">
        <svg viewBox="0 0 100 100" className="mx-auto" style={{ height: 108 }}>
          {[3, 5, 7].map((r) => <circle key={r} cx="50" cy="50" r={r * 5} fill="none" stroke="rgba(32,28,24,.16)" strokeWidth="1" />)}
          <polygon points="50,18 74,34 70,66 40,74 26,44" fill="var(--purple)" fillOpacity="0.4" stroke="var(--purple-edge)" strokeWidth="2" />
        </svg>
      </Screen>
    ),
  },
  {
    title: "Найдите терапевта и записывайтесь",
    text: "В каталоге добавьте специалиста в свою терапию и выберите свободное окно. Записи, переносы и отмены — в разделе «С терапевтом».",
    illo: (
      <Screen tone="var(--olive-soft)">
        <div className="rounded-[10px] bg-white p-2" style={{ border: "1.5px solid var(--olive-edge)" }}>
          <div className="flex items-center gap-1.5"><span className="h-6 w-6 rounded-[7px]" style={{ background: "var(--olive-soft)", border: "1.5px solid var(--olive-edge)" }} /><div className="flex-1 space-y-1"><Bar w="70%" h={5} tone="rgba(32,28,24,.3)" /><Bar w="45%" h={4} /></div></div>
        </div>
        <div className="mt-2 rounded-full py-1 text-center text-[8px] font-black text-white" style={{ background: "var(--ink)" }}>Добавить в терапию</div>
      </Screen>
    ),
  },
  {
    title: "Задания и динамика",
    text: "Задания от терапевта отмечайте сами по мере выполнения. График настроения, календарь и прогресс копятся автоматически — прогресс всегда под рукой.",
    illo: (
      <Screen tone="var(--green-soft)">
        {[0, 1, 2].map((row) => <div key={row} className="mt-1 flex items-center gap-1.5 rounded-[8px] bg-white p-1.5" style={{ border: "1.5px solid rgba(32,28,24,.16)" }}><span className="h-3 w-3 rounded-[4px]" style={{ background: row < 2 ? "var(--green)" : "#fff", border: "1.5px solid rgba(32,28,24,.2)" }} /><Bar w="72%" h={4} /></div>)}
      </Screen>
    ),
  },
];

// Пошаговый гайд при первом заходе в раздел «Терапия».
export function TherapyGuide({ onClose }: { onClose: () => void }) {
  const done = () => { markTherapyGuideSeen(); onClose(); };
  return <HelpDeck title="Как устроена терапия" pages={THERAPY_HELP} onClose={done} onDone={done} doneLabel="Начать" />;
}
