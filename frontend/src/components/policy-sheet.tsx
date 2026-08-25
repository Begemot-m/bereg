"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, type ReactNode } from "react";

import { LEGAL } from "@/lib/legal";
import { tap } from "@/lib/haptics";

/**
 * Текст политики одним куском — его показывают и страница `/policy`, и лист
 * поверх знакомства. Раньше внутри онбординга ссылка вела в никуда: без
 * пройденного знакомства `app-shell` рисует `Onboarding` на любом маршруте,
 * поэтому переход на `/policy` возвращал тот же экран.
 */
export function PolicyBody() {
  return (
    <>
      <Section title="Кто обрабатывает данные">
        Оператор — {LEGAL.operator}, {LEGAL.status}, ИНН {LEGAL.inn}. Сервис
        «{LEGAL.service}» — {LEGAL.site} и приложение в Telegram. Связаться:
        через раздел «Отдел заботы» в приложении или письмом на {LEGAL.email}.
        Остальные документы — на странице «Документы».
      </Section>

      <Section title="Какие данные мы собираем">
        Имя и данные аккаунта Telegram, почту (если вы её привязали), контакты,
        которые вы указали сами. Для специалистов — сведения профиля: опыт,
        образование, методы, стоимость и место приёма. Для клиентов — записи на
        сессии, отметки настроения, ответы колеса баланса, заметки для
        специалиста и домашние задания.
      </Section>

      <Section title="Данные о состоянии">
        Дневник настроения, заметки терапевту и колесо баланса мы относим к
        сведениям о состоянии здоровья и обрабатываем на основании вашего
        отдельного согласия. Эти записи хранятся в зашифрованном виде: ключ
        шифрования находится вне базы данных, поэтому копия базы без него
        бесполезна. Доступ к ним есть у вас и у специалиста, которого вы сами
        добавили в раздел «Терапия».
      </Section>

      <Section title="Зачем">
        Чтобы приложение работало: показывать ваши записи, напоминать о
        сессиях, вести историю встреч, давать специалисту видеть динамику
        между встречами. Мы не продаём данные и не передаём их для рекламы.
      </Section>

      <Section title="Где хранится">
        На серверах в Российской Федерации. Резервные копии шифруются до
        отправки в хранилище.
      </Section>

      <Section title="Сколько хранится">
        Пока существует ваш аккаунт. После удаления аккаунта дневник, заметки и
        ответы колеса стираются сразу; сведения о состоявшихся встречах
        сохраняются у специалиста в обезличенном виде — без имени и контактов.
        Записи журнала действий хранятся дольше: они подтверждают, что согласие
        было дано, а данные удалены.
      </Section>

      <Section title="Ваши права">
        Вы можете в любой момент выгрузить свои данные одним файлом, удалить
        аккаунт и отозвать согласие — всё это в кабинете, без обращения к нам.
        Отзыв согласия на обработку данных о состоянии означает удаление
        дневника, заметок и колеса.
      </Section>

      <Section title="Изменения">
        При изменении текста меняется редакция, и приложение попросит
        подтвердить согласие заново. Старые согласия сохраняются с указанием
        редакции, на которую они давались.
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="t-head">{title}</h2>
      <p className="t-body mt-1.5">{children}</p>
    </section>
  );
}

/** Тот же лист, что у остальных модулей: затемнение, пружина снизу, тап по фону. */
export function PolicySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[96] flex items-end justify-center @md:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className="absolute inset-0 bg-[rgba(32,28,24,.5)]" onClick={onClose} aria-label="Закрыть" />
          <motion.section
            role="dialog"
            aria-modal="true"
            initial={{ y: 32, opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 26, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="relative flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-[var(--surface)] @md:rounded-[28px]"
          >
            <div className="flex items-start justify-between gap-3 px-4 pb-1 pt-4">
              <div className="min-w-0">
                <h2 className="font-tight text-[18px] font-black leading-tight">Политика обработки персональных данных</h2>
                <p className="t-cap mt-1">Редакция от {LEGAL.version}</p>
              </div>
              <button onClick={() => { tap(); onClose(); }} className="ico h-8 w-8 shrink-0 keep-style" style={{ background: "var(--surface-2)" }} aria-label="Закрыть">
                <span className="text-[15px] font-black">×</span>
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto px-4 pb-[calc(var(--safe-bottom)+18px)] pt-3">
              <PolicyBody />
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
