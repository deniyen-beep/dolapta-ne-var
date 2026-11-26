# 🍳 Dolapta Ne Var?

Dolabındaki malzemeleri yaz, yapay zekâ sana **tatlı ve tuzlu tarifler** önersin — malzemeleri ve adım adım yapılışıyla.

- Ön yüz: `index.html` (tek sayfa, telefona yüklenebilir uygulama / PWA)
- Tarif servisi: `api/tarif.js` (Google Gemini yapay zekâsını kullanır)
- Fotoğraftan malzeme tanıma: `api/malzeme.js` (dolabın fotoğrafındaki malzemeleri Gemini bulur)
- Şef servisi: `api/sef.js` (tarif hakkında soru, tarifi uyarlama, haftalık menü, menüden tarif)
- Ortak yapay zekâ kodu: `api/_gemini.js`
- Kullanım sınırı: `api/_limit.js` (kişi başına günde 30 tarif, 15 fotoğraf; dakikada en fazla 6 tarif, 4 fotoğraf)
- `sw.js` + `manifest.json` + ikonlar: uygulamanın telefona "yüklenebilmesi" için

---

## 1. Ücretsiz Gemini API anahtarı al
1. https://aistudio.google.com/apikey adresine Google hesabınla gir.
2. **Create API key** → anahtarı kopyala. (Kimseyle paylaşma, koda yazma!)

## 2. İnternete yayınla (Vercel — ücretsiz)
1. https://vercel.com adresine **GitHub hesabınla** giriş yap.
2. **Add New → Project** → `dolapta-ne-var` deposunu seç → **Import**.
3. **Environment Variables** bölümüne ekle:
   - Ad: `GEMINI_API_KEY` — Değer: 1. adımda aldığın anahtar
4. **Deploy**'a bas. Birkaç dakika sonra `https://dolapta-ne-var.vercel.app` gibi bir adresin olur. 🎉

> Anahtarı sonradan eklediysen: Vercel → Project → Deployments → son dağıtım → **Redeploy**.

## 3. İnsanlar nasıl yükler?
Adresi paylaş (WhatsApp, Instagram biyografisi, QR kod…). Kişi linke girince:
- **Android (Chrome):** sayfadaki **📲 Uygulamayı telefonuna yükle** düğmesine basar.
- **iPhone (Safari):** Paylaş ⬆️ → **Ana Ekrana Ekle**.

Uygulama ana ekranda kendi ikonuyla, normal bir uygulama gibi açılır.

## 4. Google Play / App Store'a koymak (isteğe bağlı)
- **Google Play:** https://www.pwabuilder.com adresine site adresini yaz → Android paketi oluştur →
  Google Play Console'a yükle (bir kerelik 25 $ geliştirici ücreti).
- **App Store:** Apple Developer hesabı (yıllık 99 $) + bir Mac gerekir; PWABuilder'ın iOS paketi
  veya Capacitor ile sarılır. Apple "sadece web sitesi" olan uygulamaları reddedebilir; favoriler,
  bildirim gibi özellikler eklemek onayı kolaylaştırır.

## Ziyaretçi istatistikleri
Vercel → proje → **Analytics** sekmesi → **Enable**. Kod sayfaya zaten eklendi; açtıktan sonra ziyaretçi sayıları burada görünür.

## Bilgisayarında denemek
```bash
GEMINI_API_KEY=anahtarın npm run dev
# → http://localhost:3000
```

## Sonraki geliştirme fikirleri
- Tarifi WhatsApp'ta paylaş düğmesi
- Gemini ücretsiz kotası dolarsa: kullanıcı başına günlük istek sınırı

---

# 💊 İlaç Saatim

İlaçlarını ekle, saati gelince hatırlatsın. Adres: `https://<site-adresin>/ilac/`

- Ön yüz: `ilac/index.html` (ayrı bir telefona yüklenebilir uygulama; kendi ikonu, `manifest.json` ve `sw.js` dosyası var)
- Takvim servisi: `api/takvim.js` — ilaç listesinden telefonun takvimine eklenebilen, alarmlı ve her gün tekrarlayan bir takvim dosyası üretir. Böylece uygulama kapalıyken de telefon hatırlatır. Hiçbir bilgi sunucuda saklanmaz.
- Yapay zekâ anahtarı gerekmez. Bütün bilgiler sadece kişinin kendi telefonunda durur (Ayarlar → Yedek ile taşınabilir).

Özellikler: günde birkaç saat, belirli günler, bitiş tarihi (kür), aç/tok bilgisi, "İçtim / 10 dk ertele / Atla",
içilmezse 15 dk sonra bir daha hatırlatma, kutuda kalan doz takibi, son 7 günün geçmişi, gece modu.
