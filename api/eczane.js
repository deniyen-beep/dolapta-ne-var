// MediTime — eczane servisi
// GET ?islem=yakin&lat=..&lon=..   → yakındaki eczaneler (OpenStreetMap: Nominatim, yedek Overpass) ve bölge adı
// GET ?islem=ara&il=..&ilce=..     → il/ilçe adından konum bulur, sonra yakındaki eczaneler
// GET ?islem=nobetci&il=..&ilce=.. → bugünün nöbetçi eczaneleri (COLLECTAPI_KEY tanımlıysa)
// Konum hiçbir yerde saklanmaz; sadece bu aramayı yapmak için kullanılır.
import { sinirKontrol } from "./_limit.js";

const UA = "MediTime/1.0 (eczane arama)";
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const temiz = (s, n = 60) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
// "BAĞDAT SEDA ECZANESİ" → "Bağdat Seda Eczanesi" (sadece tamamı büyük harfle yazılmışsa)
const duzelt = t => !t || t !== t.toLocaleUpperCase("tr") || !/[A-ZÇĞİÖŞÜ]{3}/.test(t) ? t
  : t.toLocaleLowerCase("tr").replace(/(^|[\s(/.-])(\p{L})/gu, (m, a, h) => a + h.toLocaleUpperCase("tr"));
const sayi = (v, min, max) => { const n = parseFloat(v); return Number.isFinite(n) && n >= min && n <= max ? n : null; };

async function getJson(url, secenek = {}, sure = 12000) {
  const r = await fetch(url, { ...secenek, headers: { "User-Agent": UA, "Accept-Language": "tr", ...(secenek.headers || {}) }, signal: AbortSignal.timeout(sure) });
  if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
  return r.json();
}

// Nominatim saniyede en fazla 1 istek ister: istekleri sıraya koy, gerekirse bir kez daha dene
let sonNominatim = 0;
const bekle = ms => new Promise(ok => setTimeout(ok, ms));
async function nominatim(yol) {
  for (let deneme = 0; deneme < 2; deneme++) {
    const kalan = sonNominatim + 1100 - Date.now();
    if (kalan > 0) await bekle(kalan);
    sonNominatim = Date.now();
    try { return await getJson("https://nominatim.openstreetmap.org/" + yol); }
    catch (e) { if (deneme || !/ (429|629|503)$/.test(e.message)) throw e; }
  }
}

// Koordinattan il / ilçe / mahalle
async function bolge(lat, lon) {
  try {
    const j = await nominatim(`reverse?format=jsonv2&zoom=16&accept-language=tr&lat=${lat}&lon=${lon}`);
    const a = j.address || {};
    const il = a.province || a.state || a.city || "";
    let ilce = a.town || a.county || a.city_district || a.district || a.municipality || (a.city !== il ? a.city : "") || "";
    return { il: temiz(il, 40), ilce: temiz(ilce, 40), mahalle: temiz(a.suburb || a.quarter || a.neighbourhood || a.village || "", 50) };
  } catch { return { il: "", ilce: "", mahalle: "" }; }
}

// İl / ilçe adından koordinat
async function bul(il, ilce) {
  const q = encodeURIComponent([ilce, il, "Türkiye"].filter(Boolean).join(", "));
  const j = await nominatim(`search?format=jsonv2&limit=1&countrycodes=tr&accept-language=tr&q=${q}`);
  if (!Array.isArray(j) || !j.length) return null;
  return { lat: +(+j[0].lat).toFixed(4), lon: +(+j[0].lon).toFixed(4) };
}

const GUNLER = { Mo: "Pzt", Tu: "Sal", We: "Çar", Th: "Per", Fr: "Cum", Sa: "Cmt", Su: "Paz", PH: "Resmî tatil" };
const saatYaz = s => !s ? "" : s === "24/7" ? "7/24 açık" : temiz(s, 80).replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, m => GUNLER[m]).replace(/\boff\b/g, "kapalı").replace(/;\s*/g, " · ");

// Önce Nominatim (hızlı, telefon ve adresle); az sonuç gelirse veya hata olursa Overpass
async function nominatimEczane(lat, lon) {
  for (const d of [0.025, 0.06]) {
    const kutu = [lon - d * 1.3, lat + d, lon + d * 1.3, lat - d].map(x => x.toFixed(4)).join(",");
    const j = await nominatim(`search?format=jsonv2&q=pharmacy&bounded=1&limit=40&addressdetails=1&extratags=1&accept-language=tr&viewbox=${kutu}`);
    const l = (Array.isArray(j) ? j : []).filter(x => x.type === "pharmacy" || /eczane/i.test(x.name || "")).map(x => {
      const a = x.address || {}, t = x.extratags || {};
      const adres = [a.road ? `${a.road}${a.house_number ? " No: " + a.house_number : ""}` : "", a.suburb || a.quarter || "", a.town || a.county || a.city_district || ""].filter(Boolean).join(", ");
      return { ad: temiz(x.name || "Eczane", 60), lat: +x.lat, lon: +x.lon, adres: temiz(adres, 120), tel: temiz(t.phone || t["contact:phone"] || "", 30), saat: saatYaz(t.opening_hours) };
    });
    if (l.length >= 5 || d > 0.05) return l;
  }
  return [];
}

async function eczaneler(lat, lon) {
  try { const l = await nominatimEczane(lat, lon); if (l.length >= 3) return l; } catch (e) { console.error("Nominatim eczane:", e?.message); }
  return overpassEczane(lat, lon);
}

async function overpassEczane(lat, lon) {
  const sorgu = r => `[out:json][timeout:15];(node["amenity"="pharmacy"](around:${r},${lat},${lon});way["amenity"="pharmacy"](around:${r},${lat},${lon}););out center tags 60;`;
  let sonuc = null, hata;
  for (const r of [2500, 6000]) {
    for (const uc of OVERPASS) {
      try {
        const j = await getJson(uc, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(sorgu(r)) }, 16000);
        sonuc = j.elements || []; break;
      } catch (e) { hata = e; }
    }
    if (sonuc && sonuc.length >= 4) break;
  }
  if (!sonuc) throw hata || new Error("Eczane verisi alınamadı");
  return sonuc.map(e => {
    const t = e.tags || {};
    const elat = e.lat ?? e.center?.lat, elon = e.lon ?? e.center?.lon;
    const adres = [t["addr:street"] ? `${t["addr:street"]}${t["addr:housenumber"] ? " No: " + t["addr:housenumber"] : ""}` : "", t["addr:district"] || t["addr:suburb"] || "", t["addr:city"] || ""].filter(Boolean).join(", ");
    return { ad: temiz(t.name || t["name:tr"] || "Eczane", 60), lat: elat, lon: elon, adres: temiz(adres, 120), tel: temiz(t.phone || t["contact:phone"] || "", 30), saat: saatYaz(t.opening_hours) };
  }).filter(e => e.lat && e.lon);
}

// Nöbet her sabah 08.30'da (Türkiye saati) değişir: listeyi o saate kadar sakla (ücretsiz planda ayda 100 istek var)
function nobetSuresi() {
  const tr = new Date(Date.now() + 3 * 3600e3);
  const dk = tr.getUTCHours() * 60 + tr.getUTCMinutes();
  const kalan = (dk < 510 ? 510 - dk : 1440 - dk + 510) * 60;
  const gun = new Date(tr.getTime() - (dk < 510 ? 864e5 : 0)).toISOString().slice(0, 10);
  return { kalan: Math.max(300, kalan), gun };
}
const nobetBellek = new Map();

// Nöbetçi eczaneler: CollectAPI (anahtar Vercel'de COLLECTAPI_KEY olarak tanımlanır)
async function nobetci(il, ilce) {
  const anahtar = process.env.COLLECTAPI_KEY;
  if (!anahtar || !il) return { yok: true };
  const { gun } = nobetSuresi(), anahtarB = `${il}|${ilce}|${gun}`.toLocaleLowerCase("tr");
  if (nobetBellek.has(anahtarB)) return nobetBellek.get(anahtarB);
  const sonuc = await nobetciCek(anahtar, il, ilce);
  if (sonuc.eczaneler.length) { nobetBellek.set(anahtarB, sonuc); if (nobetBellek.size > 500) nobetBellek.delete(nobetBellek.keys().next().value); }
  return sonuc;
}

async function nobetciCek(anahtar, il, ilce) {
  const url = `https://api.collectapi.com/health/dutyPharmacy?il=${encodeURIComponent(il)}${ilce ? "&ilce=" + encodeURIComponent(ilce) : ""}`;
  const j = await getJson(url, { headers: { authorization: anahtar.startsWith("apikey") ? anahtar : "apikey " + anahtar, "content-type": "application/json" } });
  const liste = Array.isArray(j?.result) ? j.result : Array.isArray(j?.data) ? j.data : [];
  return {
    kaynak: "collectapi",
    eczaneler: liste.slice(0, 40).map(x => {
      const [la, lo] = String(x.loc || x.konum || "").split(",").map(Number);
      return { ad: duzelt(temiz(x.name || x.eczaneAdi || x.ad || "Eczane", 60)), adres: duzelt(temiz(x.address || x.adres || "", 140)), tel: temiz(x.phone || x.telefon || "", 30),
        ilce: duzelt(temiz(x.dist || x.ilce || "", 40)), lat: Number.isFinite(la) ? la : null, lon: Number.isFinite(lo) ? lo : null };
    })
  };
}

export default async function handler(req, res) {
  const q = req.query || {};
  const sinir = sinirKontrol(req, "eczane", 80, 12);
  if (sinir) return res.status(429).json({ hata: sinir });
  try {
    if (q.islem === "yakin" || q.islem === "ara") {
      let lat = sayi(q.lat, 35, 43), lon = sayi(q.lon, 25, 45.5);
      if (q.islem === "ara") {
        const k = await bul(temiz(q.il, 40), temiz(q.ilce, 40));
        if (!k) return res.status(404).json({ hata: "Bu il ve ilçeyi bulamadım. Yazımı kontrol et." });
        ({ lat, lon } = k);
      }
      if (lat == null || lon == null) return res.status(400).json({ hata: "Konum Türkiye sınırları içinde değil gibi görünüyor." });
      const konum = q.islem === "ara" ? { il: temiz(q.il, 40), ilce: temiz(q.ilce, 40), mahalle: "" } : await bolge(lat, lon);
      const liste = await eczaneler(lat, lon);
      res.setHeader("Cache-Control", "public, s-maxage=3600, max-age=600");
      return res.status(200).json({ merkez: { lat, lon }, konum, eczaneler: liste });
    }
    if (q.islem === "nobetci") {
      const r = await nobetci(temiz(q.il, 40), temiz(q.ilce, 40));
      const sure = r.eczaneler?.length ? nobetSuresi().kalan : 300;
      res.setHeader("Cache-Control", `public, s-maxage=${sure}, max-age=${Math.min(sure, 1800)}`);
      return res.status(200).json(r);
    }
    return res.status(400).json({ hata: "Bilinmeyen işlem." });
  } catch (e) {
    console.error("Eczane servisi:", e?.message);
    return res.status(502).json({ hata: "Eczane bilgisi şu an alınamadı. Biraz sonra tekrar dene." });
  }
}
