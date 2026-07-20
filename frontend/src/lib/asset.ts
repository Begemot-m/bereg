// Ссылка на public-ассет с учётом basePath (на GitHub Pages сайт живёт в /bereg).
// Загруженные пользователем data/blob URL и абсолютные ссылки не изменяем.
export const asset = (p: string) => /^(data:|blob:|https?:\/\/)/i.test(p) ? p : `${process.env.NEXT_PUBLIC_BASE_PATH || ""}${p}`;
