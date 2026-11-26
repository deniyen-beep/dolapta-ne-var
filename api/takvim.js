// İlaç Saatim — takvim dosyası servisi
// İlaç listesini alır, telefonun takvimine eklenebilen tekrarlayan ve alarmlı bir .ics dosyası döndürür.
// Böylece uygulama kapalıyken bile telefonun kendi takvimi ilaç saatini hatırlatır.
// Hiçbir şey kaydedilmez; veri sadece bu isteğin adresinde gelir.
const GUN = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

const temiz = (s, n) => String(s ?? "").replace(/[\r\n]+/g, " ").slice(0, n).trim();
// iCalendar metin kaçışları
const ics = s => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,");
// 75 baytı geçen satırları kurallara göre böl
function katla(satir) {
  const out = []; let parca = ""; let bayt = 0;
  for (const ch of satir) {
    const b = Buffer.byteLength(ch);
    if (bayt + b > (out.length ? 74 : 75)) { out.push(parca); parca = ""; bayt = 0; }
    parca += ch; bayt += b;
  }
  out.push(parca);
  return out.join("\r\n ");
}
const iki = n => String(n).padStart(2, "0");

export default function handler(req, res) {
  let liste, randevular;
  try {
    const v = String(req.query?.v || "").replace(/-/g, "+").replace(/_/g, "/");
    if (v.length > 12000) throw 0;
    const veri = JSON.parse(Buffer.from(v, "base64").toString("utf8"));
    // Eski sürüm: sadece ilaç dizisi. Yeni sürüm: { m: ilaçlar, r: randevular }
    liste = Array.isArray(veri) ? veri : Array.isArray(veri?.m) ? veri.m : [];
    randevular = Array.isArray(veri?.r) ? veri.r : [];
    if (!liste.length && !randevular.length) throw 0;
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("İlaç listesi okunamadı.");
  }

  const simdi = new Date();
  const bugun = `${simdi.getUTCFullYear()}${iki(simdi.getUTCMonth() + 1)}${iki(simdi.getUTCDate())}`;
  const damga = simdi.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const satirlar = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ilac Saatim//TR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:İlaç Saatim"];

  for (const m of liste.slice(0, 40)) {
    const ad = temiz(m?.a, 40);
    if (!ad) continue;
    const doz = temiz(m.d, 30), nasil = temiz(m.n, 30);
    const id = temiz(m.i, 12).replace(/[^a-z0-9]/gi, "") || "x";
    const gunler = Array.isArray(m.g) ? m.g.filter(g => Number.isInteger(g) && g >= 0 && g <= 6) : null;
    const bitis = /^\d{4}-\d{2}-\d{2}$/.test(m.b || "") ? m.b.replace(/-/g, "") : "";
    // "Birkaç günde bir" planında ilk gün başlangıç tarihidir; diğerlerinde bugünden başlar
    const baslangic = /^\d{4}-\d{2}-\d{2}$/.test(m.bs || "") && parseInt(m.r, 10) >= 2 ? m.bs.replace(/-/g, "") : bugun;
    const saatler = (Array.isArray(m.s) ? m.s : []).filter(s => /^\d{2}:\d{2}$/.test(s)).slice(0, 12);
    for (const s of saatler) {
      const [h, dk] = s.split(":");
      const aralik = parseInt(m.r, 10);
      let kural = aralik >= 2 && aralik <= 60 ? `RRULE:FREQ=DAILY;INTERVAL=${aralik}`
        : gunler && gunler.length && gunler.length < 7 ? `RRULE:FREQ=WEEKLY;BYDAY=${gunler.map(g => GUN[g]).join(",")}` : "RRULE:FREQ=DAILY";
      if (bitis) kural += `;UNTIL=${bitis}T235959`;
      const aciklama = [doz, nasil].filter(Boolean).join(" · ") || "İlaç zamanı";
      satirlar.push(
        "BEGIN:VEVENT",
        `UID:ilac-${id}-${h}${dk}@ilac-saatim`,
        `DTSTAMP:${damga}`,
        `DTSTART:${baslangic}T${h}${dk}00`,
        "DURATION:PT10M",
        kural,
        `SUMMARY:${ics("💊 " + ad + (doz ? " — " + doz : ""))}`,
        `DESCRIPTION:${ics(aciklama + " (İlaç Saatim)")}`,
        "TRANSP:TRANSPARENT",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${ics("💊 " + ad + " zamanı")}`,
        "TRIGGER:PT0M",
        "END:VALARM",
        "END:VEVENT"
      );
    }
  }
  // Doktor randevuları: bir gün önce ve bir saat önce hatırlatır
  for (const r of randevular.slice(0, 30)) {
    const t = String(r?.t || "");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)) continue;
    const baslik = temiz(r.b, 60) || "Doktor randevusu";
    const yer = temiz(r.y, 80);
    const id = temiz(r.i, 12).replace(/[^a-z0-9]/gi, "") || "r";
    satirlar.push(
      "BEGIN:VEVENT",
      `UID:randevu-${id}@ilac-saatim`,
      `DTSTAMP:${damga}`,
      `DTSTART:${t.replace(/[-:]/g, "")}00`,
      "DURATION:PT1H",
      `SUMMARY:${ics("🩺 " + baslik)}`,
      ...(yer ? [`LOCATION:${ics(yer)}`] : []),
      `DESCRIPTION:${ics("İlaç Saatim randevusu")}`,
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${ics("Yarın: " + baslik)}`, "TRIGGER:-P1D", "END:VALARM",
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${ics("1 saat sonra: " + baslik)}`, "TRIGGER:-PT1H", "END:VALARM",
      "END:VEVENT"
    );
  }
  satirlar.push("END:VCALENDAR");

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'inline; filename="ilac-saatim.ics"');
  res.setHeader("Cache-Control", "no-store");
  res.end(satirlar.map(katla).join("\r\n") + "\r\n");
}
