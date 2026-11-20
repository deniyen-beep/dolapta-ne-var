// Şef servisi: tarif hakkında soru, tarifi değiştirme, haftalık menü, menüden tam tarif
// POST { islem: "sor" | "degistir" | "menu" | "detay", ... }
import { sinirKontrol } from "./_limit.js";
import { gemini, hataCevabi, tercihKurallari, temizListe, TARIF_SEMASI } from "./_gemini.js";

const DEGISIKLIK = {
  "kolay": "daha kolay ve daha az adımlı yap",
  "saglikli": "daha sağlıklı yap (daha az yağ, şeker ve tuz; kızartma yerine fırın/haşlama)",
  "firinsiz": "fırın kullanmadan yap (tava, tencere ya da pişirmesiz)",
  "hizli": "toplam süreyi olabildiğince kısalt",
  "vejetaryen": "vejetaryen yap (et, tavuk, balık yerine uygun alternatifler)"
};

// İstemciden gelen tarifi güvenli ve kısa bir metne çevirir
function tarifMetni(t) {
  if (!t || typeof t !== "object") return "";
  const k = (v, n) => String(v ?? "").slice(0, n);
  return [
    `Tarif: ${k(t.ad, 80)} (${k(t.sure, 20)}, ${k(t.zorluk, 10)})`,
    "Malzemeler: " + temizListe(t.malzemeler, 25).join("; "),
    "Adımlar: " + (Array.isArray(t.adimlar) ? t.adimlar : []).slice(0, 12).map((a, i) => `${i + 1}) ${k(a, 300)}`).join(" ")
  ].join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ hata: "Sadece POST isteği kabul edilir." });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ hata: "Sunucuda GEMINI_API_KEY ayarlanmamış." });
  const b = req.body || {};

  try {
    if (b.islem === "sor") {
      const sinir = sinirKontrol(req, "sef", 40, 8);
      if (sinir) return res.status(429).json({ hata: sinir });
      const soru = String(b.soru || "").trim().slice(0, 300);
      if (!soru) return res.status(400).json({ hata: "Bir soru yaz." });
      const gecmis = (Array.isArray(b.gecmis) ? b.gecmis : []).slice(-6)
        .map(m => `${m.kim === "sef" ? "Şef" : "Kullanıcı"}: ${String(m.metin || "").slice(0, 400)}`).join("\n");
      const prompt = `Sen sıcakkanlı, pratik bir Türk ev şefisin. Kullanıcı şu tarifi yapıyor:
${tarifMetni(b.tarif)}
${gecmis ? "Önceki konuşma:\n" + gecmis : ""}
Kullanıcının sorusu: ${soru}
Kısa, net ve uygulanabilir Türkçe cevap ver (en fazla 4-5 cümle). Yemekle ilgisiz sorularda nazikçe tarife dön. Sadece düz metin yaz, başlık ya da madde işareti kullanma.`;
      const cevap = await gemini({ parts: [{ text: prompt }], json: false, temperature: 0.6, maxTokens: 600, timeout: 30000 });
      return res.status(200).json({ cevap });
    }

    if (b.islem === "degistir") {
      const sinir = sinirKontrol(req, "sef", 40, 8);
      if (sinir) return res.status(429).json({ hata: sinir });
      const ne = DEGISIKLIK[b.nasil];
      if (!ne) return res.status(400).json({ hata: "Geçersiz değişiklik." });
      const prompt = `Sen pratik bir Türk ev aşçısısın. Aşağıdaki tarifi ${ne}.
${tarifMetni(b.tarif)}
${tercihKurallari(b.tercih)}
Yemeğin ruhunu koru. Gerekirse adını da uygun şekilde değiştir.
SADECE tek bir JSON nesnesi döndür:
${TARIF_SEMASI}
Hepsi Türkçe olsun.`;
      const tarif = await gemini({ parts: [{ text: prompt }], temperature: 0.7, maxTokens: 2048 });
      return res.status(200).json({ tarif: Array.isArray(tarif) ? tarif[0] : tarif });
    }

    if (b.islem === "menu") {
      const sinir = sinirKontrol(req, "menu", 6, 2);
      if (sinir) return res.status(429).json({ hata: sinir });
      const malz = temizListe(b.malzemeler);
      const prompt = `Sen pratik bir Türk ev aşçısısın. Pazartesiden pazara 7 günlük ev menüsü hazırla: her gün 1 kahvaltı ve 1 akşam yemeği.
${malz.length ? `Evdeki malzemeler: ${malz.join(", ")}. Bunları öncelikle kullan.` : ""}
${tercihKurallari(b.tercih)}
Yemekler birbirini tekrar etmesin, Türk mutfağı ağırlıklı ama çeşitli olsun, hafta içi pratik, hafta sonu biraz daha özel.
Ayrıca evde olmayan ve menü için alınması gereken temel malzemelerin listesini çıkar (en fazla 20).
SADECE şu JSON nesnesini döndür:
{"gunler": [{"gun": "Pazartesi", "kahvalti": {"ad": string, "emoji": tek emoji, "kisa": kısa tanım (en fazla 8 kelime)}, "aksam": {"ad": string, "emoji": tek emoji, "kisa": kısa tanım}}], "alisveris": string listesi}
Hepsi Türkçe olsun.`;
      const menu = await gemini({ parts: [{ text: prompt }], temperature: 0.9, maxTokens: 3000 });
      return res.status(200).json({ menu });
    }

    if (b.islem === "detay") {
      const sinir = sinirKontrol(req, "tarif", 30, 6);
      if (sinir) return res.status(429).json({ hata: sinir });
      const ad = String(b.ad || "").trim().slice(0, 80);
      if (!ad) return res.status(400).json({ hata: "Yemek adı eksik." });
      const malz = temizListe(b.malzemeler);
      const prompt = `Sen pratik bir Türk ev aşçısısın. "${ad}" yemeğinin ev usulü tarifini yaz.
${malz.length ? `Evdeki malzemeler: ${malz.join(", ")}. Bu listede olmayan gerekli malzemeleri "eksik_malzemeler" listesine yaz.` : ""}
${tercihKurallari(b.tercih)}
SADECE tek bir JSON nesnesi döndür:
${TARIF_SEMASI}
Hepsi Türkçe olsun.`;
      const tarif = await gemini({ parts: [{ text: prompt }], temperature: 0.6, maxTokens: 2048 });
      return res.status(200).json({ tarif: Array.isArray(tarif) ? tarif[0] : tarif });
    }

    return res.status(400).json({ hata: "Geçersiz işlem." });
  } catch (e) {
    return hataCevabi(res, e);
  }
}
