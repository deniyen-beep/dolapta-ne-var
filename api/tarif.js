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
  const OGUNLER = {
    "kahvaltı": "kahvaltılık tarifler (ör. menemen, omlet, pankek, gözleme, kahvaltılık börek, yumurtalı ekmek)",
    "öğle yemeği": "öğle yemeği için pratik ve hafif tarifler (ör. çorba, makarna, salata, sandviç, tavada pratik yemekler)",
    "akşam yemeği": "akşam yemeği için doyurucu ana yemekler (ör. fırın yemekleri, sulu yemekler, et/tavuk yemekleri, pilav yanında yemekler)",
    "atıştırmalık": "tuzlu atıştırmalıklar (ör. tuzlu kurabiye, poğaça, kraker, peynirli çubuk, mini börek, çıtır atıştırmalıklar); tatlı OLMASIN",
    "tatlı": "tatlılar (ör. kek, kurabiye, sütlü tatlılar, şerbetli tatlılar, pasta)"
  };
  const secilenTur = OGUNLER[tur] ? tur : "fark etmez";
  const istek = OGUNLER[tur]
    ? `İstenen kategori: ${secilenTur} → ${OGUNLER[tur]}. 4 tarifin hepsi bu kategoriden olsun.`
    : "4 tarif farklı kategorilerden olsun: 1 kahvaltı, 1 öğle ya da akşam yemeği, 1 tuzlu atıştırmalık, 1 tatlı.";

  const prompt = `Sen yaratıcı ama pratik bir Türk ev aşçısısın.
Kullanıcının elindeki malzemeler: ${temiz}.
${istek}
Bu malzemelerle yapılabilecek 4 tarif öner. Kısa ve öz yaz.
Tarifler mümkün olduğunca sadece bu malzemeleri kullansın; tuz, yağ, su, karabiber gibi temel mutfak malzemeleri her evde var say. Gerçekten şart olan başka bir şey varsa "eksik_malzemeler" listesine yaz (en fazla 2 tane).
SADECE geçerli bir JSON dizisi döndür. Her öğe şu alanlara sahip olsun:
{"ad": string, "emoji": tek bir yemek emojisi, "tur": "tatlı" ya da "tuzlu", "ogun": "Kahvaltı"|"Öğle Yemeği"|"Akşam Yemeği"|"Atıştırmalık"|"Tatlı", "sure": "20 dk" gibi, "zorluk": "Kolay"|"Orta"|"Zor", "aciklama": tek cümlelik iştah açıcı tanım, "wiki": yemeğin Türkçe Wikipedia'daki bilinen genel adı (örn. "Menemen", "Sütlaç", "Krep", "Poğaça", "Omlet"), "gorsel": yemeğin İngilizce Wikipedia'daki genel adı (örn. "Menemen", "Crêpe", "Rice pudding", "Omelette", "Cookie"), "malzemeler": miktarlı string listesi, "eksik_malzemeler": string listesi, "adimlar": kısa ve net adım listesi (4-7 adım)}
Hepsi Türkçe olsun.`;

  const model = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const sor = (hizli) => fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(50000),
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.9,
        maxOutputTokens: 4096,
        ...(hizli ? { thinkingConfig: { thinkingLevel: "minimal" } } : {})
      }
    })
  });

  try {
    let r = await sor(true);
    if (r.status === 400) r = await sor(false);

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
    if (e && e.name === "TimeoutError") {
      return res.status(504).json({ hata: "Şef çok uzun düşündü, lütfen tekrar dene." });
    }
    return res.status(500).json({ hata: "Bir şeyler ters gitti, tekrar dene." });
  }
}
