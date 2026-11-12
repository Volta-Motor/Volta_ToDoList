# Devreye alma

TO DO List, Plane ile aynı servislerden oluşur ve Docker Compose ile çalışır. Kurulum dosyaları `deployments/volta` klasöründedir. Buradaki `docker-compose.yml`, Plane'in resmî kurulum dosyasından türetilmiştir; tek farkı hazır Plane imajları yerine imajları **bu depodaki koddan derlemesidir**. Zitadel girişi, genel board, faaliyet raporları ve diğer eklemeler yalnızca bu kodda vardır.

> Uygulamaların üretim derlemesi geliştirme ortamında doğrulandı, Docker imajlarının derlenmesi ise orada denenemedi. Canlıya almadan önce aşağıdaki yerel denemeyi yapın.

## Gerekenler

- Docker ve Docker Compose eklentisi. Windows ve macOS'ta Docker Desktop; Windows'ta komutlar için Git Bash (Git for Windows ile gelir) ya da WSL.
- En az 4 GB boş bellek; derleme sırasında 8 GB rahat eder. İlk derleme internet hızına göre 10–30 dakika sürebilir.
- Sunucu kurulumu için: sunucuya yönlenen bir alan adı ve Zitadel'de açılmış bir uygulama (bkz. [zitadel-giris.md](zitadel-giris.md)).

## Yerelde deneme

```bash
git clone https://github.com/Volta-Motor/Volta_ToDoList.git
cd Volta_ToDoList/deployments/volta
./hazirla.sh
docker compose up -d --build
```

`hazirla.sh`, `ornek.env` dosyasından `.env` üretir; veritabanı parolasını ve gizli anahtarları rastgele doldurur. Derleme bitince:

```bash
docker compose ps                  # migrator "exited (0)", diğerleri "running" olmalı
docker compose logs -f migrator    # veritabanı kurulumunu izlemek için
```

Sonra tarayıcıda `http://localhost/god-mode` adresini açıp ilk yönetici hesabını oluşturun, ardından `http://localhost` adresinden uygulamaya girin.

80 numaralı port doluysa (Windows'ta IIS, başka bir web sunucusu vb.) adresi portuyla verin:

```bash
./hazirla.sh http://localhost:8080
```

Denemeyi kapatmak için `docker compose down`, verileri de silmek için `docker compose down -v`.

## Sunucuya kurulum

1. Depoyu sunucuya alın ve ayarları hazırlayın. Adres, kullanıcıların tarayıcıya yazacağı adrestir:

   ```bash
   git clone https://github.com/Volta-Motor/Volta_ToDoList.git
   cd Volta_ToDoList/deployments/volta
   ./hazirla.sh https://todo.sirketiniz.com
   ```

2. HTTPS'i ayarlayın (aşağıdaki bölüm), sonra başlatın:

   ```bash
   docker compose up -d --build
   ```

3. `https://todo.sirketiniz.com/god-mode` adresinde ilk yönetici hesabını oluşturun.

4. Aynı panelde **Authentication → OpenID Connect** bölümünden Zitadel bilgilerini girip girişi etkinleştirin. Zitadel'deki yönlendirme adresi `https://todo.sirketiniz.com/auth/oidc/callback/` olmalıdır. Ayrıntılar: [zitadel-giris.md](zitadel-giris.md). İstemci bilgilerini depoya ya da `.env` dosyasına yazmanız gerekmez.

5. Uygulamaya girin, çalışma alanını açın, projeleri tanımlayın ve ekip üyelerini davet edin.

`.env` dosyasını saklayın ve depoya göndermeyin. İçindeki parolalar veritabanıyla eşleşir; dosya kaybolur ya da yeniden üretilirse kurulu sistem veritabanına bağlanamaz. `hazirla.sh` bu yüzden var olan `.env` dosyasına dokunmaz.

## HTTPS

İki yol var; ikisi de `deployments/volta/.env` içinde ayarlanır:

- **Şirketin kendi ters vekili (nginx, Traefik vb.) varsa:** Sertifikayı o sonlandırır. `LISTEN_HTTP_PORT` değerini boş bir porta (örneğin `8085`) alın ve vekilinizi bu porta yönlendirin. WebSocket yükseltmesine (`/live`) izin verin. Önde bir vekil daha olduğu için `NUM_PROXIES=2` verin.
- **Yoksa:** Kurulumdaki `proxy` servisi (Caddy) sertifikayı kendisi alabilir. `SITE_ADDRESS=todo.sirketiniz.com` ve `CERT_EMAIL="email <adres>"` değerlerini verin; 80 ve 443 portları internetten erişilebilir olmalıdır.

## Mevcut Plane kurulumuyla aynı sunucuda çalıştırma

Kurulum `todolist` proje adıyla çalışır; konteyner ve veri birimi adları Plane'inkilerle karışmaz. Çakışan tek şey portlardır: `.env` içinde `LISTEN_HTTP_PORT` ve `LISTEN_HTTPS_PORT` değerlerini Plane'in kullanmadığı portlara alın.

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
| `proxy`                   | Dışarıya açılan tek servis; istekleri diğerlerine dağıtır   |

## Veritabanı

Veritabanı boş başlar; `migrator` servisi tabloları kendisi kurar. Plane'in tablolarına ek olarak kabul kriterleri için `issue_acceptance_criteria` tablosu oluşur (`plane.todolist` uygulaması). İş türleri (Görev, Hata, Kullanıcı hikâyesi, Özellik) her çalışma alanında ilk kullanımda kendiliğinden tanımlanır.

## Güncelleme

```bash
cd Volta_ToDoList
git pull
cd deployments/volta
docker compose up -d --build
```

`migrator` her başlatmada bekleyen şema değişikliklerini uygular. Güncellemeden önce yedek alın.

## Yedekleme

Kalıcı veri iki yerdedir: veritabanı (`todolist_pgdata`) ve dosya ekleri (`todolist_uploads`). Komutlar `deployments/volta` klasöründe çalıştırılır.

```bash
# Veritabanı
docker compose exec -T plane-db pg_dump -U plane plane | gzip > todolist-$(date +%F).sql.gz

# Dosya ekleri
docker run --rm -v todolist_uploads:/data -v "$PWD":/yedek alpine \
  tar czf /yedek/uploads-$(date +%F).tar.gz -C /data .
```

`.env` dosyasını da yedeğe ekleyin. Yedekleri sunucunun dışında saklayın ve geri yüklemeyi en az bir kez deneyin.

## Sorun giderme

| Belirti                               | Bakılacak yer                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| Derleme yarıda kesiliyor              | Docker'a ayrılan bellek (Docker Desktop → Settings → Resources); en az 6–8 GB verin      |
| "port is already allocated"           | Port dolu; `.env` içinde `LISTEN_HTTP_PORT`/`LISTEN_HTTPS_PORT` ve `WEB_URL` değerleri   |
| Sayfa açılıyor, giriş yapılamıyor     | `.env` içindeki `WEB_URL` ve `CORS_ALLOWED_ORIGINS` tarayıcıdaki adresle birebir aynı mı |
| Zitadel'den dönüşte hata              | Yönlendirme adresi ve Issuer URL; kullanıcının e-postası Zitadel'de doğrulanmış mı       |
| `api` sürekli yeniden başlıyor        | `docker compose logs api` ve `docker compose logs migrator`                              |
| Dosya eklenemiyor                     | `docker compose logs plane-minio`; `.env` içindeki depolama anahtarları değişmiş mi      |
| Bildirim/etkinlik kayıtları oluşmuyor | `docker compose logs worker` ve `docker compose logs plane-mq`                           |

Kök dizindeki `docker-compose.yml` ve `setup.sh` Plane'in geliştirme amaçlı dosyalarıdır; kurulum için `deployments/volta` kullanılır.
