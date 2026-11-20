// Ortak Gemini yardımcıları (tarif, şef, malzeme servisleri kullanır)
export class Hata extends Error {
  constructor(status, mesaj) { super(mesaj); this.status = status; }
}

export const TARIF_SEMASI = `{"ad": string, "emoji": tek bir yemek emojisi, "tur": "tatlı" ya da "tuzlu", "ogun": "Kahvaltı"|"Öğle Yemeği"|"Akşam Yemeği"|"Atıştırmalık"|"Tatlı", "sure": "20 dk" gibi, "zorluk": "Kolay"|"Orta"|"Zor", "aciklama": tek cümlelik iştah açıcı tanım, "besin": {"kalori": porsiyon başı yaklaşık kcal (sayı), "protein": gram (sayı), "karbonhidrat": gram (sayı), "yag": gram (sayı)}, "malzemeler": miktarlı string listesi, "eksik_malzemeler": string listesi, "adimlar": kısa ve net adım listesi (4-7 adım)}`;

const DIYETLER = {
  "vejetaryen": "vejetaryen (et, tavuk, balık yok)",
  "vegan": "vegan (hiçbir hayvansal ürün yok: et, süt, yumurta, bal, tereyağı yok)",
  "glütensiz": "glütensiz (buğday unu, irmik, bulgur, arpa, normal ekmek yok)",
  "şekersiz": "rafine şekersiz (şeker yerine meyve, bal ya da pekmez gibi doğal tatlandırıcılar)",
  "laktozsuz": "laktozsuz (süt, peynir, yoğurt, tereyağı, krema yok)",
  "çocuk dostu": "çocuklar için uygun (acısız, kolay yenir, sevimli)"
};

// Kullanıcı tercihlerini (kişi, diyet, süre) talimata çevirir
export function tercihKurallari(tercih) {
  const diyet = (Array.isArray(tercih?.diyet) ? tercih.diyet : []).filter(d => DIYETLER[d]);
  const kisi = Math.min(12, Math.max(1, parseInt(tercih?.kisi) || 2));
  const sure = [15, 30, 60].includes(+tercih?.sure) ? +tercih.sure : 0;
  return [
    `Malzeme miktarları ${kisi} kişilik olsun.`,
    diyet.length ? `Diyet kuralları, KESİNLİKLE uy: ${diyet.map(d => DIYETLER[d]).join("; ")}. Bu kurallara uymayan malzemeleri kullanma.` : "",
    sure ? `Her tarifin toplam hazırlama ve pişirme süresi en fazla ${sure} dakika olsun.` : ""
  ].filter(Boolean).join("\n");
}

export const temizListe = (liste, max = 30) =>
  (Array.isArray(liste) ? liste : []).map(m => String(m).trim().slice(0, 40)).filter(Boolean).slice(0, max);

// Gemini'ye sorar; json=true ise ayrıştırılmış JSON döndürür, değilse düz metin
export async function gemini({ parts, json = true, temperature = 0.9, maxTokens = 4096, timeout = 50000 }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Hata(500, "Sunucuda GEMINI_API_KEY ayarlanmamış.");
  const model = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
  const sor = (hizli) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(timeout),
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        ...(json ? { responseMimeType: "application/json" } : {}),
        temperature,
        maxOutputTokens: maxTokens,
        ...(hizli ? { thinkingConfig: { thinkingLevel: "minimal" } } : {})
      }
    })
  });
  let r;
  try {
    r = await sor(true);
    if (r.status === 400) r = await sor(false);
  } catch (e) {
    if (e && e.name === "TimeoutError") throw new Hata(504, "Şef çok uzun düşündü, lütfen tekrar dene.");
    throw e;
  }
  if (r.status === 429) throw new Hata(429, "Çok fazla istek geldi, biraz bekleyip tekrar dene.");
  if (!r.ok) {
    console.error("Gemini hatası:", r.status, await r.text());
    throw new Hata(502, "Yapay zeka şu an cevap veremedi.");
  }
  const data = await r.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  if (!json) return text.trim();
  const eslesme = text.match(/[\[{][\s\S]*[\]}]/);
  return JSON.parse(eslesme ? eslesme[0] : text);
}

// Ortak hata cevabı
export function hataCevabi(res, e) {
  if (e instanceof Hata) return res.status(e.status).json({ hata: e.message });
  console.error(e);
  return res.status(500).json({ hata: "Bir şeyler ters gitti, tekrar dene." });
}
