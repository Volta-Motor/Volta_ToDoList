#!/usr/bin/env bash
# TO DO List kurulumu için .env dosyasını hazırlar.
#
#   ./hazirla.sh                           -> http://localhost (port 80)
#   ./hazirla.sh http://localhost:8080     -> yerelde başka bir port
#   ./hazirla.sh https://todo.sirket.com   -> sunucu; HTTPS için docs/devreye-alma.md
#
# Var olan .env dosyasına dokunmaz: içindeki parolalar veritabanıyla eşleşir,
# yeniden üretilirse kurulu sistem veritabanına bağlanamaz.
set -euo pipefail

cd "$(dirname "$0")"

if [ -f .env ]; then
  echo ".env zaten var; değiştirilmedi. Sıfırdan başlamak için önce silin (veriler de sıfırlanacaksa: docker compose down -v)."
  exit 0
fi

address="${1:-http://localhost}"
address="${address%/}"
case "$address" in
  http://* | https://*) ;;
  *)
    echo "Adres http:// ya da https:// ile başlamalı: $address" >&2
    exit 1
    ;;
esac

scheme="${address%%://*}"
host_port="${address#*://}"
port=""
case "$host_port" in
  *:*) port="${host_port##*:}" ;;
esac

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

cp ornek.env .env

db_password="$(random 32)"
mq_password="$(random 32)"

set_value WEB_URL "$address"
set_value CORS_ALLOWED_ORIGINS "$address"
set_value POSTGRES_PASSWORD "$db_password"
set_value DATABASE_URL "postgresql://plane:${db_password}@plane-db/plane"
set_value RABBITMQ_PASSWORD "$mq_password"
set_value AMQP_URL "amqp://plane:${mq_password}@plane-mq:5672/plane"
set_value SECRET_KEY "$(random 50)"
set_value LIVE_SERVER_SECRET_KEY "$(random 40)"
set_value AWS_ACCESS_KEY_ID "$(random 20)"
set_value AWS_SECRET_ACCESS_KEY "$(random 40)"

if [ "$scheme" = "http" ] && [ -n "$port" ]; then
  # Yerelde başka port: 443 de çoğunlukla doludur, onu da yanına taşı.
  set_value LISTEN_HTTP_PORT "$port"
  set_value LISTEN_HTTPS_PORT "$((port + 363))"
fi

echo ".env hazır. Adres: $address"
echo "Başlatmak için:  docker compose up -d --build"
if [ "$scheme" = "https" ]; then
  echo "HTTPS için SITE_ADDRESS ve CERT_EMAIL ayarlarına bakın: docs/devreye-alma.md"
fi
