// Fotoğraftaki yiyecek malzemelerini tanır.
// POST { resim: "data:image/jpeg;base64,..." }  →  { malzemeler: ["yumurta", "domates", ...] }
import { sinirKontrol } from "./_limit.js";
import { gemini, hataCevabi } from "./_gemini.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ hata: "Sadece POST isteği kabul edilir." });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ hata: "Sunucuda GEMINI_API_KEY ayarlanmamış." });

  const sinir = sinirKontrol(req, "foto", 15, 4);
  if (sinir) return res.status(429).json({ hata: sinir });

  const m = String(req.body?.resim || "").match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return res.status(400).json({ hata: "Fotoğraf okunamadı, tekrar dene." });
  if (m[2].length > 3_500_000) return res.status(413).json({ hata: "Fotoğraf çok büyük." });

  const prompt = `Bu fotoğraf bir buzdolabı, dolap ya da mutfak tezgâhı. Fotoğrafta açıkça görünen YİYECEK malzemelerini listele.
Kurallar: sadece emin olduklarını yaz; marka adı yazma; genel Türkçe adı küçük harfle yaz (örn. "yumurta", "domates", "süt", "kaşar peyniri", "tavuk"); en fazla 20 tane.
Yiyecek yoksa boş dizi döndür. SADECE JSON dizisi döndür, örn: ["yumurta","süt"]`;

  try {
    const liste = await gemini({
      parts: [{ inline_data: { mime_type: m[1], data: m[2] } }, { text: prompt }],
      temperature: 0.2, maxTokens: 1024, timeout: 45000
    });
    const malzemeler = [...new Set((Array.isArray(liste) ? liste : [])
      .map(x => String(x).trim().toLocaleLowerCase("tr").slice(0, 40)).filter(Boolean))].slice(0, 20);
    return res.status(200).json({ malzemeler });
  } catch (e) {
    return hataCevabi(res, e);
  }
}
