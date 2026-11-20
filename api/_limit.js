// Basit kullanım sınırı (kişi başına, IP adresine göre).
// Not: Bellekte tutulur; Vercel aynı sunucuyu tekrar kullandığı sürece geçerlidir.
// Kötüye kullanıma karşı ilk savunmadır, kesin bir sayaç değildir.
const kayitlar = new Map();

export function ipAl(req) {
  const xf = req.headers?.["x-forwarded-for"];
  return (Array.isArray(xf) ? xf[0] : String(xf || "")).split(",")[0].trim() || req.socket?.remoteAddress || "bilinmiyor";
}

// tur: "tarif" | "foto"; gunluk: günlük hak; dakika: 1 dakikadaki hak
export function sinirKontrol(req, tur, gunluk, dakika) {
  const simdi = Date.now();
  const gun = new Date().toISOString().slice(0, 10);
  const anahtar = `${tur}:${ipAl(req)}`;
  let k = kayitlar.get(anahtar);
  if (!k || k.gun !== gun) k = { gun, sayi: 0, son: [] };
  k.son = k.son.filter(t => simdi - t < 60000);
  if (k.sayi >= gunluk) return "Bugünlük hakkın doldu. Yarın tekrar gel! 🌙";
  if (k.son.length >= dakika) return "Biraz yavaşla şef 🙂 Bir dakika sonra tekrar dene.";
  k.sayi++; k.son.push(simdi);
  kayitlar.set(anahtar, k);
  if (kayitlar.size > 5000) { for (const [a, v] of kayitlar) if (v.gun !== gun) kayitlar.delete(a); }
  return null;
}
