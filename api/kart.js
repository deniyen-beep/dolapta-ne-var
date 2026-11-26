import { sinirKontrol } from "./_limit.js";
import { cors, gemini, hataCevabi, temizMetin } from "./_gemini.js";

const TONLAR = {
  "duygusal": "duygusal ve içten, abartısız",
  "komik": "esprili ve sıcak, gülümseten ama kırıcı olmayan",
  "kısa": "çok kısa ve öz, en fazla 2 cümle",
  "şiirsel": "şiirsel, 4 dizelik kafiyeli bir dörtlük"
};

// Ne Alsam? uygulamasının kart notu servisi
export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ hata: "Sadece POST isteği kabul edilir." });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ hata: "Sunucuda GEMINI_API_KEY ayarlanmamış." });

  const b = req.body || {};
  const hediye = temizMetin(b.hediye, 80);
  const kime = temizMetin(b.kime, 30);
  if (!hediye || !kime) return res.status(400).json({ hata: "Hediye bilgisi eksik." });

  const sinir = sinirKontrol(req, "kart", 30, 6);
  if (sinir) return res.status(429).json({ hata: sinir });

  const ton = TONLAR[b.ton] ? b.ton : "duygusal";
  const isim = temizMetin(b.isim, 30);
  const gun = temizMetin(b.gun, 40);

  const prompt = `Bir hediyenin yanına konacak kısa bir kart notu yaz.
Kime: ${kime}${isim ? ` (adı: ${isim})` : ""}.
${gun ? `Vesile: ${gun}.` : ""}
Hediye: ${hediye}.
Ton: ${TONLAR[ton]}.
Kurallar: Türkçe yaz, samimi ol, en fazla 60 kelime. Hediyeye ince bir göndermede bulun ama hediyenin adını aynen tekrarlama. Başlık, tırnak işareti ya da açıklama ekleme, sadece kart metnini yaz. İmza yazma.`;

  try {
    const mesaj = await gemini({ parts: [{ text: prompt }], json: false, temperature: 1.0, maxTokens: 400 });
    return res.status(200).json({ mesaj: mesaj.replace(/^["“”']+|["“”']+$/g, "").trim() });
  } catch (e) {
    return hataCevabi(res, e);
  }
}
