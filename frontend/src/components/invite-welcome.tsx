"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";

import { ClientAvatar } from "@/components/client-avatar";
import { Icon, type IconName } from "@/components/icons";
import { PrivacyNote } from "@/components/privacy-note";
import { APP_NAME } from "@/lib/brand";
import { success, tap } from "@/lib/haptics";
import { getInvitePreview, type InviteKind } from "@/lib/invite";

const CAN: { icon: IconName; text: string }[] = [
  { icon: "calendar", text: "записаться к специалисту" },
  { icon: "chart", text: "делать заметки и получать статистику по ходу терапии" },
  { icon: "tools", text: "использовать инструменты платформы для самостоятельной работы" },
];

/**
 * Первый экран по ссылке-приглашению: кто позвал и что тут можно. Показывается
 * до знакомства — человек должен понимать, куда он попал, ещё до слайдов.
 * Пока карточка пригласившего едет с сервера, экран не пустует: имя появится
 * само, а текст и кнопка на месте с первой секунды.
 */
export function InviteWelcome({ token, kind, onStart }: { token: string; kind: InviteKind; onStart: () => void }) {
  const { data } = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => getInvitePreview(token),
    retry: false,
    staleTime: Infinity,
  });
  const psy = data?.psy;
  const group = data?.group;
  const sub = [psy?.method, psy?.city].filter(Boolean).join(" · ");
  // Приглашение в группу отличается от обычного одним: человек уже знает, куда
  // идёт, и место в составе займётся само — об этом и говорим прямо.
  const label = kind === "group" ? "Приглашение в группу" : kind === "card" ? "Приглашение специалиста" : "Приглашение";
  const title = group
    ? `${psy?.name ? `${psy.name} приглашает` : "Вас приглашают"} в ${group.kind === "pair" ? "работу парой" : "группу"} «${group.title}»`
    : `${psy?.name ? `Вас пригласил(а) ${psy.name}` : "Вас пригласили"} на платформу «${APP_NAME}»`;

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto" style={{ background: "var(--page)" }}>
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[560px] flex-col px-5 pb-8 pt-12">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
          <div className="card-soft flex items-center gap-3.5 p-4" style={{ background: "var(--purple-soft)" }}>
            <ClientAvatar
              name={psy?.name ?? "С"}
              photo={psy?.photo}
              className="h-[62px] w-[62px] rounded-[18px] text-[24px] font-black"
              style={{ background: "#fff", border: "var(--bw) solid var(--purple-edge)" }}
            />
            <div className="min-w-0">
              <p className="t-micro" style={{ color: "var(--purple-edge)" }}>{label}</p>
              <p className="font-tight mt-0.5 break-words text-[17px] font-black leading-tight">{psy?.name ?? "Специалист"}</p>
              {sub && <p className="t-cap mt-0.5">{sub}</p>}
            </div>
          </div>

          <h1 className="font-tight mt-6 text-[24px] font-black leading-tight">{title}</h1>
          {group && (
            <p className="t-sub mt-2">
              Место в составе займётся сразу — расписание встреч и объявления ведущего будут в приложении.
            </p>
          )}
          <p className="t-sub mt-2">Далее вы можете:</p>

          <div className="mt-3 space-y-2">
            {CAN.map((item) => (
              <div key={item.text} className="card-plain flex items-start gap-3 p-3">
                <span className="ico ico-accent h-9 w-9 shrink-0"><Icon name={item.icon} width={17} weight="bold" color="#fff" /></span>
                <p className="t-body min-w-0 flex-1 pt-1">{item.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-4"><PrivacyNote variant="invite" /></div>

          <div className="mt-3 flex items-start gap-2.5 rounded-[16px] px-3.5 py-3" style={{ background: "var(--tiffany-soft)" }}>
            <Icon name="spark" width={16} weight="fill" color="var(--tiffany-edge)" className="mt-0.5 shrink-0" />
            <p className="text-[13px] font-black leading-snug">Первым делом загляните в раздел «Терапия»</p>
          </div>
        </motion.div>

        <div className="mt-auto pt-7">
          <button onClick={() => { tap(); success(); onStart(); }} className="btn btn-accent w-full py-3.5 text-[14px]">
            Познакомиться с возможностями приложения
          </button>
        </div>
      </div>
    </div>
  );
}
