export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ hata: "Sadece POST isteği kabul edilir." });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ hata: "Sunucuda GEMINI_API_KEY ayarlanmamış." });
  }
  const { malzemeler, tur } = req.body || {};
  if (!Array.isArray(malzemeler) || malzemeler.length === 0 || malzemeler.length > 30) {
    return res.status(400).json({ hata: "Malzeme listesi geçersiz." });
  }
  const temiz = malzemeler.map(m => String(m).slice(0, 40)).join(", ");
  const secilenTur = ["tatlı", "tuzlu", "ikisi de"].includes(tur) ? tur : "ikisi de";

  const prompt = `Sen yaratıcı ama pratik bir Türk ev aşçısısın.
Kullanıcının elindeki malzemeler: ${temiz}.
İstenen tür: ${secilenTur}.
Bu malzemelerle yapılabilecek 4 tarif öner. ${secilenTur === "ikisi de" ? "2 tatlı, 2 tuzlu olsun." : ""}
Tarifler mümkün olduğunca sadece bu malzemeleri kullansın; tuz, yağ, su, karabiber gibi temel mutfak malzemeleri her evde var say. Gerçekten şart olan başka bir şey varsa "eksik_malzemeler" listesine yaz (en fazla 2 tane).
SADECE geçerli bir JSON dizisi döndür. Her öğe şu alanlara sahip olsun:
{"ad": string, "emoji": tek bir yemek emojisi, "tur": "tatlı" ya da "tuzlu", "sure": "20 dk" gibi, "zorluk": "Kolay"|"Orta"|"Zor", "aciklama": tek cümlelik iştah açıcı tanım, "malzemeler": miktarlı string listesi, "eksik_malzemeler": string listesi, "adimlar": kısa ve net adım listesi (4-7 adım)}
Hepsi Türkçe olsun.`;

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.9 }
      })
    });
    if (r.status === 429) {
      return res.status(429).json({ hata: "Çok fazla istek geldi, biraz bekleyip tekrar dene." });
    }
    if (!r.ok) {
      console.error("Gemini hatası:", r.status, await r.text());
      return res.status(502).json({ hata: "Yapay zeka şu an cevap veremedi." });
    }
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
    const eslesme = text.match(/\[[\s\S]*\]/);
    const tarifler = JSON.parse(eslesme ? eslesme[0] : text);
    return res.status(200).json({ tarifler });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ hata: "Bir şeyler ters gitti, tekrar dene." });
  }
}
