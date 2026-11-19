// Pexels'ten yemek fotoğrafı bulur (PEXELS_API_KEY varsa). Wikipedia araması telefonda yapılır (index.html).
// GET /api/resim?q=menemen  →  { url, kredi, kaynak, link }  ya da  { url: null }
async function pexels(q, key) {
  const r = await fetch(
    `https://api.pexels.com/v1/search?per_page=1&orientation=landscape&query=${encodeURIComponent(q + " food")}`,
    { headers: { Authorization: key }, signal: AbortSignal.timeout(8000) }
  );
  if (!r.ok) return null;
  const p = (await r.json())?.photos?.[0];
  if (!p) return null;
  return { url: p.src.large || p.src.medium, kredi: p.photographer, kaynak: "Pexels", link: p.url };
}

export default async function handler(req, res) {
  const q = String(req.query?.q || "").trim().slice(0, 60);
  if (!q) return res.status(400).json({ url: null });
  try {
    let sonuc = null;
    if (process.env.PEXELS_API_KEY) sonuc = await pexels(q, process.env.PEXELS_API_KEY).catch(() => null);
    // Aynı yemek için bir hafta boyunca tekrar aramasın (kota dostu)
    res.setHeader("Cache-Control", "public, s-maxage=604800, max-age=86400");
    return res.status(200).json(sonuc || { url: null });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ url: null });
  }
}
