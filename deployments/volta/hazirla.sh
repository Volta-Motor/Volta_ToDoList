#!/usr/bin/env bash
# TO DO List kurulumu için .env dosyasını hazırlar.
#
#   ./hazirla.sh                             -> http://localhost:9300
#   ./hazirla.sh http://10.0.0.25:9300       -> sunucu, IP ve portla
#   ./hazirla.sh https://todo.sirket.com     -> sunucu, önde HTTPS sonlandıran bir vekille
#
# Uygulama varsayılan olarak 9300 portunda dinler. Adreste başka bir port
# yazıyorsa o port kullanılır.
#
# .env zaten varsa parolalara ve anahtarlara dokunulmaz (veritabanıyla
# eşleşirler; yeniden üretilirse kurulu sistem veritabanına bağlanamaz).
# Adres verilirse yalnızca adres ve port satırları güncellenir.
set -euo pipefail

cd "$(dirname "$0")"

DEFAULT_PORT=9300

address="${1:-}"
address="${address%/}"
if [ -n "$address" ]; then
  case "$address" in
    http://* | https://*) ;;
    *)
      echo "Adres http:// ya da https:// ile başlamalı: $address" >&2
      exit 1
      ;;
  esac
fi

if [ -f .env ] && [ -z "$address" ]; then
  echo ".env zaten var; değiştirilmedi."
  echo "Yalnızca adresi ya da portu değiştirmek için:  ./hazirla.sh http://adres:port"
  echo "Sıfırdan başlamak için .env dosyasını silin (veriler de sıfırlanacaksa: docker compose down -v)."
  exit 0
fi

address="${address:-http://localhost:${DEFAULT_PORT}}"
scheme="${address%%://*}"
host_port="${address#*://}"

# Bilgisayarda/sunucuda dinlenecek port:
#   adreste port varsa o; http://ad (portsuz) ise 80;
#   https://ad ise öndeki vekilin yönleneceği varsayılan port.
case "$host_port" in
  *:*) listen_port="${host_port##*:}" ;;
  *) if [ "$scheme" = "http" ]; then listen_port=80; else listen_port="$DEFAULT_PORT"; fi ;;
esac
case "$listen_port" in
  '' | *[!0-9]*)
    echo "Port sayı olmalı: $address" >&2
    exit 1
    ;;
esac
# Kurulumdaki vekilin 443 portu da bilgisayara açılır; 80/443 çifti dışında
# çakışmasın diye HTTP portunun 43 fazlasına alınır (9300 -> 9343).
if [ "$listen_port" = "80" ]; then https_port=443; else https_port="$((listen_port + 43))"; fi

random() {
  # $1 uzunluğunda harf ve rakamdan oluşan rastgele değer (URL içinde güvenle kullanılır).
  LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "$1" || true
}

set_value() {
  # $1=ANAHTAR $2=değer : .env içindeki satırı değiştirir.
  local tmp
  tmp="$(mktemp)"
  awk -v key="$1" -v value="$2" 'BEGIN { FS = OFS = "=" } $1 == key { print key, value; next } { print }' .env > "$tmp"
  cat "$tmp" > .env
  rm -f "$tmp"
}

set_address() {
  set_value WEB_URL "$address"
  set_value CORS_ALLOWED_ORIGINS "$address"
  set_value LISTEN_HTTP_PORT "$listen_port"
  set_value LISTEN_HTTPS_PORT "$https_port"
}

if [ -f .env ]; then
  set_address
  echo ".env güncellendi (parolalar ve anahtarlar aynı kaldı). Adres: $address, port: $listen_port"
  echo "Uygulamak için:  docker compose up -d"
else
  # Windows'ta dosya CRLF satır sonlarıyla inebilir; .env her zaman LF ile yazılır.
  tr -d '\r' < ornek.env > .env

  db_password="$(random 32)"
  mq_password="$(random 32)"

  set_address
  set_value POSTGRES_PASSWORD "$db_password"
  set_value DATABASE_URL "postgresql://plane:${db_password}@plane-db/plane"
  set_value RABBITMQ_PASSWORD "$mq_password"
  set_value AMQP_URL "amqp://plane:${mq_password}@plane-mq:5672/plane"
  set_value SECRET_KEY "$(random 50)"
  set_value LIVE_SERVER_SECRET_KEY "$(random 40)"
  set_value AWS_ACCESS_KEY_ID "$(random 20)"
  set_value AWS_SECRET_ACCESS_KEY "$(random 40)"

  echo ".env hazır. Adres: $address, port: $listen_port"
  echo "Başlatmak için:  docker compose up -d --build"
fi

if [ "$scheme" = "https" ]; then
  echo "HTTPS: öndeki vekili $listen_port portuna yönlendirin. Ayrıntı: docs/devreye-alma.md"
fi
