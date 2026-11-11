# TO DO List

Volta Motor iş takip uygulaması. Açık kaynak [Plane](https://github.com/makeplane/plane) Community Edition üzerine kuruludur.

## Kaynak

- **Temel alınan kod:** `makeplane/plane`, commit `ea63ca8ab6f2c887c70ebbf166b78783600cf14e` (11.11.2026).
- **Aktarımda dışarıda bırakılanlar:** `.github/` (Plane'in kendi CI ve şablonları), `.claude/` ve `CODEOWNERS`. Geri kalan dosyalar değiştirilmeden alınmıştır.
- Plane'in özgün tanıtım dosyası `PLANE_README.md` olarak saklanmıştır.

## Lisans

Kod GNU AGPL-3.0 lisansı altındadır; bkz. `LICENSE.txt` ve `COPYRIGHT.txt`. Plane'e ait telif ve lisans bildirimleri korunmalıdır.

## Planlanan değişiklikler

1. Uygulama adı ve Volta görünümü
2. Zitadel ile giriş (OIDC)
3. Genel board: tüm projelerin işleri tek board'da, kartta proje etiketi
4. İş türleri ve Azure Boards tarzı alanlar (kabul kriterleri vb.)
5. Faaliyet raporları ekranı

## Çalıştırma

Kurulum adımları için şimdilik `PLANE_README.md` ve `deployments/` klasörüne bakın. Servisler `docker-compose.yml` içinde tanımlıdır.
