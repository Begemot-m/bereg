// Фото из анкеты живёт data-URL: и в демо (localStorage), и в бою (JSON-поле
// анкеты). Снимок с телефона — это 4–8 МБ, в base64 ещё на треть больше: такой
// профиль не влезает в квоту localStorage, и запись падала целиком — человек
// видел, что фото «не грузится». Поэтому картинку ужимаем в браузере и только
// потом кладём в анкету.

const MAX_SIDE = 1280;
// Ориентир по весу, а не одно фиксированное качество: у одного снимка 0.82
// даёт 200 КБ, у другого — полтора мегабайта. Целимся в размер и подбираем
// качество под него, начиная с высокого, — так фото не мылится там, где этого
// не требуется.
const TARGET_BYTES = 320_000;
const MAX_QUALITY = 0.92;
const MIN_QUALITY = 0.6;

const bytesOf = (dataUrl: string) => Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);

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

// WebP при том же качестве весит в полтора-два раза меньше JPEG. Поддержки
// может не быть (старый WebView) — тогда проверка вернёт png-строку, и мы
// спокойно останемся на JPEG.
let webpSupported: boolean | null = null;
function supportsWebp(): boolean {
  if (webpSupported !== null) return webpSupported;
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  webpSupported = probe.toDataURL("image/webp").startsWith("data:image/webp");
  return webpSupported;
}

function draw(image: HTMLImageElement, scale: number): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // Прозрачный PNG на JPEG иначе чернеет: подкладываем бумагу интерфейса.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Сжатая копия картинки в виде data-URL: сторона не больше `maxSide`, вес — по
 * возможности в пределах `targetBytes`. Качество снижается ступенями и только
 * пока не уложимся; если и на минимальном много — уменьшаем саму картинку.
 *
 * Если браузер не смог (экзотический формат, нет canvas) — возвращаем оригинал:
 * лучше тяжёлое фото, чем никакого.
 */
/**
 * То же сжатие, но результат — файл: сканы дипломов уезжают на сервер как
 * FormData, и мегабайтный снимок с телефона там ни к чему. Не картинку (PDF)
 * возвращаем как есть.
 */
export async function compressImageFile(
  file: File,
  options: { maxSide?: number; targetBytes?: number } = {},
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const dataUrl = await compressImage(file, options);
    const blob = await (await fetch(dataUrl)).blob();
    if (blob.size >= file.size) return file;
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${ext}`, { type: blob.type });
  } catch {
    return file;
  }
}

export async function compressImage(
  file: File,
  { maxSide = MAX_SIDE, targetBytes = TARGET_BYTES }: { maxSide?: number; targetBytes?: number } = {},
): Promise<string> {
  const original = await readAsDataUrl(file);
  try {
    const image = await loadImage(original);
    const type = supportsWebp() ? "image/webp" : "image/jpeg";
    let scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    let best: string | null = null;

    // Два прохода: сначала подбираем качество, и только если даже минимальное
    // не помещается — уменьшаем сторону ещё на 20% и пробуем снова.
    for (let pass = 0; pass < 3; pass++) {
      const canvas = draw(image, scale);
      if (!canvas) return original;
      for (let quality = MAX_QUALITY; quality >= MIN_QUALITY - 0.001; quality -= 0.08) {
        // Качество идёт по убыванию, поэтому каждый следующий снимок легче
        // предыдущего — он и остаётся лучшим из достигнутого.
        const shot = canvas.toDataURL(type, quality);
        best = shot;
        if (bytesOf(shot) <= targetBytes) return shot.length < original.length ? shot : original;
      }
      scale *= 0.8;
    }
    return best && best.length < original.length ? best : original;
  } catch {
    return original;
  }
}
