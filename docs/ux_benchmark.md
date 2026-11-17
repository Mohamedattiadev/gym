# Gym — UI/UX Benchmark (2026-11-17)

Kapsam: Uygulamayı phone (390×844), iPad (820×1180) ve desktop (1440×900) boyutlarında, light ve dark temada ekran görüntüleriyle inceledim. Hevy, Strong, Fitbod, JEFIT, Alpha Progression, Ladder, MuscleWiki, Strength Level, Linear ve platform kılavuzlarıyla (Apple HIG, Material, WCAG 2.2, PWA) karşılaştırdım.
Altın kural her öneride korunuyor: **çok temiz, sade, az scroll, kalabalık yok.** Her yeni özellik için "nereye konur ki kalabalık yaratmasın" ayrıca yazıldı.

Ekran görüntüleri (repo dışında, scratchpad):
`/home/ati/tmp/claude-1000/-home-ati-Attia-Pro-Projects-gym-y/415c5113-683b-4e3b-ae7f-743ef1300f84/scratchpad/shots/`
Adlandırma: `phone-pl-*` = phone light, `phone-dk-*` = phone dark, `desktop-dl-*` = desktop light, `desktop-dk-*` = desktop dark, `ipad-il-*` = iPad light.

Ölçümler (CDP ile): tema token'larının WCAG kontrast oranları ve ekrandaki 44 px altındaki dokunma hedeflerinin listesi.

---

## Özet: en önemli 10 düzeltme (sıralı)

| # | Düzeltme | Efor | Etki |
|---|---|---|---|
| 1 | Session logger'da **Previous** (son sefer) değeri her set satırında ve +/− stepper hedefleri ≥44 px | M | high |
| 2 | Yarı saydam sticky header altından **metin sızması** (Exercise, Me, Session) — opak/blur arka plan | S | high |
| 3 | **Rest timer arka planda**: bildirim (Web Push / Notification) ve ekran kilidinde görünür sayaç; ±15 s ve Skip | M | high |
| 4 | Varsayılan tema **Light** → **Auto (System)** | S | med |
| 5 | Dark mode'da **Muscles hero içindeki beyaz mannequin kutusu** (göz alıyor) | S | med |
| 6 | Kontroller için **non-text contrast** (stepper, check butonu, kart kenarı ≈1.1:1) → 3:1 | S | high |
| 7 | Hero modları arasında **layout shift** (3D hero çok uzun, tablar fold'un altına iniyor) — tüm modlar aynı yükseklik | S | med |
| 8 | Floating **Add to workout** butonu metnin üstünü kapatıyor → içerik altına padding veya bottom bar'a entegre | S | med |
| 9 | Manifest `"orientation": "portrait"` iPad/desktop'ta yanlış → kaldır; `shortcuts` + `screenshots` ekle | S | med |
| 10 | Empty state'ler: Train'de dev illüstrasyon planları fold'un altına itiyor; Exercise > Stats boş durumu CTA altında kalıyor | S | med |

## Eksik en önemli 5 özellik

1. **Exercise history** sekmesi (geçmiş seanslar + e1RM grafiği + PR'lar) — exercise sayfasındaki mevcut Stats tab'ının içinde.
2. **Lock-screen / arka plan rest timer** (bildirim + Wake Lock + Media Session) — yeni ekran yok.
3. **Session'da inline plate math** — kg alanına uzun basınca / küçük "plates" ikonu ile sheet.
4. **CSV export** (Strong/Hevy uyumlu) — Settings > Data satırı.
5. **Per-exercise rest süresi & progression önerisi** (Alpha Progression tarzı "bugün hedef: 82.5 kg × 8") — mevcut "First time — pick a weight" satırının yerine.

---

## (a) Must-fix: kullanılabilirlik / erişilebilirlik hataları

### A1. Session logger: Previous değeri yok, stepper hedefleri küçük
- **Referans:** Hevy, her sette bir "previous workout values" sütunu ve live activity'de "previous performance on that set" gösteriyor ([Hevy Features guide](https://help.hevyapp.com/hc/en-us/articles/33106320824727), [Hevy Live Activity](https://help.hevyapp.com/hc/en-us/articles/35649846517399), [Hevy previous values](https://help.hevyapp.com/hc/en-us/articles/36011896355479)). Apple 44×44 pt ([HIG özeti](https://app.uxcel.com/courses/mobile-design/ios-app-design-712/minimum-tap-target-size-8996)), Material 48×48 dp ([Google Accessibility](https://support.google.com/accessibility/android/answer/7101858)) öneriyor. WCAG 2.2 AA alt sınırı 24×24 px.
- **Biz:** `phone-pl-session.png`. Ölçüm: `−`/`+` = **32×42 px**, set numarası 30×30, "Skip warm-up" 34×34, "Options (⋯)" 34×34. kg alanında "—" var ama son seferin değeri görünmüyor. Bir exercise kartı ≈330 pt yüksek, telefon ekranına 1,5 egzersiz sığıyor.
- **Düzeltme:** Set satırını şöyle yap: `1 · prev 80×8 · [kg] · [reps] · ✓`. Previous değeri gri ve küçük olsun, dokununca değerler kopyalansın (Hevy pattern'i). Stepper'da `−`/`+` hedefi 44×44 olsun; görsel ikon küçük kalabilir, padding ile büyütülür. Kartta "First time…" satırını yalnızca gerçekten ilk seferse göster, sonra tek satırlık hedefe dönüştür (bkz. B5).
- **Efor:** M · **Etki:** high

### A2. Yarı saydam sticky header'dan alttaki metin görünüyor
- **Referans:** Apple HIG, bar materyallerinde okunabilirliği korumak için yeterli blur/opaklık ister ([HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials)).
- **Biz:** `phone-pl-ex-how-scrolled.png` ("Smith Squat" başlığının arkasında "5–8 reps · 3 min rest" okunuyor), `phone-pl-me-scrolled.png` ("Me" arkasında "Strength / est. 1RM"), `phone-pl-session-scrolled.png` ("Full Body A" arkasında "good form").
- **Düzeltme:** Header'a `background: color-mix(var(--bg) 92%, transparent)` + `backdrop-filter: blur(16px)` ver. Ya da scroll edince opak arka plan ve 1 px alt çizgi kullan.
- **Efor:** S · **Etki:** high (her sayfada görünüyor)

### A3. UI kontrollerinin kontrastı (WCAG 1.4.11, 3:1)
- **Referans:** [W3C Understanding 1.4.11](https://w3c.github.io/wcag21/understanding/non-text-contrast): bir kontrolü tanımlamak için gereken görsel bilgi komşu renge karşı 3:1 olmalı.
- **Biz (ölçüldü):** Stepper alanı `--s2 #F7F5F3` kart `#FFFFFF` üzerinde **1.09:1**. Check butonu `--s3` **1.22:1**. Kart / arka plan **1.15:1**. Dark'ta s1/bg **1.08:1**. Neumorphic gölgeler tek ayırt edici unsur ve parlak ortamda (spor salonu) kayboluyor. `phone-pl-session.png`, `phone-dk-session.png`.
  Metin kontrastları büyük ölçüde geçiyor: t3/bg 4.62, beyaz/accent 4.57, accent-text 4.77. İstisnalar: `--accent #D93A31` doğrudan küçük metin olarak kullanılırsa bg üzerinde **3.99** (AA'yı geçmez) ve `--warn #B87A16` bg üzerinde **3.14** (metin için geçmez).
- **Düzeltme:** Input/stepper'a `1px solid var(--line-2)` ekle; `--line-2` değerini ≈`#A89F98` yapıp 3:1 sağla (sadece etkileşimli kontrollerde, kartlarda değil, böylece sade görünüm korunur). Check butonu boşken outline, tamamlanınca dolu `--ok` olsun. Link ve "Open timer" gibi küçük metinlerde her yerde `--accent-text` kullan. `--warn` metin rengini koyulaştır (≈`#8F5F0F`).
- **Efor:** S · **Etki:** high

### A4. Varsayılan tema Light; sistem dark olsa bile light açılıyor
- **Referans:** Apple HIG Dark Mode: uygulamalar sistem görünümüne uymalı ([HIG Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)).
- **Biz:** `prefers-color-scheme: dark` ile çekilen `phone-pd-*` ekranları light; `phone-pd-settings.png` → Theme = Light seçili.
- **Düzeltme:** Varsayılanı "Auto" yap; kullanıcının seçimi saklanmaya devam etsin.
- **Efor:** S · **Etki:** med

### A5. Dark mode: Muscles hero içinde beyaz mannequin kutusu
- **Biz:** `phone-dk-ex-muscles.png`: sol tarafta parlak beyaz/açık gri dikdörtgen var (animasyon arka planı), dark body map'in yanında göz alıyor. Light'ta da "kutu içinde kutu" gibi duruyor (`phone-pl-ex-muscles.png`).
- **Düzeltme:** Mannequin videosu/kanvası için tema rengine uyan arka plan, ya da `mix-blend-mode: multiply` (light) / tersine çevrilmiş varlık (dark). Kenarlık yok, body map ile aynı zemin.
- **Efor:** S · **Etki:** med

### A6. Hero modları arasında layout shift; 3D çok uzun
- **Biz:** Video/Muscles hero ≈ 290 pt; 3D hero + Front/Side/Back + legend ≈ 390 pt. Tablar fold'un altına iniyor (`phone-pl-ex-3d.png` ile `phone-pl-ex-video.png`'yi karşılaştır). Proje kuralı "How to scroll etmeden görünsün" ve 3D modunda bu kural bozuluyor.
- **Düzeltme:** Üç mod için aynı sabit aspect-ratio. Front/Side/Back seçimini hero'nun içine overlay (alt köşe, küçük segmented) olarak koy; legend'ı tek satır chip olarak hero'nun alt kenarına al. "still pose · OpenGym3D" kredisini (i) ikonuna taşı.
- **Efor:** S · **Etki:** med

### A7. Floating "Add to workout" içeriği kapatıyor
- **Biz:** `phone-pl-ex-video.png`, `phone-pl-ex-stats.png`: buton how-to adım 2'nin ve Stats boş durum metninin üstünde duruyor.
- **Referans:** Material FAB / bottom app bar: içerik FAB'ın altında kalmamalı, liste sonuna yeterli padding verilmeli ([M3 FAB](https://m3.material.io/components/floating-action-button/guidelines)).
- **Düzeltme:** `.has-cta` olan sayfalarda içerik altına `padding-bottom: calc(var(--tab-h) + 72px)` ver. Daha temiz alternatif: scroll aşağı yönde ilerlerken butonu küçük ikon-FAB'a daralt (extended → regular FAB pattern'i).
- **Efor:** S · **Etki:** med

### A8. Segmented control (Video/Muscles/3D) video üstünde küçük ve iPad'de yarım
- **Biz:** Ölçüm: segmentler **77×30 px**, hız butonu "1×" **34×30 px**. `ipad-il-ex-video.png`: koyu pill arka planı "3D"nin ortasında bitiyor, segment kesik görünüyor. Video letterbox'ı iPad'de ekranın %60'ı siyah.
- **Düzeltme:** Segment yüksekliği ≥36 px, hit area 44 px. Pill arka planı segment genişliğine sabitlensin. iPad/desktop'ta hero'yu `max-height` + yan panel olarak kullan (bkz. C2).
- **Efor:** S · **Etki:** med

### A9. Chip / filtre yüksekliği 32–34 px
- **Biz:** `phone-pl-lib.png` ve exercise variant chip'leri: 34 px ve 32 px. Tier tooltip butonu ("Top pick ⓘ") **24 px**, yani tam WCAG AA sınırında.
- **Düzeltme:** Görsel chip yüksekliği 34 px kalabilir ama hit area ≥44 px olmalı (dikey padding ya da `::after` ile genişletilmiş alan). Tier info butonuna en az 44 px hit alanı ver.
- **Efor:** S · **Etki:** low-med

### A10. Empty state'ler yanlış önceliklendirilmiş
- **Referans:** Hevy/Strong'un boş durumlarında birincil eylem (routine oluştur / boş antrenman başlat) üstte ve tek ([Hevy routines](https://www.hevyapp.com/features/gym-workout-routines/)).
- **Biz:** `phone-pl-train.png`: "No workouts yet" illüstrasyonu ekranın yarısını kaplıyor; asıl çözüm olan **Plans by level** fold'un altında. `phone-pl-ex-stats.png`: boş Stats'ta illüstrasyon var, açıklama CTA'nın altında kalıyor.
- **Düzeltme:** Train boşken illüstrasyonu küçült (≤96 px) ve "Find my plan" ile önerilen 1 planı aynı kartta göster. Exercise > Stats boşken tek satır yaz: "Bu hareketi bir antrenmanda yaptığında geçmişin burada görünür" ve küçük ikon kullan.
- **Efor:** S · **Etki:** med

### A11. Splash ilk açılışta uzun kalıyor
- **Biz:** `phone-pl-home.png`, 2,5 s sonra hâlâ splash ("GYM" logosu) gösteriyor. Diğer çalıştırmalarda Home açıldı, yani zamanlamaya bağlı.
- **Referans:** HIG Launching: launch ekranı mümkün olduğunca kısa olmalı, ilk ekrana benzemeli ([HIG Launching](https://developer.apple.com/design/human-interface-guidelines/launching)).
- **Düzeltme:** Splash'i ilk render'da (veri yüklemesini beklemeden) kapat; büyük JSON'u (exercises.json) skeleton ile arka planda yükle.
- **Efor:** S-M · **Etki:** med

### A12. Me > Strength kartında grafik yok, Home'da Install kartı en üstte
- **Biz:** `desktop-dl-me.png`: "Strength" kartında yalnızca chip'ler var, çizgi grafik görünmüyor (seed edilen 6 seansa rağmen). Ya veri yetersizliğinde boş durum gösterilmiyor ya da render hatası var; kontrol edilmeli. `desktop-dl-home.png` / `phone-pd-home.png`: "Install Gym" kartı Home'un en üst ve en değerli alanını kaplıyor.
- **Düzeltme:** Strength grafiği için en az 2 nokta yoksa tek satırlık açıklama yaz. Install önerisini ilk tamamlanan antrenmandan sonra tek seferlik küçük banner'a taşı, ya da Settings'te tut. Desktop'ta tamamen gizle.
- **Efor:** S · **Etki:** med

### A13. Kontrol: slug / başlık uyuşmazlığı
- **Biz:** `#/ex/hack-squat-toes-low-quad-copy` adresi **"Smith Squat"** başlığıyla açılıyor (Smith chip'i seçili). Library'de "Hack Squat" ayrı bir kart olarak var. Variant chip mantığında ya da veri eşlemesinde hata olabilir; doğrulanmalı.
- **Efor:** S · **Etki:** med (güven kaybı)

---

## (b) Eksik özellikler (kalabalık yaratmadan nereye konur)

| # | Özellik | Referans | Bizde şu an | Nereye (kalabalıksız) | Efor | Etki |
|---|---|---|---|---|---|---|
| B1 | **Exercise history**: geçmiş seanslar listesi + e1RM / en iyi set grafiği + PR rozetleri | Hevy'de exercise > History tab'ı her seansı tarih, set, rep ve ağırlıkla listeliyor ([Hevy library](https://help.hevyapp.com/hc/en-us/articles/35382889578135)) | Exercise > Stats boş durum; Me > Per exercise yalnızca bu hafta / geçen hafta (`desktop-dl-me.png`) | Mevcut **Stats** tab'ına: üstte sparkline + PR satırı, altında katlanabilir seans listesi. Yeni tab ekleme. Session'da egzersiz ⋯ menüsüne "History" (sheet) | M | high |
| B2 | **Arka plan / lock-screen rest timer** | Hevy Live Activity: kilit ekranında rest countdown, sonraki set, ±15 s, skip ([Hevy Live Activity](https://www.hevyapp.com/features/live-activity/)). PWA'da Web Push iOS 16.4+ ana ekran uygulamalarında var ([firt.dev iOS PWA](https://firt.dev/notes/pwa-ios/), [web.dev capabilities](https://web.dev/learn/pwa/capabilities)) | Uygulama içi pill ve ses/titreşim var; sekme arka plandayken bildirim yok (`Notification` kullanımı yok) | Yeni ekran yok: rest bitince **local notification** (SW `showNotification`), Media Session API ile kilit ekranında başlık ("Rest 0:45 · Next: Set 2 80 kg × 8"). İzin isteği ilk rest timer başlatıldığında bağlam içinde sorulsun | M | high |
| B3 | **Inline plate math** | Hevy (barbell / EZ / short bar) ve Strong set içinde plate calculator sunuyor ([Hevy features](https://help.hevyapp.com/hc/en-us/articles/33106320824727), [Strong App Store](https://apps.apple.com/gb/app/id464254577)) | Train > Tools > Plates ayrı bir araç | Session'da barbell egzersizlerinde kg alanına **long-press** ya da kg başlığının yanında küçük plaka ikonu ile mevcut Plates sheet'i önceden doldurulmuş açılsın | S | med-high |
| B4 | **Per-exercise rest süresi** | Hevy: varsayılan rest + egzersiz bazında değiştirme / kapatma ([Hevy rest timer](https://www.hevyapp.com/features/workout-rest-timer/)) | Kartta "rest 2 min" yazıyor; ayarlanabilir mi belirsiz | Kartın "rest 2 min" metnine dokununca küçük picker açılsın (1:00/1:30/2:00/3:00). Ekstra buton yok | S | med |
| B5 | **Progression önerisi (hedef set)** | Alpha Progression her çalışma seti için ağırlık ve rep hedefi veriyor; RIR opsiyonel ([Alpha Progression guide](https://alphaprogression.com/en/blog/alpha-progression-guide)) | Auto-fill + "beat last week" + plateau auto-adjust var (PLAN §9, §10) ama görünür hedef satırı yok (`phone-pl-session.png`) | "First time — …" satırının yerine tek satır: **"Bugün: 82.5 kg × 8 (geçen: 80 × 8)"**. RIR alanı eklemiyoruz (owner kararı) | S-M | high |
| B6 | **CSV export** (ve Strong/Hevy CSV import) | Hevy, workout ve measurement'ları ayrı export ediyor, Strong CSV import ediyor ([Hevy import/export](https://help.hevyapp.com/hc/en-us/articles/38001424401943)) | Yalnızca JSON export/import (`me.js exportData`) | Settings > Data: "Export CSV" satırı. Import'ta Strong/Hevy CSV tanıma | S-M | med |
| B7 | **Apple Health / Google Fit** | Fitbod, Apple Health/Strava aktivitesini recovery'ye katıyor ([Fitbod recovery](https://fitbod.me/blog/muscle-recovery/)) | Yok; PWA'dan HealthKit'e doğrudan erişim mümkün değil | Kısa vadede **yapma**. Kalori / aktivite ihtiyacı için yalnızca export yeterli. Native wrapper (Capacitor) gündeme gelirse yeniden değerlendir | L | low (PWA için) |
| B8 | **Manuel recovery düzeltme** | Fitbod: kullanıcı "Fresh Muscle Groups" ile kası daha yorgun işaretleyebiliyor ([Fitbod recovery](https://fitbod.me/blog/muscle-recovery/)) | Recovery modu otomatik | Body map > kas info sheet'inde tek bir "I'm still sore" toggle'ı | S | low-med |
| B9 | **Widget / app shortcuts** | PWA manifest `shortcuts`, ana ekran ikonuna uzun basınca menü ([web.dev capabilities](https://web.dev/learn/pwa/capabilities)) | Manifest'te `shortcuts` yok | Manifest: "Start last workout", "Rest timer", "Exercises". UI'da sıfır kalabalık | S | med |
| B10 | **Units — dumbbell per-hand / bodyweight + ek ağırlık** | JEFIT'in "per arm" değişikliği kullanıcı şikâyetine yol açtı ([JEFIT Trustpilot](https://trustpilot.com/review/jefit.com)), yani bu bilgi net gösterilmeli | kg/lb var (`phone-pd-settings.png`) | Dumbbell egzersizlerinde kg başlığına "per hand" alt etiketi; bodyweight'te "+kg". Ayar eklemiyoruz | S | med |
| B11 | **Notes per exercise / set** | Hevy ve JEFIT'te set / egzersiz notları var | PLAN'da "notes" var; session'da görünmüyor | Egzersiz ⋯ menüsü > "Note"; varsa kartta tek satır gri olarak görünsün | S | low-med |
| B12 | **Offline video durumu görünürlüğü** | — | Settings'te "21 / 1674 files" ve "All" / "S + A tier only" iyi | Session başlatırken, o antrenmanın videoları cihazda değilse küçük "Download for offline" ipucu | S | low-med |

Bilerek **eklemiyoruz** (owner kararı + sadelik): sosyal feed, RIR/RPE alanları, AI chat, gamification rozet duvarı.

---

## (c) Desktop / iPad'e özel layout iyileştirmeleri

### C1. Session logger desktop'ta "uzatılmış telefon"
- **Referans:** Apple split view, iPad'de 2–3 pane: sidebar | liste | detay ([HIG Split views](https://developer.apple.com/design/human-interface-guidelines/split-views)).
- **Biz:** `desktop-dl-session.png`: stepper'lar ≈500 px genişliğe uzamış, `−` ile `+` arası 470 px. Sağ tarafta boşluk var, egzersiz listesi ve rest timer görünmüyor.
- **Düzeltme:** ≥1100 px'te 2 kolon kullan. Solda egzersiz listesi (tamamlananlar ✓, aktif vurgulu, sürükle-bırak sırala); sağda aktif egzersiz kartı (input'lar max 140 px, klavyeden yazılabilir) ve altında rest timer + previous / history özeti.
  Klavye: `Enter` = set tamam, `Tab` = sonraki alan, `↑↓` = ±2.5 kg / ±1 rep.
- **Efor:** M · **Etki:** high (desktop / iPad kullanımı)

### C2. Exercise detayı iPad'de 2-pane değil, video letterbox'ı büyük
- **Biz:** `ipad-il-ex-video.png`: 820 px'te tek kolon, video alanı ekran genişliğinde ve iki yanı siyah. `desktop-dl-ex-video.png` (≥1000 px) iyi: list | detail.
- **Düzeltme:** ≥768 px'te detail içinde hero solda (≈45%), sağda başlık + meta + tabs. Ya da library 2-pane eşiğini 768 px'e indir (iPad portrait'te liste dar olabilir; landscape'te kesin 2-pane).
- **Efor:** M · **Etki:** med

### C3. Manifest `orientation: portrait`
- **Biz:** `app/manifest.webmanifest`. Kurulu PWA iPad / tablette yatay modu kilitliyor.
- **Düzeltme:** `orientation` alanını kaldır (ya da `any`). Ek olarak `screenshots` (wide + narrow) eklenmeli; bunlar Chrome'un zengin install arayüzünü açıyor ([web.dev capabilities](https://web.dev/learn/pwa/capabilities)).
- **Efor:** S · **Etki:** med

### C4. Home ve Body desktop'ta dengesiz boşluklar
- **Biz:** `desktop-dl-home.png`: sol kolon Rest timer'dan sonra bitiyor, altında ≈170 px boşluk var, sağ kolon daha uzun. `desktop-dk-body.png`: body figürü küçük, sayfanın alt yarısı boş; kas listesi sağ üstte sıkışık.
- **Düzeltme:** Home'da CSS grid `grid-auto-flow: dense` ya da kartları masonry-benzeri iki kolona dengeli dağıt (Recovery kartı sola). Body'de figür viewport yüksekliğine göre ölçeklensin (`height: calc(100vh - header)`); sağ panel seçili kasın detayını göstersin (liste → detay, Mail benzeri).
- **Efor:** S-M · **Etki:** med

### C5. Command palette (Cmd/Ctrl+K)
- **Referans:** Linear: Cmd+K tüm sayfa ve eylemler için tek giriş noktası; `?` ile kısayol listesi ([Linear navigating](https://linear.app/enablement/guides/navigating-linear)). Not: ~20'den az hedefte sidebar yeterli, ama 842 egzersiz araması için palette değerli.
- **Biz:** 1–5, `,`, `t`, `/` kısayolları var (`main.js`). Sidebar'da numara rozetleri iyi; Settings'in yanında görünen "," rozeti anlamsız duruyor (`desktop-dl-home.png`).
- **Düzeltme:** `Ctrl/Cmd+K` → egzersiz arama + "Start <workout>", "Rest 2:00", "Open settings". `?` → kısayol sheet'i. "," rozetini `⌘,` ya da gizli yap.
- **Efor:** M · **Etki:** med (power user)

### C6. Hover / focus durumları
- **Düzeltme:** Desktop'ta tüm kart ve satırlara `:hover` (hafif zemin) ve `:focus-visible` (2 px accent outline, 3:1). WCAG 2.4.7 / 2.4.11 (Focus Not Obscured, 2.2'de yeni): sticky header ve FAB odaklanan elemanı örtmemeli.
- **Efor:** S · **Etki:** med

---

## (d) Referanslardan daha iyi yaptıklarımız (koru)

1. **Jeff Nippard S/A/B/C tier'ları + "#3 of 87 quads exercises" sıralaması + in-app tier video embed** (`phone-pl-ex-rank.png`). Hevy, Strong ve JEFIT'te seçim kalitesine dair böyle bir küratörlük yok; MuscleWiki yalnızca difficulty/equipment filtresi sunuyor ([MuscleWiki review](https://webiano.digital/musclewiki-is-the-gym-shortcut-the-web-was-missing/)).
2. **Equipment variant chips** (Machine / Smith / Barbell / Dumbbell / Bodyweight, "similar" ile). Makine doluyken anında alternatif. Fitbod'un otomatik swap'ından daha şeffaf.
3. **Joint-care / pain flag + timed joint warm-up**. Referansların hiçbirinde bu kadar entegre değil.
4. **Otomatik warm-up önerisi session başında** ("About 6 min, made for this workout"). Strong'da yalnızca warm-up set calculator var ([Strong App Store](https://apps.apple.com/gb/app/id464254577)).
5. **Video | Muscles | 3D hero** ve "Targets: Vastus lateralis". MuscleWiki'nin güçlü yanını (body map + video) tek ekranda birleştiriyor.
6. **Body map + Recovery + This week** tek ekranda ve 842 egzersize bağlı. Fitbod'un recovery heat map'iyle aynı seviyede ([Fitbod](https://fitbod.me/blog/muscle-recovery/)) ve ücretsiz.
7. **Tamamen offline + veri cihazda + seçmeli video indirme** (S + A tier only). Hevy/Strong hesap ve sunucu gerektiriyor.
8. **Sade tipografi ve büyük, okunaklı metin** (how-to adımları 17–18 pt). Light ve dark'ta metin kontrastı AA'yı geçiyor (t2 6.19:1, dark t2 7.59:1).
9. **Plateau auto-adjust + weekly muscle balance uyarısı** ("Low volume this week"). Alpha Progression'ın ücretli özelliklerine yakın, ücretsiz.
10. **Strength standards bodyweight'e göre**. Strength Level benzeri ([Strength Level](https://strengthlevel.com/strength-standards)) ama uygulama içinde ve offline.

---

## Uygulama sırası önerisi (2–3 blok / oturum kuralına uygun)

- **Blok A (S, hızlı kazanımlar):** A2 header blur, A3 kontrol kenarlıkları + accent-text, A4 Auto tema, A5 mannequin zemin, A7 CTA padding, C3 manifest, A13 slug kontrolü.
- **Blok B (session hızı):** A1 Previous sütunu + 44 px stepper, B5 hedef satırı, B4 rest picker, B3 inline plates.
- **Blok C (arka plan timer + history):** B2 notification + Media Session, B1 Stats → History.
- **Blok D (desktop / iPad):** C1 2-kolon session + klavye, C2 iPad 2-pane, C4 grid dengesi, C5 Cmd+K, C6 focus.
- **Blok E:** B6 CSV, B9 shortcuts, A10/A11/A12 empty state ve splash.

---

## Kaynaklar

- Hevy — Features guide: https://help.hevyapp.com/hc/en-us/articles/33106320824727
- Hevy — Live Activity: https://www.hevyapp.com/features/live-activity/ · https://help.hevyapp.com/hc/en-us/articles/35649846517399
- Hevy — Rest timer: https://www.hevyapp.com/features/workout-rest-timer/
- Hevy — Previous values: https://help.hevyapp.com/hc/en-us/articles/36011896355479
- Hevy — Exercise library / history: https://help.hevyapp.com/hc/en-us/articles/35382889578135
- Hevy — Routines: https://www.hevyapp.com/features/gym-workout-routines/
- Hevy — Import/Export CSV: https://help.hevyapp.com/hc/en-us/articles/38001424401943
- Strong — App Store: https://apps.apple.com/gb/app/id464254577
- Fitbod — Muscle recovery: https://fitbod.me/blog/muscle-recovery/ · TechRadar review: https://www.techradar.com/health-fitness/fitbod-app-review
- JEFIT — Play Store: https://play.google.com/store/apps/details?id=je.fit · Trustpilot: https://trustpilot.com/review/jefit.com
- Alpha Progression — Guide: https://alphaprogression.com/en/blog/alpha-progression-guide · App Store: https://apps.apple.com/us/app/gym-workout-alpha-progression/id1462277793
- Ladder — Garage Gym Reviews: https://www.garagegymreviews.com/ladder-app-review
- MuscleWiki — https://musclewiki.com/exercises · review: https://webiano.digital/musclewiki-is-the-gym-shortcut-the-web-was-missing/
- Strength Level — https://strengthlevel.com/strength-standards
- Linear — Navigating Linear: https://linear.app/enablement/guides/navigating-linear
- Apple HIG — Split views: https://developer.apple.com/design/human-interface-guidelines/split-views · Sidebars: https://developer.apple.com/design/human-interface-guidelines/sidebars · Dark Mode: https://developer.apple.com/design/human-interface-guidelines/dark-mode · Materials: https://developer.apple.com/design/human-interface-guidelines/materials · Launching: https://developer.apple.com/design/human-interface-guidelines/launching
- Tap target (Apple 44 pt özeti): https://app.uxcel.com/courses/mobile-design/ios-app-design-712/minimum-tap-target-size-8996
- Material / Android touch target 48 dp: https://support.google.com/accessibility/android/answer/7101858 · M3 FAB: https://m3.material.io/components/floating-action-button/guidelines
- WCAG 1.4.11 Non-text Contrast: https://w3c.github.io/wcag21/understanding/non-text-contrast
- PWA capabilities (Wake Lock, Push, shortcuts): https://web.dev/learn/pwa/capabilities · iOS PWA notes: https://firt.dev/notes/pwa-ios/

Not: Bazı özellik iddiaları (ör. Strong Apple Health'in ücretli olup olmadığı, Hevy web'in desktop özellikleri) üçüncü taraf kaynaklarda çelişkili; raporda bunlara dayanan bir öneri yok.
