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

Sonra tarayıcıda `http://localhost:9300/god-mode` adresini açıp ilk yönetici hesabını oluşturun, ardından `http://localhost:9300` adresinden uygulamaya girin.

Uygulama varsayılan olarak **9300** portunda çalışır. Port doluysa ya da başka bir port isterseniz adresi portuyla verin:

```bash
./hazirla.sh http://localhost:8080
```

Denemeyi kapatmak için `docker compose down`, verileri de silmek için `docker compose down -v`.

## Sunucuya kurulum

1. Depoyu sunucuya alın ve ayarları hazırlayın. Adres, kullanıcıların tarayıcıya yazacağı adrestir; sunucunun adı ya da IP'si ve port:

   ```bash
   git clone https://github.com/Volta-Motor/Volta_ToDoList.git
   cd Volta_ToDoList/deployments/volta
   ./hazirla.sh http://sunucu-adresi:9300
   ```

   Sunucunun güvenlik duvarında 9300 portunu şirket ağına açın. Uygulamayı bir alan adıyla ve HTTPS ile yayınlayacaksanız aşağıdaki HTTPS bölümüne bakın.

2. Başlatın:

   ```bash
   docker compose up -d --build
   ```

3. `http://sunucu-adresi:9300/god-mode` adresinde ilk yönetici hesabını oluşturun.

4. Aynı panelde **Authentication → OpenID Connect** bölümünden Zitadel bilgilerini girip girişi etkinleştirin. Zitadel'deki yönlendirme adresi, uygulama adresinin sonuna `/auth/oidc/callback/` eklenmiş hâlidir: `http://sunucu-adresi:9300/auth/oidc/callback/`. Adres `https` değilse Zitadel uygulamasında "Development Mode" açık olmalıdır. Ayrıntılar: [zitadel-giris.md](zitadel-giris.md). İstemci bilgilerini depoya ya da `.env` dosyasına yazmanız gerekmez.

5. Uygulamaya girin, çalışma alanını açın, projeleri tanımlayın ve ekip üyelerini davet edin.

`.env` dosyasını saklayın ve depoya göndermeyin. İçindeki parolalar veritabanıyla eşleşir; dosya kaybolur ya da yeniden üretilirse kurulu sistem veritabanına bağlanamaz. `hazirla.sh` bu yüzden var olan `.env` dosyasındaki parolalara ve anahtarlara dokunmaz.

### Adresi ya da portu sonradan değiştirme

`.env` varken betiğe yeni adresi verin; yalnızca adres ve port satırları güncellenir:

```bash
./hazirla.sh http://sunucu-adresi:9300
docker compose up -d
```

Adres değişince Zitadel'deki yönlendirme adresini de güncelleyin.

## HTTPS

İki yol var:

- **Şirketin kendi ters vekili (nginx, Traefik vb.) varsa:** Sertifikayı o sonlandırır. `./hazirla.sh https://todo.sirketiniz.com` çalıştırın; uygulama yine 9300 portunda dinler, vekilinizi bu porta yönlendirin. WebSocket yükseltmesine (`/live`) izin verin. Önde bir vekil daha olduğu için `.env` içinde `NUM_PROXIES=2` verin.
- **Yoksa:** Kurulumdaki `proxy` servisi (Caddy) sertifikayı kendisi alabilir. `.env` içinde `SITE_ADDRESS=todo.sirketiniz.com`, `CERT_EMAIL="email <adres>"`, `LISTEN_HTTP_PORT=80` ve `LISTEN_HTTPS_PORT=443` verin; 80 ve 443 portları internetten erişilebilir olmalıdır.

## Mevcut Plane kurulumuyla aynı sunucuda çalıştırma

Kurulum `todolist` proje adıyla çalışır; konteyner ve veri birimi adları Plane'inkilerle karışmaz. Portlar da varsayılan olarak 9300 ve 9343 olduğu için Plane'in 80/443 portlarıyla çakışmaz.

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

Veritabanı boş başlar; `migrator` servisi tabloları kendisi kurar. Plane'in tablolarına ek olarak kabul ve test kriterleri için `issue_acceptance_criteria` tablosu oluşur (`plane.todolist` uygulaması). İş türleri (Görev, Hata, Kullanıcı hikâyesi, Özellik) her çalışma alanında ilk kullanımda kendiliğinden tanımlanır. Her yeni proje Fibonacci story point sistemiyle açılır; var olan projelere güncelleme sırasında `migrator` ekler.

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

| Belirti                                                                 | Bakılacak yer                                                                            |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Derleme yarıda kesiliyor                                                | Docker'a ayrılan bellek (Docker Desktop → Settings → Resources); en az 6–8 GB verin      |
| "port is already allocated"                                             | Port dolu; `.env` içinde `LISTEN_HTTP_PORT`/`LISTEN_HTTPS_PORT` ve `WEB_URL` değerleri   |
| Arayüzde metin yerine anahtarlar görünüyor (`general_board.title` gibi) | Eski bir derleme; `git pull` sonrası `docker compose up -d --build` ile yeniden derleyin |
| Sayfa açılıyor, giriş yapılamıyor                                       | `.env` içindeki `WEB_URL` ve `CORS_ALLOWED_ORIGINS` tarayıcıdaki adresle birebir aynı mı |
| Zitadel'den dönüşte hata                                                | Yönlendirme adresi ve Issuer URL; kullanıcının e-postası Zitadel'de doğrulanmış mı       |
| `api` sürekli yeniden başlıyor                                          | `docker compose logs api` ve `docker compose logs migrator`                              |
| Dosya eklenemiyor                                                       | `docker compose logs plane-minio`; `.env` içindeki depolama anahtarları değişmiş mi      |
| Bildirim/etkinlik kayıtları oluşmuyor                                   | `docker compose logs worker` ve `docker compose logs plane-mq`                           |

Kök dizindeki `docker-compose.yml` ve `setup.sh` Plane'in geliştirme amaçlı dosyalarıdır; kurulum için `deployments/volta` kullanılır.
