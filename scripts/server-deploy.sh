#!/usr/bin/env bash
set -euo pipefail

ARCHIVE="${1:-/tmp/saralash-deploy.tgz}"
PROD_ROOT=/opt/saralash-prod
DEV_ROOT=/opt/saralash-dev
PROD_PORT=3103
DEV_PORT=3104

echo "==> Extract sources"
mkdir -p "$PROD_ROOT" "$DEV_ROOT"
tar -xzf "$ARCHIVE" -C "$PROD_ROOT"
# prod .env larni dev ga ko‘chirmaslik — aks holda dev noto‘g‘ri bazaga ulanyapti
rsync -a --delete \
  --exclude 'backend/.env' \
  --exclude '.env' \
  "$PROD_ROOT/" "$DEV_ROOT/"

gen_secret() { openssl rand -hex 24; }

echo "==> PostgreSQL (new roles/DBs only; mavjud .env bo‘lsa parollar saqlanadi)"
need_prod_env=false
need_dev_env=false
[[ -f "$PROD_ROOT/backend/.env" ]] || need_prod_env=true
[[ -f "$DEV_ROOT/backend/.env" ]] || need_dev_env=true

PROD_DB_PASS=""
DEV_DB_PASS=""
JWT_ACCESS_PROD=""
JWT_REFRESH_PROD=""
JWT_ACCESS_DEV=""
JWT_REFRESH_DEV=""

if $need_prod_env; then
  PROD_DB_PASS="$(gen_secret)"
  JWT_ACCESS_PROD="$(gen_secret)"
  JWT_REFRESH_PROD="$(gen_secret)"
fi
if $need_dev_env; then
  DEV_DB_PASS="$(gen_secret)"
  JWT_ACCESS_DEV="$(gen_secret)"
  JWT_REFRESH_DEV="$(gen_secret)"
fi

if $need_prod_env || $need_dev_env; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'saralash_app_prod') THEN
    CREATE ROLE saralash_app_prod LOGIN PASSWORD '${PROD_DB_PASS}';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'saralash_app_dev') THEN
    CREATE ROLE saralash_app_dev LOGIN PASSWORD '${DEV_DB_PASS}';
  END IF;
END \$\$;
SQL
fi
sudo -u postgres createdb -O saralash_app_prod saralash_prod 2>/dev/null || true
sudo -u postgres createdb -O saralash_app_dev saralash_dev 2>/dev/null || true

write_backend_env() {
  local root="$1" port="$2" cors="$3" db_user="$4" db_pass="$5" db_name="$6" jwt_a="$7" jwt_r="$8"
  cat >"$root/backend/.env" <<ENV
PORT=${port}
CORS_ORIGIN=${cors}
DATABASE_URL=postgresql://${db_user}:${db_pass}@127.0.0.1:5432/${db_name}?schema=public
JWT_ACCESS_SECRET=${jwt_a}
JWT_REFRESH_SECRET=${jwt_r}
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
ENV
}

if $need_prod_env; then
  write_backend_env "$PROD_ROOT" "$PROD_PORT" "https://saralash.liderplast.uz" \
    saralash_app_prod "$PROD_DB_PASS" saralash_prod "$JWT_ACCESS_PROD" "$JWT_REFRESH_PROD"
else
  echo "==> Qo‘llanadi: mavjud $PROD_ROOT/backend/.env"
fi
if $need_dev_env; then
  write_backend_env "$DEV_ROOT" "$DEV_PORT" "https://dev.saralash.liderplast.uz" \
    saralash_app_dev "$DEV_DB_PASS" saralash_dev "$JWT_ACCESS_DEV" "$JWT_REFRESH_DEV"
else
  echo "==> Qo‘llanadi: mavjud $DEV_ROOT/backend/.env"
fi

deploy_env() {
  local root="$1" api_url="$2"
  echo "==> Deploy ${root}"
  cd "$root/backend"
  npm ci
  npx prisma generate
  npx prisma db push --accept-data-loss
  npm run prisma:seed || true
  npm run build

  cd "$root"
  echo "VITE_API_BASE_URL=${api_url}" > .env
  npm ci
  npm run build
  mkdir -p web/dist
  rsync -a dist/ web/dist/
}

deploy_env "$PROD_ROOT" "https://saralash.liderplast.uz/api"
deploy_env "$DEV_ROOT" "https://dev.saralash.liderplast.uz/api"

echo "==> PM2"
pm2 delete saralash-api-prod 2>/dev/null || true
pm2 delete saralash-api-dev 2>/dev/null || true
pm2 start "$PROD_ROOT/backend/dist/main.js" --name saralash-api-prod --cwd "$PROD_ROOT/backend"
pm2 start "$DEV_ROOT/backend/dist/main.js" --name saralash-api-dev --cwd "$DEV_ROOT/backend"
pm2 save

echo "==> Nginx"
cat >/etc/nginx/sites-available/saralash-prod.conf <<'NGINX'
server {
  listen 80;
  server_name saralash.liderplast.uz;
  root /opt/saralash-prod/web/dist;
  index index.html;
  client_max_body_size 20m;

  location /api/ {
    proxy_pass http://127.0.0.1:3103/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  location /docs {
    proxy_pass http://127.0.0.1:3103/docs;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
NGINX

cat >/etc/nginx/sites-available/saralash-dev.conf <<'NGINX'
server {
  listen 80;
  server_name dev.saralash.liderplast.uz;
  root /opt/saralash-dev/web/dist;
  index index.html;
  client_max_body_size 20m;

  location /api/ {
    proxy_pass http://127.0.0.1:3104/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  location /docs {
    proxy_pass http://127.0.0.1:3104/docs;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
NGINX

ln -sf /etc/nginx/sites-available/saralash-prod.conf /etc/nginx/sites-enabled/saralash-prod.conf
ln -sf /etc/nginx/sites-available/saralash-dev.conf /etc/nginx/sites-enabled/saralash-dev.conf
nginx -t
systemctl reload nginx

echo "==> SSL (certbot)"
certbot --nginx -d saralash.liderplast.uz --non-interactive --agree-tos -m admin@liderplast.uz --redirect || true
certbot --nginx -d dev.saralash.liderplast.uz --non-interactive --agree-tos -m admin@liderplast.uz --redirect || true

echo "==> Done"
pm2 list | grep saralash || true
curl -sS -o /dev/null -w "prod_api:%{http_code}\n" http://127.0.0.1:3103/api || true
