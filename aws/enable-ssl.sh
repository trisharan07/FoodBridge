#!/usr/bin/env bash
# ==============================================================================
# FoodBridge Free Let's Encrypt SSL Configurator for AWS EC2
# Usage: sudo bash aws/enable-ssl.sh yourdomain.com your-email@example.com
# ==============================================================================

set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-admin@foodbridge.local}"

if [ -z "$DOMAIN" ]; then
  echo "Usage: sudo bash aws/enable-ssl.sh <yourdomain.com> [email]"
  exit 1
fi

echo "🔐 Requesting Let's Encrypt SSL Certificate for $DOMAIN..."

# Install certbot if not present
if ! command -v certbot &> /dev/null; then
  apt-get update -y && apt-get install -y certbot
fi

# Request standalone cert while nginx routes ACME challenge
certbot certonly --webroot -w /var/lib/docker/volumes/foodbridge_certbot_data/_data \
  -d "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive || {
  echo "Webroot challenge fallback: Stopping nginx container briefly..."
  docker compose -f docker-compose.prod.yml stop nginx
  certbot certonly --standalone -d "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive
  docker compose -f docker-compose.prod.yml start nginx
}

echo "✅ SSL Certificate generated successfully for $DOMAIN."
echo "Certificates located at: /etc/letsencrypt/live/$DOMAIN/"
