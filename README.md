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

# 💊 MediTime — İlaçlarını Unutma

İlaçlarını, ölçümlerini ve doktor randevularını takip eden, saati gelince hatırlatan şık bir uygulama. Adres: `https://<site-adresin>/ilac/`

- Ön yüz: `ilac/index.html` (ayrı bir telefona yüklenebilir uygulama; kendi ikonu, `manifest.json` ve `sw.js` dosyası var)
- Takvim servisi: `api/takvim.js` — ilaç saatlerini ve randevuları telefonun takvimine alarmlı olarak ekler; uygulama kapalıyken de hatırlatılır.
- Yapay zekâ servisi: `api/ilac.js` — ilaç kutusunun fotoğrafından ad/güç/adet okur ve ilaç hakkında genel bilgi verir (`GEMINI_API_KEY` ile; kişi başı günlük sınırlı).
- Bütün sağlık bilgileri sadece kişinin kendi telefonunda durur (Ayarlar → Yedek ile taşınabilir).
- Eczane servisi: `api/eczane.js` — kullanıcı izin verirse konumuna, vermezse seçtiği il ve ilçeye göre yakındaki eczaneleri (OpenStreetMap) bulur. Konum saklanmaz.
- **Nöbetçi eczaneler (isteğe bağlı):** collectapi.com'dan "Nöbetçi Eczane" API anahtarı alıp Vercel'e `COLLECTAPI_KEY` olarak eklersen nöbetçi eczaneler uygulamanın içinde listelenir. Anahtar yoksa uygulama e-Devlet'in resmî nöbetçi eczane sayfasını ve haritayı açar.

Özellikler:
- Gerçekçi ilaç çizimleri (tablet, film tablet, kapsül, yumuşak kapsül, şurup, damla, iğne, inhaler, krem, saşe) ve renk seçimi
- Her gün / belirli günler / birkaç günde bir / gerektiğinde planları; süre (kür) ve aç-tok bilgisi
- İlaçtan önce hatırlatma (varsayılan 60, 30 ve 5 dk; Ayarlar'dan seçilir) — takvim dosyasına da ek alarm olarak eklenir
- Aile bildirimi: doz gecikince WhatsApp'tan hazır mesajla haber verme ve günün özetini gönderme (mesaj kullanıcı “Gönder”e basınca gider)
- İlaç etkileşimi kontrolü (yapay zekâ, `api/ilac.js` → `etkilesim`): yeni ilaç eklenince otomatik, İlaçlar sekmesinden elle
- Reçete bitiş hatırlatıcısı: 7, 3, 1 gün kala ve bittiği gün; takvime de eklenir
- Sesli okuma: saat gelince ilacın adı, gücü, dozu ve nasıl alınacağı telefonun Türkçe sesiyle okunur (Ayarlar'dan açılıp kapanır, yavaş hız seçilebilir)
- Hatırlatma ekranı ve bildirim: Aldım, 10 dk ertele, Atla; içilmezse 15 dk sonra tekrar
- Haftalık takvim şeridi, günün bölümlerine (sabah/öğle/akşam/gece) göre plan, sıradaki doz geri sayımı
- Stok takibi ("kaç gün yeter"), azalınca uyarı, eczane bulma
- Aile: annen, baban, çocuğun için ayrı listeler
- Sağlık: tansiyon, şeker, nabız, kilo, ateş, oksijen ölçümleri ve grafikleri; doktor randevuları
- Eczaneler: konum izninin ne için istendiğini açıklayan ekran, yakındaki eczaneler (uzaklık, adres, telefon, yol tarifi), nöbetçi eczaneler
- Rapor: 30 günlük uyum, 5 haftalık ısı haritası, seri ve başarı rozetleri, doktora gösterilecek PDF rapor
- Açık/koyu tema, büyük yazı, üç farklı zil sesi
