// Фото из анкеты живёт data-URL: и в демо (localStorage), и в бою (JSON-поле
// анкеты). Снимок с телефона — это 4–8 МБ, в base64 ещё на треть больше: такой
// профиль не влезает в квоту localStorage, и запись падала целиком — человек
// видел, что фото «не грузится». Поэтому картинку ужимаем в браузере до
// разумного портрета и только потом кладём в анкету.

const MAX_SIDE = 1280;
const QUALITY = 0.82;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Не удалось открыть изображение"));
    image.src = src;
  });
}

/**
 * Сжатая копия фото в виде data-URL. Если браузер не смог (экзотический
 * формат, нет canvas) — возвращаем оригинал: лучше тяжёлое фото, чем никакого.
 */
export async function compressImage(file: File, maxSide = MAX_SIDE, quality = QUALITY): Promise<string> {
  const original = await readAsDataUrl(file);
  try {
    const image = await loadImage(original);
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    if (scale === 1 && original.length < 700_000) return original;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const compressed = canvas.toDataURL("image/jpeg", quality);
    return compressed.length < original.length ? compressed : original;
  } catch {
    return original;
  }
}
