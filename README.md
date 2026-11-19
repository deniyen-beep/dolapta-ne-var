# 🍳 Dolapta Ne Var?

Dolabındaki malzemeleri yaz, yapay zekâ sana **tatlı ve tuzlu tarifler** önersin — malzemeleri ve adım adım yapılışıyla.

- Ön yüz: `index.html` (tek sayfa, telefona yüklenebilir uygulama / PWA)
- Tarif servisi: `api/tarif.js` (Google Gemini yapay zekâsını kullanır)
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
   - (İsteğe bağlı, önerilir) Ad: `PEXELS_API_KEY` — https://www.pexels.com/api/ adresinden ücretsiz alınan anahtar.
     Tariflerde daha kaliteli yemek fotoğrafları gösterir; yoksa fotoğraflar Wikipedia'dan gelir.
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

## Bilgisayarında denemek
```bash
GEMINI_API_KEY=anahtarın npm run dev
# → http://localhost:3000
```

## Sonraki geliştirme fikirleri
- Fotoğraftan malzeme tanıma (dolabın fotoğrafını çek → malzemeler otomatik eklensin)
- Diyet filtreleri: vejetaryen, glütensiz, şekersiz
- Tarifi WhatsApp'ta paylaş düğmesi
- Kişi sayısı / porsiyon ayarı
- Gemini ücretsiz kotası dolarsa: kullanıcı başına günlük istek sınırı
