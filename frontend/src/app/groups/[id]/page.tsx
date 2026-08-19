import { ModuleSoon, findModule } from "@/components/pro-modules";

import { GroupDetail } from "./group-detail";

// Статическому экспорту нужна хотя бы одна страница: демо-группа. Созданные
// в рантайме открываются клиентской навигацией внутри SPA.
export function generateStaticParams() {
  return [{ id: "901" }];
}

export default function Page() {
  // Карточку группы закрывает тот же флаг, что и раздел: иначе внутрь ведёт
  // прямая ссылка на конкретную группу.
  const mod = findModule("groups");
  if (!mod.live) return <div className="p-4"><ModuleSoon mod={mod} /></div>;
  return <GroupDetail />;
}
