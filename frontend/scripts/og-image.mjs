// Рисует карточку для соцсетей и поисковых превью: public/og.png (1200×630).
// Запуск: node scripts/og-image.mjs
import sharp from "sharp";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#faf5ea"/>
  <circle cx="1075" cy="90" r="230" fill="#e7ddf3" opacity="0.75"/>
  <circle cx="120" cy="600" r="190" fill="#d4e0cc" opacity="0.7"/>
  <g font-family="Nunito, Segoe UI, Arial, sans-serif" fill="#201c18">
    <text x="88" y="132" font-size="34" font-weight="800" letter-spacing="1">ХРОНИКА</text>
    <text x="88" y="272" font-size="72" font-weight="900">Цифровая платформа</text>
    <text x="88" y="356" font-size="72" font-weight="900">для улучшения</text>
    <text x="88" y="440" font-size="72" font-weight="900" fill="#9077bd">ментального здоровья</text>
    <text x="88" y="536" font-size="30" font-weight="600" fill="#6d6862">Каталог психологов · онлайн-запись · дневник настроения</text>
    <text x="88" y="580" font-size="30" font-weight="600" fill="#6d6862">Приложение в Telegram и в браузере · chronika.space</text>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile("public/og.png");
console.log("public/og.png готов");
