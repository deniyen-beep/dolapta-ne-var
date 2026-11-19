// Yemek fotoğrafı bulur: önce Pexels (PEXELS_API_KEY varsa), olmazsa Wikipedia.
// GET /api/resim?q=menemen  →  { url, kredi, kaynak, link }  ya da  { url: null }
const UA = "DolaptaNeVar/1.0 (recipe app; photo lookup)";

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

async function wikipedia(q) {
  const api = "https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=3" +
    "&prop=pageimages&piprop=thumbnail&pithumbsize=900&gsrsearch=" + encodeURIComponent(q + " food dish");
  const r = await fetch(api, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) return null;
  const pages = Object.values((await r.json())?.query?.pages || {}).sort((a, b) => a.index - b.index);
  const sayfa = pages.find(p => /\.(jpe?g|png|webp)$/i.test(p.thumbnail?.source || ""));
  if (!sayfa) return null;
  return {
    url: sayfa.thumbnail.source, kredi: null, kaynak: "Wikipedia",
    link: "https://en.wikipedia.org/?curid=" + sayfa.pageid
  };
}

export default async function handler(req, res) {
  const q = String(req.query?.q || "").trim().slice(0, 60);
  if (!q) return res.status(400).json({ url: null });
  try {
    let sonuc = null;
    if (process.env.PEXELS_API_KEY) sonuc = await pexels(q, process.env.PEXELS_API_KEY).catch(() => null);
    if (!sonuc) sonuc = await wikipedia(q).catch(() => null);
    // Aynı yemek için bir hafta boyunca tekrar aramasın (kota dostu)
    res.setHeader("Cache-Control", "public, s-maxage=604800, max-age=86400");
    return res.status(200).json(sonuc || { url: null });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ url: null });
  }
}
