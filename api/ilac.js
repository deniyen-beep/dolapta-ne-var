// MediTime — yapay zekâ servisi
// POST { islem: "tara", resim: "data:image/jpeg;base64,..." } → ilaç kutusunun fotoğrafından ad, güç, form, adet
// POST { islem: "bilgi", ad: "Parol 500 mg" }                → ilaç hakkında hastaya yönelik genel bilgi
// Hiçbir bilgi kaydedilmez.
import { sinirKontrol } from "./_limit.js";
import { gemini, hataCevabi, temizMetin } from "./_gemini.js";

const FORMLAR = ["tablet", "kapsul", "oval", "yumusak", "damla", "surup", "igne", "inhaler", "krem", "sase"];
const liste = (x, n = 5, u = 140) => (Array.isArray(x) ? x : []).map(s => temizMetin(s, u)).filter(Boolean).slice(0, n);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ hata: "Sadece POST isteği kabul edilir." });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ hata: "Sunucuda GEMINI_API_KEY ayarlanmamış." });
  const b = req.body || {};

  try {
    if (b.islem === "tara") {
      const sinir = sinirKontrol(req, "ilac-tara", 20, 4);
      if (sinir) return res.status(429).json({ hata: sinir });
      const m = String(b.resim || "").match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (!m) return res.status(400).json({ hata: "Fotoğraf okunamadı, tekrar dene." });
      if (m[2].length > 3_500_000) return res.status(413).json({ hata: "Fotoğraf çok büyük." });

      const prompt = `Bu fotoğrafta bir ilaç kutusu, blister ya da ilaç şişesi var. Üzerindeki yazılardan ilacı tanı.
SADECE şu JSON nesnesini döndür:
{"bulundu": true/false, "ad": ilacın ticari adı (örn. "Parol"), "guc": etken madde miktarı (örn. "500 mg", yoksa ""),
 "form": şunlardan biri: ${FORMLAR.join(", ")} (tablet=yuvarlak tablet, oval=uzun film tablet, kapsul=sert kapsül, yumusak=yumuşak jelatin kapsül, surup=şurup/süspansiyon, damla=damla, igne=enjeksiyon/kalem, inhaler=sprey/inhaler, krem=krem/merhem/jel, sase=saşe/toz),
 "adet": kutudaki toplam tablet/kapsül sayısı (örn. "20 film tablet" yazıyorsa 20; şişe ise ml; bilinmiyorsa null),
 "etken": etken madde adı (yoksa "")}
Yazıyı okuyamıyorsan veya ilaç yoksa {"bulundu": false} döndür. Uydurma.`;
      const r = await gemini({ parts: [{ inline_data: { mime_type: m[1], data: m[2] } }, { text: prompt }], temperature: 0.1, maxTokens: 512, timeout: 45000 });
      if (!r || !r.bulundu || !temizMetin(r.ad, 40)) return res.status(200).json({ bulundu: false });
      const adet = parseInt(r.adet, 10);
      return res.status(200).json({
        bulundu: true,
        ad: temizMetin(r.ad, 40),
        guc: temizMetin(r.guc, 20),
        form: FORMLAR.includes(r.form) ? r.form : "tablet",
        adet: adet > 0 && adet < 2000 ? adet : null,
        etken: temizMetin(r.etken, 60)
      });
    }

    if (b.islem === "bilgi") {
      const ad = temizMetin(b.ad, 60);
      if (!ad) return res.status(400).json({ hata: "İlaç adı eksik." });
      const sinir = sinirKontrol(req, "ilac-bilgi", 30, 6);
      if (sinir) return res.status(429).json({ hata: sinir });

      const prompt = `"${ad}" adlı ilaç (Türkiye'de satılan ilaçlar dahil) hakkında hastaya yönelik, sade ve sakin bir Türkçeyle GENEL bilgi ver.
Kurallar: Doz önerme, tedaviyi değiştirmeyi önerme, korkutucu dil kullanma. Emin değilsen bulundu:false döndür, uydurma.
SADECE şu JSON nesnesini döndür:
{"bulundu": true/false, "etken": etken madde, "grup": ilacın grubu (örn. "Ağrı kesici ve ateş düşürücü"),
 "ne_icin": ne için kullanıldığı (1-2 kısa cümle),
 "ipuclari": [genel kullanım ipuçları, 2-4 kısa madde; örn. aç/tok, saat düzeni],
 "yan_etkiler": [sık görülen yan etkiler, 3-5 kısa madde],
 "dikkat": [önemli uyarılar, 2-4 kısa madde; örn. alkol, başka ilaçlarla etkileşim, hamilelik, araç kullanma]}`;
      const r = await gemini({ parts: [{ text: prompt }], temperature: 0.2, maxTokens: 1200, timeout: 40000 });
      if (!r || !r.bulundu) return res.status(200).json({ bulundu: false });
      return res.status(200).json({
        bulundu: true,
        etken: temizMetin(r.etken, 80),
        grup: temizMetin(r.grup, 80),
        ne_icin: temizMetin(r.ne_icin, 300),
        ipuclari: liste(r.ipuclari, 4),
        yan_etkiler: liste(r.yan_etkiler, 5, 80),
        dikkat: liste(r.dikkat, 4)
      });
    }

    return res.status(400).json({ hata: "Bilinmeyen işlem." });
  } catch (e) {
    return hataCevabi(res, e);
  }
}
