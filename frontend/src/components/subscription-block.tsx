"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowGlyph } from "@/components/blocks";
import { motion } from "motion/react";
import { useState, type ReactNode } from "react";

import { HelpDeck, type HelpPage } from "@/components/help-deck";
import { Icon, type IconName } from "@/components/icons";
import { ProCta } from "@/components/pro-sell";
import { Disclosure } from "@/components/ui";
import { CATALOG_FREE_DAYS, catalogDaysLeft, crossedPrice, FREE_CLIENT_LIMIT, getSubscription, monthlyPrice, paidDaysLeft, PLAN_PRICE, rub, startSubscription, TRIAL_DAYS, trialDaysLeft, type PlanId, type Subscription } from "@/lib/subscription";
import { tap } from "@/lib/haptics";

import { zoneFormat } from "@/lib/zone";

const dF = zoneFormat({ day: "numeric", month: "long" });

type Plan = { id: PlanId; name: string; tag: string; perks: string[]; best?: boolean };
const PSY_PLANS: Plan[] = [
  {
    id: "pro",
    name: "РҐСЂРѕРЅРёРєР° PRO",
    tag: "Р±РµР·Р»РёРјРёС‚ + СЂР°Р·РјРµС‰РµРЅРёРµ",
    best: true,
    perks: [
      `РљР»РёРµРЅС‚С‹ Р±РµР· Р»РёРјРёС‚Р° (Р±РµСЃРїР»Р°С‚РЅРѕ вЂ” ${FREE_CLIENT_LIMIT}, СЃРѕ РІСЃРµРј С„СѓРЅРєС†РёРѕРЅР°Р»РѕРј)`,
      `РљР°С‚Р°Р»РѕРі СЃРїРµС†РёР°Р»РёСЃС‚РѕРІ РґР°Р»СЊС€Рµ РїРµСЂРІС‹С… ${CATALOG_FREE_DAYS} РґРЅРµР№ вЂ” С‡РµСЃС‚РЅР°СЏ РІС‹РґР°С‡Р°`,
      "РљРѕРјРёСЃСЃРёРё Р·Р° Р·Р°РїРёСЃСЊ РЅРµС‚",
      "Р’РµСЃСЊ С„СѓРЅРєС†РёРѕРЅР°Р» РїРѕ РєР»РёРµРЅС‚Сѓ РґРѕСЃС‚СѓРїРµРЅ Рё Р±РµСЃРїР»Р°С‚РЅРѕ",
    ],
  },
];

const BFrame = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-[136px] flex-col justify-center gap-2 rounded-[14px] p-3" style={{ background: "var(--purple-soft)", border: "var(--bw) solid var(--purple-edge)" }}>{children}</div>
);
const NewTag = () => <span className="rounded-full bg-[var(--coral)] px-1.5 py-0.5 text-[8px] font-black uppercase" style={{ border: "1px solid var(--coral-edge)" }}>РЅРѕРІРѕ</span>;

// Р§С‚Рѕ РІС…РѕРґРёС‚ РІ Р±РµСЃРїР»Р°С‚РЅСѓСЋ РІРµСЂСЃРёСЋ, Р° С‡С‚Рѕ вЂ” РІ PRO.
const COMPARE: { label: string; free: boolean | string; pro: boolean | string }[] = [
  { label: "РљР»РёРµРЅС‚С‹", free: `РґРѕ ${FREE_CLIENT_LIMIT}`, pro: "Р±РµР· Р»РёРјРёС‚Р°" },
  { label: "Р—Р°РїРёСЃРё, РіСЂР°С„РёРє, РєР°СЂС‚РѕС‡РєРё", free: true, pro: true },
  { label: "РќР°СЃС‚СЂРѕРµРЅРёРµ, РґРѕРјР°С€РєРё, С€Р°Р±Р»РѕРЅС‹", free: true, pro: true },
  { label: "РђРЅР°Р»РёС‚РёРєР° Рё СЃРІРѕРґРєР° РЅРµРґРµР»Рё", free: true, pro: true },
  { label: "Р Р°Р·РјРµС‰РµРЅРёРµ РІ РєР°С‚Р°Р»РѕРіРµ СЃРїРµС†РёР°Р»РёСЃС‚РѕРІ", free: `${CATALOG_FREE_DAYS} РґРЅРµР№`, pro: "РїРѕСЃС‚РѕСЏРЅРЅРѕ" },
  { label: "РљРѕРјРёСЃСЃРёСЏ Р·Р° Р·Р°РїРёСЃСЊ", free: "РЅРµС‚", pro: "РЅРµС‚" },
];

function CompareCell({ value }: { value: boolean | string }) {
  if (value === true) return <Icon name="check" width={14} weight="bold" color="var(--green-edge)" />;
  if (value === false) return <span className="text-[13px] font-black text-[var(--muted-2)]">вЂ”</span>;
  return <span className="text-[10px] font-black leading-none">{value}</span>;
}

// РљРѕРјРїР°РєС‚РЅР°СЏ С‚Р°Р±Р»РёС†Р° СЃСЂР°РІРЅРµРЅРёСЏ В«Р‘РµСЃРїР»Р°С‚РЅРѕ / PROВ».
function FreeVsPro({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-[14px] bg-white ${compact ? "" : "stroke-lg"}`} style={compact ? { border: "var(--bw) solid var(--purple-edge)" } : undefined}>
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-3 py-2" style={{ background: "var(--surface-2)", borderBottom: "var(--bw) solid var(--edge-neutral)" }}>
        <span className="text-[10px] font-black uppercase tracking-[.06em] text-[var(--muted)]">Р’РѕР·РјРѕР¶РЅРѕСЃС‚СЊ</span>
        <span className="w-14 text-center text-[10px] font-black uppercase text-[var(--muted)]">Free</span>
        <span className="flex w-14 items-center justify-center gap-0.5 text-center text-[10px] font-black uppercase text-[var(--ink)]"><Icon name="spark" width={10} weight="fill" />PRO</span>
      </div>
      {COMPARE.map((row, i) => (
        <div key={row.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-3 py-2" style={i > 0 ? { borderTop: "1.5px solid var(--edge-neutral)" } : undefined}>
          <span className="text-[11.5px] font-bold leading-tight">{row.label}</span>
          <span className="flex w-14 justify-center"><CompareCell value={row.free} /></span>
          <span className="flex w-14 justify-center rounded-[8px] py-1" style={{ background: "var(--purple-soft)" }}><CompareCell value={row.pro} /></span>
        </div>
      ))}
    </div>
  );
}

export const PRO_BENEFITS: HelpPage[] = [
  { title: "Р§С‚Рѕ Р±РµСЃРїР»Р°С‚РЅРѕ, Р° С‡С‚Рѕ РІ PRO", text: "Р—Р°РїРёСЃСЊ, РіСЂР°С„РёРє Рё РїРµСЂРІС‹Рµ РєР°СЂС‚РѕС‡РєРё РєР»РёРµРЅС‚РѕРІ вЂ” Р±РµСЃРїР»Р°С‚РЅРѕ РЅР°РІСЃРµРіРґР°. PRO РґРѕР±Р°РІР»СЏРµС‚ С‚Рѕ, С‡С‚Рѕ СЌРєРѕРЅРѕРјРёС‚ РІСЂРµРјСЏ РЅР° РєР°Р¶РґРѕР№ СЃРµСЃСЃРёРё: СЃС‚Р°С‚РёСЃС‚РёРєСѓ, СЃРІРѕРґРєСѓ РЅРµРґРµР»Рё Рё С€Р°Р±Р»РѕРЅС‹.", illo: (
    <div className="rounded-[14px] p-1" style={{ background: "var(--purple-soft)", border: "var(--bw) solid var(--purple-edge)" }}><FreeVsPro compact /></div>
  ) },
  { title: "Р’СЃСЏ РїСЂР°РєС‚РёРєР° РІ РѕРґРЅРѕРј РјРµСЃС‚Рµ", text: "Р Р°СЃРїРёСЃР°РЅРёРµ, РєР»РёРµРЅС‚С‹, Р·Р°РїРёСЃРё Рё РґРѕРјР°С€РЅРёРµ Р·Р°РґР°РЅРёСЏ СЂСЏРґРѕРј. РњРµРЅСЊС€Рµ СЂСѓС‚РёРЅС‹ вЂ” Р±РѕР»СЊС€Рµ РІСЂРµРјРµРЅРё РЅР° СЂР°Р±РѕС‚Сѓ СЃ Р»СЋРґСЊРјРё.", illo: (
    <BFrame>{["10:00 В· РњР°СЂРёРЅР° В· РѕРЅР»Р°Р№РЅ", "15:00 В· СЃРІРѕР±РѕРґРЅРѕРµ РѕРєРЅРѕ", "19:00 В· РђР»С‘РЅР° В· РѕС‡РЅРѕ"].map((t, i) => (
      <div key={t} className="flex items-center gap-2 rounded-[9px] bg-white px-2.5 py-1.5 text-[10px] font-bold" style={{ border: `var(--bw) solid ${["var(--purple-edge)", "var(--edge-neutral)", "var(--green-edge)"][i]}` }}>{t}</div>
    ))}</BFrame>
  ) },
  { title: "РќРѕРІС‹Рµ РёРЅСЃС‚СЂСѓРјРµРЅС‚С‹ РєР°Р¶РґС‹Р№ РјРµСЃСЏС†", text: "РњС‹ РґРѕР±Р°РІР»СЏРµРј РјРµС‚РѕРґРёРєРё РїРѕ РЅР°СѓС‡РЅС‹Рј РїРѕРґС…РѕРґР°Рј вЂ” РєРѕР»РµСЃРѕ Р±Р°Р»Р°РЅСЃР°, WHO-5, РґРЅРµРІРЅРёРєРё РјС‹СЃР»РµР№. Р’СЃС‘ СѓР¶Рµ РІРєР»СЋС‡РµРЅРѕ РІ РїРѕРґРїРёСЃРєСѓ.", illo: (
    <BFrame>{[["РљРѕР»РµСЃРѕ Р±Р°Р»Р°РЅСЃР°", true], ["Р”РЅРµРІРЅРёРє РјС‹СЃР»РµР№ РљРџРў", true], ["РЁРєР°Р»Р° С‚СЂРµРІРѕРіРё GAD-7", false]].map(([t, isNew]) => (
      <div key={t as string} className="flex items-center gap-2 rounded-[9px] bg-white px-2.5 py-1.5" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
        <span className="flex h-5 w-5 items-center justify-center rounded-[7px] bg-[var(--purple)]" style={{ border: "1px solid var(--purple-edge)" }}><Icon name="spark" width={11} weight="bold" /></span>
        <span className="flex-1 text-[10px] font-black">{t}</span>{isNew && <NewTag />}
      </div>
    ))}</BFrame>
  ) },
  { title: "РљР»РёРµРЅС‚ РІРєР»СЋС‡С‘РЅ РјРµР¶РґСѓ СЃРµСЃСЃРёСЏРјРё", text: "РРЅС‚РµСЂР°РєС‚РёРІРЅС‹Рµ С‚СЂРµРєРµСЂС‹ РїРѕРІС‹С€Р°СЋС‚ РІРѕРІР»РµС‡С‘РЅРЅРѕСЃС‚СЊ: РєР»РёРµРЅС‚ РѕС‚РјРµС‡Р°РµС‚ РЅР°СЃС‚СЂРѕРµРЅРёРµ Рё СЃРѕР±РёСЂР°РµС‚ РєРѕР»РµСЃРѕ Р±Р°Р»Р°РЅСЃР° вЂ” Р° РІС‹ РІРёРґРёС‚Рµ СЌС‚Рѕ РІ РµРіРѕ РєР°СЂС‚РѕС‡РєРµ.", illo: (
    <BFrame><div className="flex justify-center gap-1.5">{["рџћ", "рџ•", "рџђ", "рџ™‚", "рџ„"].map((f, i) => <span key={i} className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[18px]" style={{ background: i === 3 ? "var(--ink)" : `var(--mood-${i + 1})`, border: `var(--bw) solid ${i === 3 ? "var(--ink)" : "rgba(32,28,24,.4)"}` }}>{f}</span>)}</div><p className="text-center text-[10px] font-black text-[var(--muted)]">РєР»РёРµРЅС‚ РѕС‚РјРµС‡Р°РµС‚ СЃРѕСЃС‚РѕСЏРЅРёРµ СЃР°Рј</p></BFrame>
  ) },
  { title: "РџСЂРѕРіСЂРµСЃСЃ РІРёРґРµРЅ РѕР±РѕРёРј", text: "РџСЂРѕРіСЂРµСЃСЃ-Р±Р°СЂ Рё РґРёРЅР°РјРёРєР° РїРѕРєР°Р·С‹РІР°СЋС‚ СЃРѕСЃС‚РѕСЏРЅРёРµ РєР»РёРµРЅС‚Р° РѕС‚ РІСЃС‚СЂРµС‡Рё Рє РІСЃС‚СЂРµС‡Рµ вЂ” СѓРґРѕР±РЅРѕ РѕР±СЃСѓР¶РґР°С‚СЊ РёР·РјРµРЅРµРЅРёСЏ Рё СѓРґРµСЂР¶РёРІР°С‚СЊ РІ С‚РµСЂР°РїРёРё.", illo: (
    <BFrame>{[["РўСЂРµРІРѕРіР°", 40, "var(--coral)"], ["РќР°СЃС‚СЂРѕРµРЅРёРµ", 72, "var(--green)"], ["Р‘Р°Р»Р°РЅСЃ", 61, "var(--purple)"]].map(([label, w, c]) => (
      <div key={label as string} className="flex items-center gap-2"><span className="w-16 text-[9px] font-bold text-[var(--muted)]">{label}</span>
        <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-white" style={{ border: "var(--bw) solid var(--purple-edge)" }}><motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.7 }} style={{ background: c as string }} /></div></div>
    ))}</BFrame>
  ) },
  { title: "РџСЂРѕС„РёР»СЊ РїРѕСЏРІР»СЏРµС‚СЃСЏ РІ РєР°С‚Р°Р»РѕРіРµ", text: `РџРµСЂРІС‹Рµ ${CATALOG_FREE_DAYS} РґРЅРµР№ РїРѕСЃР»Рµ РІРµСЂРёС„РёРєР°С†РёРё Р°РЅРєРµС‚Р° СЃС‚РѕРёС‚ РІ РєР°С‚Р°Р»РѕРіРµ Р±РµСЃРїР»Р°С‚РЅРѕ, РґР°Р»СЊС€Рµ РµС‘ РґРµСЂР¶РёС‚ PRO. РњРµСЃС‚Рѕ РІ РІС‹РґР°С‡Рµ РєСѓРїРёС‚СЊ РЅРµР»СЊР·СЏ вЂ” РїРѕРґР±РѕСЂРєРё СЃРѕР±РёСЂР°СЋС‚СЃСЏ РїРѕ СЃРѕРІРїР°РґРµРЅРёСЋ СЃ Р·Р°РїСЂРѕСЃРѕРј.`, illo: (
    <BFrame>
      <div className="flex items-center gap-2 rounded-[9px] bg-[var(--green-soft)] px-2.5 py-2" style={{ border: "var(--bw) solid var(--green-edge)" }}>
        <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-white" style={{ border: "1px solid var(--green-edge)" }}><Icon name="check" width={15} weight="bold" /></span>
        <span className="flex-1 text-[10px] font-black">РџСЂРѕС„РёР»СЊ РѕРїСѓР±Р»РёРєРѕРІР°РЅ</span>
        <span className="text-[8px] font-black uppercase text-[var(--muted)]">РЅР° СЂР°РІРЅС‹С…</span>
      </div>
      {["РЎРѕРІРїР°РґРµРЅРёРµ СЃ Р·Р°РїСЂРѕСЃРѕРј", "Р РµР№С‚РёРЅРі РїРѕСЃР»Рµ СЃРµСЃСЃРёР№"].map((t) => <div key={t} className="rounded-[9px] bg-white px-2.5 py-1.5 text-[10px] font-bold text-[var(--muted)]" style={{ border: "var(--bw) solid var(--edge-neutral)" }}>{t}</div>)}
    </BFrame>
  ) },
];

// РњРёРЅРёР°С‚СЋСЂР°-Р±Р°РЅРЅРµСЂ: СЃРІС‘СЂРЅСѓС‚Р°СЏ вЂ” РІРёС‚СЂРёРЅР° С‚Р°СЂРёС„Р°, СЂР°СЃРєСЂС‹С‚Р°СЏ вЂ” С‡С‚Рѕ Р±РµСЃРїР»Р°С‚РЅРѕ,
// С‡С‚Рѕ РІ РїРѕРґРїРёСЃРєРµ, Рё СЃР°Рј Р±Р»РѕРє РѕРїР»Р°С‚С‹.
// Р§С‚Рѕ СЃРєР°Р·Р°С‚СЊ РїСЂРѕ С‚Р°СЂРёС„ РїСЂСЏРјРѕ РІ СЃРІС‘СЂРЅСѓС‚РѕРј Р±Р°РЅРЅРµСЂРµ: РґРѕ РѕРїР»Р°С‚С‹ С‡РµР»РѕРІРµРє РІРёРґРёС‚
// РёРјРµРЅРЅРѕ СЌС‚Сѓ СЃС‚СЂРѕРєСѓ, РїРѕСЌС‚РѕРјСѓ РѕРЅР° РіРѕРІРѕСЂРёС‚ РїСЂРѕ СЃСЂРѕРє, Р° РЅРµ РїСЂРѕ СЃРїРёСЃРѕРє С„СѓРЅРєС†РёР№.
function bannerPitch(sub: Subscription | undefined): string {
  if (!sub) return "РљР»РёРµРЅС‚С‹ Р±РµР· Р»РёРјРёС‚Р° Рё РјРµСЃС‚Рѕ РІ РєР°С‚Р°Р»РѕРіРµ, РєРѕРіРґР° Р±РµСЃРїР»Р°С‚РЅС‹Рµ РґРЅРё РІС‹С€Р»Рё.";
  if (sub.status === "active") {
    // РћРїР»Р°С‡РµРЅРЅС‹Р№ РїРµСЂРёРѕРґ РІРёРґРµРЅ СЃСЂР°Р·Сѓ РІ СЃРІС‘СЂРЅСѓС‚РѕРј Р±Р°РЅРЅРµСЂРµ: В«Р°РєС‚РёРІРЅР°В» Р±РµР· СЃСЂРѕРєР°
    // РЅРµ РѕС‚РІРµС‡Р°РµС‚ РЅР° РµРґРёРЅСЃС‚РІРµРЅРЅС‹Р№ РІРѕРїСЂРѕСЃ вЂ” СЃРєРѕР»СЊРєРѕ РµС‰С‘ РѕСЃС‚Р°Р»РѕСЃСЊ.
    const left = paidDaysLeft(sub);
    return left > 0
      ? `РџРѕРґРїРёСЃРєР° Р°РєС‚РёРІРЅР° вЂ” РѕСЃС‚Р°Р»РѕСЃСЊ ${left} ${plural(left, "РґРµРЅСЊ", "РґРЅСЏ", "РґРЅРµР№")}${sub.currentPeriodEnd ? `, РґРѕ ${dF.format(new Date(sub.currentPeriodEnd))}` : ""}.`
      : "РџРѕРґРїРёСЃРєР° Р°РєС‚РёРІРЅР° вЂ” Р»РёРјРёС‚РѕРІ РЅРµС‚, РєР°СЂС‚РѕС‡РєР° РІ РєР°С‚Р°Р»РѕРіРµ.";
  }
  if (sub.status === "pending") return "Р–РґС‘Рј РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РїР»Р°С‚РµР¶Р°.";
  const cat = catalogDaysLeft(sub);
  if (sub.status === "trial") {
    const d = trialDaysLeft(sub);
    return `РџСЂРѕР±РЅС‹Р№ PRO: РѕСЃС‚Р°Р»РѕСЃСЊ ${d} ${plural(d, "РґРµРЅСЊ", "РґРЅСЏ", "РґРЅРµР№")}.`;
  }
  if (sub.status === "free") {
    return cat > 0
      ? `РљР°С‚Р°Р»РѕРі Р±РµСЃРїР»Р°С‚РЅРѕ РµС‰С‘ ${cat} ${plural(cat, "РґРµРЅСЊ", "РґРЅСЏ", "РґРЅРµР№")}. ${TRIAL_DAYS} РґРЅРµР№ PRO РІРєР»СЋС‡Р°С‚СЃСЏ РїРѕСЃР»Рµ РїРµСЂРІРѕР№ СЃРµСЃСЃРёРё.`
      : `${TRIAL_DAYS} РґРЅРµР№ PRO РІРєР»СЋС‡Р°С‚СЃСЏ СЃР°РјРё РїРѕСЃР»Рµ РїРµСЂРІРѕР№ РїСЂРѕРІРµРґС‘РЅРЅРѕР№ СЃРµСЃСЃРёРё.`;
  }
  return cat > 0
    ? `РљР°СЂС‚РѕС‡РєР° РІ РєР°С‚Р°Р»РѕРіРµ РµС‰С‘ ${cat} ${plural(cat, "РґРµРЅСЊ", "РґРЅСЏ", "РґРЅРµР№")} вЂ” РґР°Р»СЊС€Рµ РµС‘ РґРµСЂР¶РёС‚ PRO.`
    : "РљР»РёРµРЅС‚С‹ Р±РµР· Р»РёРјРёС‚Р° Рё РјРµСЃС‚Рѕ РІ РєР°С‚Р°Р»РѕРіРµ СЃРїРµС†РёР°Р»РёСЃС‚РѕРІ.";
}

export function SubscriptionBanner() {
  const [open, setOpen] = useState(false);
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription });
  const rows = COMPARE;
  const title = "РҐСЂРѕРЅРёРєР° PRO";
  const price = monthlyPrice(sub);
  const crossed = crossedPrice(sub);
  const pitch = bannerPitch(sub);

  return (
    <div className="overflow-hidden rounded-[20px]" style={{ background: "var(--purple-soft)" }}>
      <button onClick={() => { tap(); setOpen(!open); }} className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={open}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]" style={{ background: "var(--purple)" }}>
          <Icon name="spark" width={22} weight="fill" color="var(--purple-edge)" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="t-head">{title}</span>
            {/* РЎРєРёРґРєР° Р·Р° РѕС‚РєР°Р· РІ РєР°С‚Р°Р»РѕРіРµ: СЃС‚Р°СЂСѓСЋ С†РµРЅСѓ РїРµСЂРµС‡С‘СЂРєРёРІР°РµРј, С‡С‚РѕР±С‹
                СЂР°Р·РЅРёС†Р° С‡РёС‚Р°Р»Р°СЃСЊ Р±РµР· РїРѕСЏСЃРЅРµРЅРёР№. */}
            {crossed && <span className="tnum text-[11px] font-bold text-[var(--muted-2)] line-through">{rub(crossed)}</span>}
            <span className="tnum text-[12.5px] font-black" style={{ color: "var(--purple-edge)" }}>{rub(price)}/РјРµСЃ</span>
          </span>
          <span className="t-sub mt-0.5 block">{pitch}</span>
        </span>
        <span className="arrow" style={{ transform: open ? "rotate(90deg)" : "none" }}><ArrowGlyph /></span>
      </button>

      <div className={`grid transition-[grid-template-rows,opacity] duration-300 ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`} style={{ transitionTimingFunction: "var(--ease-out)" }} aria-hidden={!open} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <div className="px-4 pb-4">
            <div className="rounded-[14px] bg-white p-3">
              <div className="mb-1.5 grid grid-cols-[1fr_auto_auto] items-center gap-x-3">
                <span className="t-micro">Р§С‚Рѕ РІС…РѕРґРёС‚</span>
                <span className="t-micro w-14 text-center">Free</span>
                <span className="t-micro w-14 text-center" style={{ color: "var(--purple-edge)" }}>PRO</span>
              </div>
              {rows.map((row) => (
                <div key={row.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-t py-2" style={{ borderColor: "var(--edge-neutral)" }}>
                  <span className="t-cap" style={{ color: "var(--ink)" }}>{row.label}</span>
                  <span className="flex w-14 justify-center"><CompareCell value={row.free} /></span>
                  <span className="flex w-14 justify-center"><CompareCell value={row.pro} /></span>
                </div>
              ))}
            </div>
            {sub?.status !== "active" && <div className="mt-3"><ProCta label="РџРѕРґРєР»СЋС‡РёС‚СЊ" note={false} /></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SubscriptionBlock({ compact = false }: { compact?: boolean }) {
  const qc = useQueryClient();
  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: getSubscription, refetchInterval: (q) => (q.state.data?.status === "pending" ? 1500 : false) });
  const [benefits, setBenefits] = useState(false);
  const subscribe = useMutation({ mutationFn: (plan: PlanId) => startSubscription(plan), onSuccess: (r) => { if (r.confirmation_url) window.location.href = r.confirmation_url; else qc.invalidateQueries({ queryKey: ["subscription"] }); } });

  if (!sub) return <div className="skeleton h-40" />;
  const pending = sub.status === "pending";

  const hero = psyHero(sub);
  const perks: { icon: IconName; label: string }[] = [
    { icon: "calendar", label: "РЈРґРѕР±РЅР°СЏ СЂР°Р±РѕС‚Р°" },
    { icon: "spark", label: "РћР±РЅРѕРІР»РµРЅРёСЏ РјРµС‚РѕРґРёРє" },
    { icon: "heart", label: "Р’РѕРІР»РµС‡С‘РЅРЅРѕСЃС‚СЊ" },
    { icon: "chart", label: "РџСЂРѕРіСЂРµСЃСЃ РєР»РёРµРЅС‚Р°" },
  ];

  const paid = sub.status === "active";
  const shownPlans: Plan[] = paid ? [] : PSY_PLANS;

  // compact вЂ” Р±Р»РѕРє Р¶РёРІС‘С‚ РІРЅСѓС‚СЂРё Р±Р°РЅРЅРµСЂР°, РєРѕС‚РѕСЂС‹Р№ СѓР¶Рµ РїРѕРєР°Р·Р°Р» С€Р°РїРєСѓ Рё СЃСЂР°РІРЅРµРЅРёРµ.
  if (compact) {
    return (
      <div className="space-y-2.5">
        {pending ? (
          <p className="py-2 text-center text-[13px] font-bold text-[var(--muted)]">Р–РґС‘Рј РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РїР»Р°С‚РµР¶Р°вЂ¦</p>
        ) : (
          <>
            {shownPlans.map((plan) => <PlanCard key={plan.id} plan={plan} onPick={() => subscribe.mutate(plan.id)} loading={subscribe.isPending} defaultOpen={plan.best || shownPlans.length === 1} price={monthlyPrice(sub)} crossed={crossedPrice(sub)} />)}
            <p className="pt-1 text-center text-[10px] font-semibold text-[var(--muted-2)]">РћРїР»Р°С‚Р° С‡РµСЂРµР· Р®Kassa В· РѕС‚РјРµРЅР° РІ Р»СЋР±РѕР№ РјРѕРјРµРЅС‚ В· РіРѕРґРѕРІР°СЏ РѕРїР»Р°С‚Р° вЂ” 2 РјРµСЃСЏС†Р° РІ РїРѕРґР°СЂРѕРє</p>
          </>
        )}
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-[22px]" style={{ border: "var(--bw-lg) solid var(--purple-edge)" }}>
      <div className="relative p-5" style={{ background: "linear-gradient(150deg, var(--purple) 0%, var(--purple-soft) 100%)" }}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3 py-1 text-[11px] font-black text-white"><Icon name="seal" width={14} weight="fill" color="var(--amber-soft)" /> РњР•РўРћР”РРљРђ PRO</span>
          {hero.badge}
        </div>
        <div className="mt-3">
          <h3 className="font-tight text-[22px] font-black leading-tight">{hero.title}</h3>
          <p className="mt-1 text-[12px] font-bold text-[var(--muted)]">{hero.subtitle}</p>
          {hero.progress}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {perks.map((p) => (
            <div key={p.label} className="flex items-center gap-2 rounded-[11px] bg-[#ffffff] px-2.5 py-2" style={{ border: "var(--bw) solid var(--purple-edge)" }}>
              <Icon name={p.icon} width={15} weight="bold" /><span className="text-[11px] font-black leading-tight">{p.label}</span>
            </div>
          ))}
        </div>
        <button onClick={() => { tap(); setBenefits(true); }} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[13px] bg-[var(--ink)] py-2.5 text-[13px] font-black text-white">
          <Icon name="spark" width={15} weight="fill" /> РЎРјРѕС‚СЂРµС‚СЊ РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё
        </button>
      </div>

      <div className="space-y-2.5 bg-[var(--surface)] p-4">
        {pending ? (
          <p className="py-2 text-center text-[13px] font-bold text-[var(--muted)]">Р–РґС‘Рј РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РїР»Р°С‚РµР¶Р°вЂ¦</p>
        ) : (
          <>
            {!paid && <div className="space-y-1.5"><p className="px-1 text-[11px] font-black uppercase tracking-[.06em] text-[var(--muted)]">Р§С‚Рѕ РІС…РѕРґРёС‚</p><FreeVsPro /></div>}
            {shownPlans.map((plan) => <PlanCard key={plan.id} plan={plan} onPick={() => subscribe.mutate(plan.id)} loading={subscribe.isPending} defaultOpen={plan.best || shownPlans.length === 1} price={monthlyPrice(sub)} crossed={crossedPrice(sub)} />)}
            <p className="pt-1 text-center text-[10px] font-semibold text-[var(--muted-2)]">РћРїР»Р°С‚Р° С‡РµСЂРµР· Р®Kassa В· РѕС‚РјРµРЅР° РІ Р»СЋР±РѕР№ РјРѕРјРµРЅС‚ В· РіРѕРґРѕРІР°СЏ РѕРїР»Р°С‚Р° вЂ” 2 РјРµСЃСЏС†Р° РІ РїРѕРґР°СЂРѕРє</p>
          </>
        )}
      </div>

      {benefits && <HelpDeck title="Р’РѕР·РјРѕР¶РЅРѕСЃС‚Рё РҐСЂРѕРЅРёРєР° PRO" pages={PRO_BENEFITS} onClose={() => setBenefits(false)} doneLabel="Р’С‹Р±СЂР°С‚СЊ С‚Р°СЂРёС„" onDone={() => setBenefits(false)} />}
    </section>
  );
}

function psyHero(sub: Subscription): { badge: ReactNode; title: string; subtitle: string; progress: ReactNode } {
  if (sub.status === "trial") {
    const daysLeft = Math.min(TRIAL_DAYS, trialDaysLeft(sub));
    return {
      badge: <span className="rounded-full bg-[#ffffff] px-2.5 py-1 text-[11px] font-black" style={{ border: "var(--bw) solid var(--purple-edge)" }}>рџЋЃ РўСЂРёР°Р»</span>,
      title: `${TRIAL_DAYS} РґРЅРµР№ Р±РµСЃРїР»Р°С‚РЅРѕ`,
      subtitle: `РџРѕР»РЅС‹Р№ РґРѕСЃС‚СѓРї РєРѕ РІСЃРµРј РёРЅСЃС‚СЂСѓРјРµРЅС‚Р°Рј. РљР°СЂС‚Р° РЅРµ РЅСѓР¶РЅР° вЂ” РѕСЃС‚Р°Р»РѕСЃСЊ ${daysLeft} ${plural(daysLeft, "РґРµРЅСЊ", "РґРЅСЏ", "РґРЅРµР№")}.`,
      progress: <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#ffffff]" style={{ border: "var(--bw) solid var(--purple-edge)" }}><motion.div className="h-full rounded-full bg-[var(--ink)]" initial={{ width: 0 }} animate={{ width: `${(daysLeft / TRIAL_DAYS) * 100}%` }} transition={{ duration: 0.6 }} /></div>,
    };
  }
  if (sub.status === "pending") return { badge: null, title: "РџРѕРґС‚РІРµСЂР¶РґР°РµРј РѕРїР»Р°С‚СѓвЂ¦", subtitle: "РћР±С‹С‡РЅРѕ Р·Р°РЅРёРјР°РµС‚ РїР°СЂСѓ СЃРµРєСѓРЅРґ.", progress: null };
  if (sub.status === "active") {
    const left = paidDaysLeft(sub);
    const until = sub.currentPeriodEnd ? `РґРѕ ${dF.format(new Date(sub.currentPeriodEnd))}` : "Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё";
    return { badge: <span className="rounded-full bg-[var(--green-soft)] px-2.5 py-1 text-[11px] font-black" style={{ border: "var(--bw) solid var(--green-edge)" }}>Р°РєС‚РёРІРЅР°</span>, title: "РҐСЂРѕРЅРёРєР° PRO Р°РєС‚РёРІРµРЅ", subtitle: left > 0 ? `РћСЃС‚Р°Р»РѕСЃСЊ ${left} ${plural(left, "РґРµРЅСЊ", "РґРЅСЏ", "РґРЅРµР№")} вЂ” РїСЂРѕРґР»РёС‚СЃСЏ ${until}.` : `РџСЂРѕРґР»РёС‚СЃСЏ ${until}.`, progress: null };
  }

  // РўСЂРёР°Р» РµС‰С‘ РЅРµ РЅР°С‡РёРЅР°Р»СЃСЏ: РѕРЅ РІРєР»СЋС‡РёС‚СЃСЏ СЃР°Рј, РєРѕРіРґР° РїСЂРѕР№РґС‘С‚ РїРµСЂРІР°СЏ СЃРµСЃСЃРёСЏ.
  // РџСЂРѕ СЌС‚Рѕ РІР°Р¶РЅРѕ СЃРєР°Р·Р°С‚СЊ РІСЃР»СѓС…, РёРЅР°С‡Рµ Р±РµСЃРїР»Р°С‚РЅС‹Р№ С‚Р°СЂРёС„ РІС‹РіР»СЏРґРёС‚ РєР°Рє РѕС‚РєР°Р·.
  if (sub.status === "free") {
    const days = catalogDaysLeft(sub);
    return {
      badge: <span className="rounded-full bg-[#ffffff] px-2.5 py-1 text-[11px] font-black" style={{ border: "var(--bw) solid var(--purple-edge)" }}>рџЋЃ {TRIAL_DAYS} РґРЅРµР№ РІРїРµСЂРµРґРё</span>,
      title: "Р‘РµСЃРїР»Р°С‚РЅС‹Р№ С‚Р°СЂРёС„",
      subtitle: days > 0
        ? `${FREE_CLIENT_LIMIT} РєР»РёРµРЅС‚Р° СЃРѕ РІСЃРµРј С„СѓРЅРєС†РёРѕРЅР°Р»РѕРј, РєР°СЂС‚РѕС‡РєР° РІ РєР°С‚Р°Р»РѕРіРµ РµС‰С‘ ${days} ${plural(days, "РґРµРЅСЊ", "РґРЅСЏ", "РґРЅРµР№")}. ${TRIAL_DAYS} РґРЅРµР№ PRO РІРєР»СЋС‡Р°С‚СЃСЏ СЃР°РјРё РїРѕСЃР»Рµ РїРµСЂРІРѕР№ РїСЂРѕРІРµРґС‘РЅРЅРѕР№ СЃРµСЃСЃРёРё.`
        : `${FREE_CLIENT_LIMIT} РєР»РёРµРЅС‚Р° СЃРѕ РІСЃРµРј С„СѓРЅРєС†РёРѕРЅР°Р»РѕРј. ${TRIAL_DAYS} РґРЅРµР№ PRO РІРєР»СЋС‡Р°С‚СЃСЏ СЃР°РјРё РїРѕСЃР»Рµ РїРµСЂРІРѕР№ РїСЂРѕРІРµРґС‘РЅРЅРѕР№ СЃРµСЃСЃРёРё.`,
      progress: null,
    };
  }

  const days = catalogDaysLeft(sub);
  return {
    badge: <span className="rounded-full bg-[#ffffff] px-2.5 py-1 text-[11px] font-black" style={{ border: "var(--bw) solid var(--purple-edge)" }}>{rub(PLAN_PRICE.pro)}/РјРµСЃ</span>,
    title: "Р‘РµСЃРїР»Р°С‚РЅС‹Р№ С‚Р°СЂРёС„",
    subtitle: days > 0
      ? `${FREE_CLIENT_LIMIT} РєР»РёРµРЅС‚Р° СЃРѕ РІСЃРµРј С„СѓРЅРєС†РёРѕРЅР°Р»РѕРј, РєР°СЂС‚РѕС‡РєР° РІ РєР°С‚Р°Р»РѕРіРµ РµС‰С‘ ${days} ${plural(days, "РґРµРЅСЊ", "РґРЅСЏ", "РґРЅРµР№")}. PRO СЃРЅРёРјР°РµС‚ Р»РёРјРёС‚ Рё РѕСЃС‚Р°РІР»СЏРµС‚ РІР°СЃ РІ РєР°С‚Р°Р»РѕРіРµ.`
      : `${FREE_CLIENT_LIMIT} РєР»РёРµРЅС‚Р° СЃРѕ РІСЃРµРј С„СѓРЅРєС†РёРѕРЅР°Р»РѕРј. PRO вЂ” РєР»РёРµРЅС‚С‹ Р±РµР· Р»РёРјРёС‚Р° Рё РјРµСЃС‚Рѕ РІ РєР°С‚Р°Р»РѕРіРµ СЃРїРµС†РёР°Р»РёСЃС‚РѕРІ.`,
    progress: null,
  };
}

function PlanCard({ plan, onPick, loading, defaultOpen = false, price = PLAN_PRICE.pro, crossed = null }: { plan: Plan; onPick: () => void; loading: boolean; defaultOpen?: boolean; price?: number; crossed?: number | null }) {
  const best = plan.best;
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="relative rounded-[16px]" style={{ background: best ? "var(--purple-soft)" : "#fff", border: `var(--bw-lg) solid ${best ? "var(--purple-edge)" : "var(--edge-neutral)"}` }}>
      {best && <span className="absolute -top-2.5 left-4 z-[1] rounded-full bg-[var(--ink)] px-2.5 py-0.5 text-[9px] font-black uppercase text-white">РѕСЃРЅРѕРІРЅРѕР№</span>}
      <button onClick={() => { tap(); setOpen(!open); }} className="flex w-full items-center gap-2 p-3.5 text-left" aria-expanded={open}>
        <div className="flex-1"><p className="text-[15px] font-black">{plan.name}</p><p className="text-[10px] font-black uppercase tracking-[.06em] text-[var(--muted-2)]">{plan.tag}</p></div>
        <div className="text-right">{crossed && <p className="tnum text-[11px] font-bold text-[var(--muted-2)] line-through">{rub(crossed)}</p>}<p className="font-tight text-[20px] font-black leading-none">{rub(price)}</p><p className="text-[10px] font-bold text-[var(--muted)]">РІ РјРµСЃСЏС†</p></div>
        <ArrowGlyph className="shrink-0 text-[var(--muted-2)] transition-transform" style={{ transform: open ? "rotate(-90deg)" : "rotate(90deg)" }} />
      </button>
      <Disclosure open={open}>
        <div className="px-3.5 pb-3.5">
          <ul className="space-y-1">
            {plan.perks.map((perk) => (
              <li key={perk} className="flex items-start gap-1.5 text-[11px] font-semibold text-[var(--muted)]"><Icon name="check" width={13} weight="bold" className="mt-0.5 shrink-0" color="var(--green-edge)" />{perk}</li>
            ))}
          </ul>
          <button onClick={() => { tap(); onPick(); }} disabled={loading} className="mt-3 w-full rounded-[12px] py-2.5 text-[13px] font-black transition-transform active:scale-[0.98] disabled:opacity-50" style={best ? { background: "var(--ink)", color: "#fff" } : { background: "#fff", border: "var(--bw) solid var(--purple-edge)" }}>
            {loading ? "Р“РѕС‚РѕРІРёРј РѕРїР»Р°С‚СѓвЂ¦" : `РџРѕРґРєР»СЋС‡РёС‚СЊ В· ${rub(price)}/РјРµСЃ`}
          </button>
        </div>
      </Disclosure>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
