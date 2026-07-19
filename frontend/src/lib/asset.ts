// Ссылка на public-ассет с учётом basePath (на GitHub Pages сайт живёт в /bereg).
export const asset = (p: string) => `${process.env.NEXT_PUBLIC_BASE_PATH || ""}${p}`;
