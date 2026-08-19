import { GroupDetail } from "./group-detail";

// Статическому экспорту нужна хотя бы одна страница: демо-группа. Созданные
// в рантайме открываются клиентской навигацией внутри SPA.
export function generateStaticParams() {
  return [{ id: "901" }];
}

export default function Page() {
  return <GroupDetail />;
}
