// Ne Alsam? uygulamasının fotoğraftan ilgi alanı bulma servisi.
// POST { resim: "data:image/jpeg;base64,..." }  →  { ilgi: ["kahve", "kamp", ...], ozet: "..." }
import { sinirKontrol } from "./_limit.js";
import { cors, gemini, hataCevabi, temizMetin } from "./_gemini.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ hata: "Sadece POST isteği kabul edilir." });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ hata: "Sunucuda GEMINI_API_KEY ayarlanmamış." });

  const sinir = sinirKontrol(req, "ilgi", 15, 4);
  if (sinir) return res.status(429).json({ hata: sinir });

  const m = String(req.body?.resim || "").match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return res.status(400).json({ hata: "Fotoğraf okunamadı, tekrar dene." });
  if (m[2].length > 3_500_000) return res.status(413).json({ hata: "Fotoğraf çok büyük." });

  const prompt = `Bu fotoğraf, birine hediye almak isteyen kullanıcının yüklediği bir görsel: kişinin odası, masası, rafı, bir sosyal medya profilinin ekran görüntüsü ya da kişinin bir fotoğrafı olabilir.
Görselde AÇIKÇA görünen ipuçlarına bakarak bu kişinin ilgi alanlarını ve zevkini tahmin et (ör. kitaplar → "kitap", gitar → "müzik", bitkiler → "bitkiler", forma → "futbol").
Kurallar: sadece görünen şeylerden çıkarım yap; kişinin dış görünüşü, yaşı, dini, sağlığı gibi hassas konularda yorum yapma; marka adı yazma; her ilgi alanı 1-3 kelimelik, Türkçe ve küçük harfli olsun; en fazla 8 tane.
SADECE şu JSON nesnesini döndür: {"ilgi": [string], "ozet": "zevkini anlatan kısa, sıcak bir cümle"}`;

  try {
    const j = await gemini({
      parts: [{ inline_data: { mime_type: m[1], data: m[2] } }, { text: prompt }],
      temperature: 0.3, maxTokens: 1024, timeout: 45000
    });
    const ilgi = [...new Set((Array.isArray(j?.ilgi) ? j.ilgi : [])
      .map(x => temizMetin(x, 30).toLocaleLowerCase("tr")).filter(Boolean))].slice(0, 8);
    return res.status(200).json({ ilgi, ozet: temizMetin(j?.ozet, 200) });
  } catch (e) {
    return hataCevabi(res, e);
  }
}
