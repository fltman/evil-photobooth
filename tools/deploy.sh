#!/usr/bin/env bash
# Driftsätter spegeln på Vultr-boxen bakom Caddy, som ger den https kameran kräver på mobilen.
# Idempotent: kör igen för att uppdatera. Bilderna i /var/lib/evil-photobooth lämnas orörda.
#
#   tools/deploy.sh                # skicka + starta om
#   CADDY=0 tools/deploy.sh        # hoppa över Caddy (t.ex. innan DNS-posten slagit igenom)
#
# Kräver: ssh-nyckel till root@HOST, A-posten spegeln.bjarby.com -> HOST (one.com, DNS-inställningar),
# OPENROUTER_API_KEY i miljön och en festkod i config.json.
set -euo pipefail
HOST=${HOST:-root@70.34.220.159}
DOMAIN=${DOMAIN:-spegeln.bjarby.com}
APP=/opt/evil-photobooth
DATA=/var/lib/evil-photobooth
PORT=${PORT:-8293}
CADDY=${CADDY:-1}
cd "$(dirname "$0")/.."

# En öppen spegel på internet vore gästernas ansikten och din OpenRouter-kredit till vem som helst.
node -e "process.exit(JSON.parse(require('fs').readFileSync('config.json')).partyCode ? 0 : 1)" \
  || { echo "Sätt partyCode i config.json före driftsättning."; exit 1; }
[ -n "${OPENROUTER_API_KEY:-}" ] || { echo "OPENROUTER_API_KEY saknas i miljön."; exit 1; }

echo "› skickar till $HOST:$APP"
ssh "$HOST" "mkdir -p $APP"
rsync -az --delete server public config.json package.json "$HOST:$APP/"

echo "› installerar och startar"
printf 'OPENROUTER_API_KEY=%s\n' "$OPENROUTER_API_KEY" | ssh "$HOST" "umask 077; cat > /etc/evil-photobooth.env"
ssh "$HOST" APP="$APP" DATA="$DATA" PORT="$PORT" DOMAIN="$DOMAIN" CADDY="$CADDY" bash -s <<'REMOTE'
set -euo pipefail
id spegeln >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin spegeln
mkdir -p "$DATA" && chown spegeln "$DATA"

cat > /etc/systemd/system/evil-photobooth.service <<UNIT
[Unit]
Description=Den onda spegeln
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP
ExecStart=/usr/bin/node server/index.mjs
Restart=always
RestartSec=3
User=spegeln
EnvironmentFile=/etc/evil-photobooth.env
Environment=PORT=$PORT
Environment=DATA_DIR=$DATA
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$DATA
MemoryMax=300M

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable evil-photobooth >/dev/null 2>&1
systemctl restart evil-photobooth

if [ "$CADDY" = 1 ] && ! grep -q "^$DOMAIN {" /etc/caddy/Caddyfile; then
  cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.bak.$(date +%s)"
  cat >> /etc/caddy/Caddyfile <<CADDYFILE

$DOMAIN {
    encode zstd gzip
    reverse_proxy localhost:$PORT
}
CADDYFILE
fi
if [ "$CADDY" = 1 ]; then
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
  systemctl reload caddy
fi
sleep 1
systemctl is-active evil-photobooth
REMOTE
echo "› klart: https://$DOMAIN"
