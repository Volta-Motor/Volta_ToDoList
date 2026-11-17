# TO DO List

Volta Motor iş takip uygulaması. Açık kaynak [Plane](https://github.com/makeplane/plane) Community Edition üzerine kuruludur.

## Kaynak

- **Temel alınan kod:** `makeplane/plane`, commit `ea63ca8ab6f2c887c70ebbf166b78783600cf14e` (11.11.2026).
- **Aktarımda dışarıda bırakılanlar:** `.github/` (Plane'in kendi CI ve şablonları), `.claude/` ve `CODEOWNERS`. Geri kalan dosyalar değiştirilmeden alınmıştır.
- Plane'in özgün tanıtım dosyası `PLANE_README.md` olarak saklanmıştır.

## Lisans

Kod GNU AGPL-3.0 lisansı altındadır; bkz. `LICENSE.txt` ve `COPYRIGHT.txt`. Plane'e ait telif ve lisans bildirimleri korunmalıdır.

## Plane'e eklenenler

1. Uygulama adı, Volta logosu ve renkleri
2. Zitadel ile giriş (OIDC); kurulum için `docs/zitadel-giris.md`
3. Genel board: tüm projelerin işleri tek board'da, kartta proje etiketi ve iş türü
4. İş türleri (Görev, Hata, Kullanıcı hikâyesi, Özellik); iş öğelerinde kabul kriterleri ve test kriterleri listeleri
5. Story point: her projede Fibonacci (1, 2, 3, 5, 8, 13, 21) puan sistemi kendiliğinden tanımlı; kartta, sütun toplamında ve raporda görünür
6. Faaliyet raporları ekranı: seçilen ayda tamamlanan ve devam eden işler, proje bazında
7. Otomatik proje üyeliği: çalışma alanının yönetici ve üyeleri bütün projelerin üyesidir; kişiyi yalnızca çalışma alanına davet etmek yeterlidir
8. "Danışmanda" sütunu: her projede Devam ediyor ile Tamamlandı arasında ayrı bir durum
9. Proje tahtası: her projenin kendi tahtası (kenar çubuğunda proje altında "Tahta"); genel board hepsini birlikte gösterir
10. Yöneticinin üyeye geçici parola ataması (Çalışma alanı ayarları → Üyeler)

Plane'de bulunmayan arka uç eklemeleri `apps/api/plane/todolist` uygulamasında durur; kendi migration'ları vardır ve Plane'in migration zinciriyle çakışmaz.

## Çalıştırma

Kurulum dosyaları `deployments/volta` klasöründedir; imajlar bu depodaki koddan derlenir.

```bash
cd deployments/volta
./hazirla.sh
docker compose up -d --build
```

Uygulama `http://localhost:9300` adresinde açılır.

Yerelde deneme, sunucuya kurulum, güncelleme ve yedekleme adımları `docs/devreye-alma.md` belgesindedir.
