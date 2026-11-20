import { sinirKontrol } from "./_limit.js";
import { gemini, hataCevabi, tercihKurallari, temizListe, TARIF_SEMASI } from "./_gemini.js";

const OGUNLER = {
  "kahvaltı": "kahvaltılık tarifler (ör. menemen, omlet, pankek, gözleme, kahvaltılık börek, yumurtalı ekmek)",
  "öğle yemeği": "öğle yemeği için pratik ve hafif tarifler (ör. çorba, makarna, salata, sandviç, tavada pratik yemekler)",
  "akşam yemeği": "akşam yemeği için doyurucu ana yemekler (ör. fırın yemekleri, sulu yemekler, et/tavuk yemekleri, pilav yanında yemekler)",
  "atıştırmalık": "tuzlu atıştırmalıklar (ör. tuzlu kurabiye, poğaça, kraker, peynirli çubuk, mini börek, çıtır atıştırmalıklar); tatlı OLMASIN",
  "tatlı": "tatlılar (ör. kek, kurabiye, sütlü tatlılar, şerbetli tatlılar, pasta)"
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ hata: "Sadece POST isteği kabul edilir." });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ hata: "Sunucuda GEMINI_API_KEY ayarlanmamış." });
  const sinir = sinirKontrol(req, "tarif", 30, 6);
  if (sinir) return res.status(429).json({ hata: sinir });

  const { malzemeler, tur, tercih, haric } = req.body || {};
  if (!Array.isArray(malzemeler) || malzemeler.length === 0 || malzemeler.length > 30) {
    return res.status(400).json({ hata: "Malzeme listesi geçersiz." });
  }
  const temiz = temizListe(malzemeler).join(", ");
  const istek = OGUNLER[tur]
    ? `İstenen kategori: ${tur} → ${OGUNLER[tur]}. 4 tarifin hepsi bu kategoriden olsun.`
    : "4 tarif farklı kategorilerden olsun: 1 kahvaltı, 1 öğle ya da akşam yemeği, 1 tuzlu atıştırmalık, 1 tatlı.";
  const onceki = temizListe(haric, 20);

  const prompt = `Sen yaratıcı ama pratik bir Türk ev aşçısısın.
Kullanıcının elindeki malzemeler: ${temiz}.
${istek}
${tercihKurallari(tercih)}
${onceki.length ? `Bu tarifleri daha önce önerdin, bunlardan FARKLI tarifler öner: ${onceki.join(", ")}.` : ""}
Bu malzemelerle yapılabilecek 4 tarif öner. Kısa ve öz yaz.
Tarifler mümkün olduğunca sadece bu malzemeleri kullansın; tuz, yağ, su, karabiber gibi temel mutfak malzemeleri her evde var say. Gerçekten şart olan başka bir şey varsa "eksik_malzemeler" listesine yaz (en fazla 2 tane).
SADECE geçerli bir JSON dizisi döndür. Her öğe şu alanlara sahip olsun:
${TARIF_SEMASI}
Hepsi Türkçe olsun.`;

  try {
    const tarifler = await gemini({ parts: [{ text: prompt }], temperature: onceki.length ? 1.0 : 0.9 });
    return res.status(200).json({ tarifler: Array.isArray(tarifler) ? tarifler : [] });
  } catch (e) {
    return hataCevabi(res, e);
  }
}
