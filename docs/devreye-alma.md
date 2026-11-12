# Devreye alma

TO DO List, Plane ile aynı servislerden oluşur ve Docker Compose ile çalışır. Depodaki `docker-compose.yml` bütün imajları kaynak koddan derler; hazır Plane imajları **kullanılmaz**, çünkü Zitadel girişi, genel board, faaliyet raporları ve diğer eklemeler yalnızca bu depodaki kodda vardır.

> Bu belgedeki adımlar Plane'in kendi kurulum dosyalarına dayanır. İmaj derlemesi geliştirme ortamında denenemedi; ilk kurulumu canlıya almadan önce bir deneme sunucusunda yapın.

## Gerekenler

- Docker ve Docker Compose eklentisi kurulu bir Linux sunucu (en az 4 GB bellek; derleme sırasında 8 GB rahat eder)
- Sunucuya yönlenen bir alan adı, örneğin `todo.sirketiniz.com`
- Zitadel'de açılmış bir uygulama (bkz. [zitadel-giris.md](zitadel-giris.md))

## Servisler

| Servis                    | Görevi                                                      |
| ------------------------- | ----------------------------------------------------------- |
| `web`, `admin`, `space`   | Arayüz, yönetim paneli (`/god-mode`), herkese açık sayfalar |
| `api`                     | Arka uç                                                     |
| `worker`, `beat-worker`   | Arka plan işleri ve zamanlanmış işler                       |
| `migrator`                | Veritabanı şemasını kurar/günceller, işi bitince kapanır    |
| `live`                    | Sayfalarda eş zamanlı düzenleme                             |
| `plane-db`                | PostgreSQL                                                  |
| `plane-redis`, `plane-mq` | Önbellek ve iş kuyruğu                                      |
| `plane-minio`             | Dosya ekleri                                                |
| `proxy`                   | 80/443 portlarını dinleyen ters vekil                       |

## İlk kurulum

1. Depoyu sunucuya alın:

   ```bash
   git clone https://github.com/Volta-Motor/Volta_ToDoList.git
   cd Volta_ToDoList
   ```

2. Ortam dosyalarını oluşturun. `setup.sh` örnek dosyaları kopyalar, `SECRET_KEY` ve dosya deposu anahtarlarını rastgele üretir. Betiğin sonundaki `pnpm install` adımı yalnızca geliştirme içindir; sunucuda Node kurulu değilse o adımın hata vermesi kurulumu etkilemez.

   ```bash
   ./setup.sh
   ```

3. Kök dizindeki `.env` ve `apps/api/.env` dosyalarını düzenleyin. Parolalar iki dosyada **aynı** olmalıdır.

   | Dosya           | Değişken                                                            | Değer                                                    |
   | --------------- | ------------------------------------------------------------------- | -------------------------------------------------------- |
   | ikisi de        | `POSTGRES_PASSWORD`, `RABBITMQ_PASSWORD`                            | Güçlü, size özel parolalar (varsayılan `plane` kalmasın) |
   | `apps/api/.env` | `WEB_URL`                                                           | `https://todo.sirketiniz.com`                            |
   | `apps/api/.env` | `CORS_ALLOWED_ORIGINS`                                              | `https://todo.sirketiniz.com`                            |
   | `apps/api/.env` | `APP_BASE_URL`, `ADMIN_BASE_URL`, `SPACE_BASE_URL`, `LIVE_BASE_URL` | `https://todo.sirketiniz.com`                            |
   | `apps/api/.env` | `LIVE_SERVER_SECRET_KEY`                                            | Rastgele bir değer                                       |
   | `apps/api/.env` | `USE_MINIO`                                                         | `1`                                                      |
   | `apps/api/.env` | `AWS_S3_ENDPOINT_URL`                                               | `http://plane-minio:9000`                                |
   | `apps/api/.env` | `DEBUG`                                                             | `0`                                                      |
   | `.env`          | `LISTEN_HTTP_PORT`, `LISTEN_HTTPS_PORT`                             | Vekilin dinleyeceği portlar (varsayılan 80 ve 443)       |

   Zitadel istemci bilgilerini bu dosyalara yazmak zorunda değilsiniz; 6. adımda yönetim panelinden girilir. Hiçbir `.env` dosyasını depoya göndermeyin.

4. Derleyin ve başlatın. İlk derleme uzun sürer.

   ```bash
   docker compose up -d --build
   docker compose logs -f migrator   # "migrate" bitene kadar izleyin
   docker compose ps
   ```

5. Tarayıcıda `https://todo.sirketiniz.com/god-mode` adresini açın ve ilk yönetici hesabını oluşturun.

6. Aynı panelde **Authentication → OpenID Connect** bölümünden Zitadel bilgilerini girip girişi etkinleştirin. Zitadel'deki yönlendirme adresi `https://todo.sirketiniz.com/auth/oidc/callback/` olmalıdır. Ayrıntılar: [zitadel-giris.md](zitadel-giris.md).

7. Uygulamaya girin, çalışma alanını açın, projeleri tanımlayın ve ekip üyelerini davet edin.

## HTTPS

İki yol var:

- **Şirketin kendi ters vekili (nginx, Traefik vb.) varsa:** Sertifikayı o sonlandırır. `LISTEN_HTTP_PORT` değerini boş bir porta (örneğin `8085`) alın ve vekilinizi bu porta yönlendirin. WebSocket yükseltmesine (`/live`) izin verin.
- **Yoksa:** `proxy` servisi (Caddy) sertifikayı kendisi alabilir. Kök `.env` dosyasında `SITE_ADDRESS=todo.sirketiniz.com` ve `CERT_EMAIL="email <adres>"` değerlerini verin; 80 ve 443 portları internetten erişilebilir olmalıdır.

## Mevcut Plane kurulumuyla aynı sunucuda çalıştırma

Aynı sunucuda Plane zaten çalışıyorsa üç şey çakışır:

- **Portlar:** `LISTEN_HTTP_PORT` ve `LISTEN_HTTPS_PORT` değerlerini değiştirin.
- **Konteyner adları:** `docker-compose.yml` içinde sabit `container_name` değerleri var (`web`, `api`, `plane-db` …). Bu satırları silin ya da adların başına `todo-` ekleyin.
- **Proje adı:** Compose'u ayrı bir proje adıyla çalıştırın ki veri birimleri (volume) karışmasın: `docker compose -p todolist up -d --build`.

Ayrı bir sunucu kullanıyorsanız bunların hiçbiri gerekmez.

## Veritabanı

Veritabanı boş başlar; `migrator` servisi tabloları kendisi kurar. Plane'in tablolarına ek olarak kabul kriterleri için `issue_acceptance_criteria` tablosu oluşur (`plane.todolist` uygulaması). İş türleri (Görev, Hata, Kullanıcı hikâyesi, Özellik) her çalışma alanında ilk kullanımda kendiliğinden tanımlanır.

## Güncelleme

```bash
git pull
docker compose up -d --build
```

`migrator` her başlatmada bekleyen şema değişikliklerini uygular. Güncellemeden önce yedek alın.

## Yedekleme

Kalıcı veri iki yerdedir: veritabanı (`pgdata`) ve dosya ekleri (`uploads`).

```bash
# Veritabanı
docker compose exec -T plane-db pg_dump -U plane plane | gzip > todolist-$(date +%F).sql.gz

# Dosya ekleri
docker run --rm -v volta_todolist_uploads:/data -v "$PWD":/yedek alpine \
  tar czf /yedek/uploads-$(date +%F).tar.gz -C /data .
```

Birim adı (`volta_todolist_uploads`) klasör ya da proje adına göre değişir; `docker volume ls` ile doğrulayın. Yedekleri sunucunun dışında saklayın ve geri yüklemeyi en az bir kez deneyin.

## Sorun giderme

| Belirti                               | Bakılacak yer                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| Sayfa açılıyor, giriş yapılamıyor     | `apps/api/.env` içindeki `WEB_URL` ve `CORS_ALLOWED_ORIGINS` gerçek adresle aynı mı |
| Zitadel'den dönüşte hata              | Yönlendirme adresi ve Issuer URL; kullanıcının e-postası Zitadel'de doğrulanmış mı  |
| `api` sürekli yeniden başlıyor        | `docker compose logs api`; çoğunlukla parola uyuşmazlığı ya da eksik `SECRET_KEY`   |
| Dosya eklenemiyor                     | `USE_MINIO=1`, `AWS_S3_ENDPOINT_URL` ve iki dosyadaki depo anahtarları aynı mı      |
| Bildirim/etkinlik kayıtları oluşmuyor | `docker compose logs worker` ve `plane-mq`                                          |
