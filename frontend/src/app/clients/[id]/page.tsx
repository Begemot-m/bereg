import { ClientDetail } from "./client-detail";

// Для статического экспорта прогенерим карточки демо-клиентов.
// Клиенты, созданные в рантайме, открываются внутри SPA (клиентская навигация).
export function generateStaticParams() {
  return [1, 2, 3, 4].map((id) => ({ id: String(id) }));
}

export default function Page() {
  return <ClientDetail />;
}
