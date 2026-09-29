#!/usr/bin/env bash
# ==============================================================================
# FoodBridge AWS EC2 Automated Deployment Script
# Target OS: Ubuntu 22.04 / 24.04 LTS (AMD64 / ARM64)
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}================================================================${NC}"
echo -e "${GREEN}   🍽️  FoodBridge — Automatic AWS EC2 Production Deployer     ${NC}"
echo -e "${BLUE}================================================================${NC}"

# Check root or sudo
if [ "$EUID" -ne 0 ]; then
  echo -e "${YELLOW}Please run with sudo: sudo bash aws/setup-ec2.sh${NC}"
  exit 1
fi

echo -e "\n${BLUE}[1/5] Updating system packages...${NC}"
apt-get update -y && apt-get upgrade -y
apt-get install -y curl git ufw jq openssl ca-certificates gnupg

echo -e "\n${BLUE}[2/5] Installing Docker & Docker Compose Plugin...${NC}"
if ! command -v docker &> /dev/null; then
  echo "Installing Docker via official convenience script..."
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
  rm -f get-docker.sh
else
  echo "Docker is already installed."
fi

# Ensure docker service is active
systemctl enable docker
systemctl start docker

# Add ubuntu user to docker group if exists
if id "ubuntu" &>/dev/null; then
  usermod -aG docker ubuntu
fi

echo -e "\n${BLUE}[3/5] Configuring Host Firewall (UFW)...${NC}"
ufw allow 22/tcp comment 'SSH' || true
ufw allow 80/tcp comment 'HTTP' || true
ufw allow 443/tcp comment 'HTTPS' || true
echo "y" | ufw enable || true

echo -e "\n${BLUE}[4/5] Generating Secure Production Environment...${NC}"
ENV_FILE=".env.production"
if [ ! -f "$ENV_FILE" ]; then
  JWT_SEC=$(openssl rand -hex 32)
  DB_PASS=$(openssl rand -hex 16)
  cat > "$ENV_FILE" <<EOF
POSTGRES_USER=foodbridge
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=foodbridge
JWT_SECRET=${JWT_SEC}
CLIENT_ORIGIN=*
VAPID_EMAIL=mailto:admin@foodbridge.local
EOF
  echo "Created $ENV_FILE with securely generated credentials."
else
  echo "$ENV_FILE already exists, preserving current configuration."
fi

echo -e "\n${BLUE}[5/5] Building & Launching FoodBridge Microservices...${NC}"
# Use docker compose plugin
if docker compose version &> /dev/null; then
  COMPOSE_CMD="docker compose"
else
  COMPOSE_CMD="docker-compose"
fi

$COMPOSE_CMD --env-file "$ENV_FILE" -f docker-compose.prod.yml down --remove-orphans || true
$COMPOSE_CMD --env-file "$ENV_FILE" -f docker-compose.prod.yml up -d --build

echo -e "\n${BLUE}Verifying Running Containers...${NC}"
sleep 5
$COMPOSE_CMD -f docker-compose.prod.yml ps

# Detect Public IP
PUBLIC_IP=$(curl -s https://checkip.amazonaws.com || curl -s ifconfig.me || echo "your-ec2-ip")

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}🎉 FoodBridge is now LIVE ONLINE!${NC}"
echo -e "${GREEN}================================================================${NC}"
echo -e "Access FoodBridge at:"
echo -e "   👉 ${BLUE}http://${PUBLIC_IP}${NC}"
echo -e "\nAPI Healthcheck:"
echo -e "   👉 ${BLUE}http://${PUBLIC_IP}/api/health${NC}"
echo -e "\nTo view live logs:"
echo -e "   ${YELLOW}sudo docker compose -f docker-compose.prod.yml logs -f${NC}"
echo -e "\nTo attach a domain & free SSL:"
echo -e "   Run: ${YELLOW}sudo bash aws/enable-ssl.sh yourdomain.com${NC}"
echo -e "${GREEN}================================================================${NC}"
