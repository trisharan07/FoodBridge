# 🚀 AWS EC2 Deployment Guide for FoodBridge

This guide walks you through deploying **FoodBridge** onto an **Amazon EC2 virtual machine** using containerized Docker Compose architecture (PostgreSQL, Express API, Vite React Frontend, MobileNet AI Microservice, and Nginx Gateway).

---

## 🏗️ Architecture Overview on EC2

```
                       [ Incoming Web Traffic ]
                                  │
                                  ▼
               ┌──────────────────────────────────────┐
               │         AWS Security Group           │
               │   Port 80 (HTTP) • Port 443 (HTTPS)  │
               └──────────────────┬───────────────────┘
                                  │
                                  ▼
               ┌──────────────────────────────────────┐
               │         Nginx Gateway (:80)          │
               │       Reverse Proxy & Gzip Cache     │
               └────┬─────────────┬─────────────┬─────┘
                    │             │             │
        ┌───────────┘             │             └───────────┐
        ▼                         ▼                         ▼
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│   Frontend   │          │ Backend API  │          │  AI Service  │
│ React + Vite │          │ Node/Sockets │          │  MobileNet   │
│   (Port 80)  │          │ (Port 4000)  │          │ (Port 5001)  │
└──────────────┘          └──────┬───────┘          └──────────────┘
                                 │
                                 ▼
                          ┌──────────────┐
                          │ PostgreSQL 16│
                          │   Database   │
                          └──────────────┘
```

---

## 📋 Prerequisites
1. An **[AWS Account](https://aws.amazon.com/)** (Free Tier eligible).
2. A terminal with SSH support (macOS/Linux Terminal, or PowerShell / PuTTY on Windows).
3. Your GitHub repository: `https://github.com/trisharan07/FoodBridge.git`.

---

## 🛠️ Step 1: Launch an AWS EC2 Instance

1. Log in to the **[AWS Management Console](https://console.aws.amazon.com/)**.
2. In the top search bar, type **EC2** and click **EC2**.
3. In the EC2 Dashboard, click the orange **Launch instance** button.
4. Fill in the following instance details:
   - **Name**: `FoodBridge-Production`
   - **Application and OS Images (AMI)**: Select **Ubuntu** ➔ Choose **Ubuntu Server 24.04 LTS (HVM)** or **22.04 LTS**.
   - **Architecture**: `64-bit (x86)`
   - **Instance type**:
     - `t2.micro` (Free Tier eligible, 1 vCPU, 1 GB RAM) **OR**
     - `t3.small` / `t3.medium` (recommended if running full MobileNet PyTorch in-memory alongside Postgres).
   - **Key pair (login)**:
     - Click **Create new key pair**.
     - Name: `foodbridge-key`.
     - Key pair type: `RSA`.
     - Private key format: `.pem` (OpenSSH).
     - Click **Create key pair** (this downloads `foodbridge-key.pem` to your computer — keep it safe!).
   - **Network settings (Firewall / Security Group)**:
     - Check ✅ **Allow SSH traffic from Anywhere (0.0.0.0/0)** (or My IP).
     - Check ✅ **Allow HTTP traffic from the internet (0.0.0.0/0)**.
     - Check ✅ **Allow HTTPS traffic from the internet (0.0.0.0/0)**.
   - **Configure storage**:
     - 20 GiB gp3 (Free Tier includes up to 30 GiB of EBS storage).
5. Click **Launch instance**.
6. Wait 1–2 minutes until **Instance state** shows `Running`.

---

## 🔑 Step 2: Connect to Your EC2 Instance via SSH

Open your local terminal and navigate to the directory where your downloaded `foodbridge-key.pem` is located (usually Downloads):

```bash
cd ~/Downloads

# Set read-only permissions for your private key (required by SSH)
chmod 400 foodbridge-key.pem

# Connect to your EC2 instance (replace with your EC2 Public IPv4 DNS or IP)
ssh -i "foodbridge-key.pem" ubuntu@<YOUR_EC2_PUBLIC_IP>
```

> **Tip**: You can find your instance's Public IPv4 IP in the EC2 Console under **Instances** ➔ Click your instance ➔ **Public IPv4 address**.

---

## ⚡ Step 3: Run the 1-Line Automated Deployment

Once connected to your Ubuntu EC2 terminal, run:

```bash
# 1. Clone the repository
git clone https://github.com/trisharan07/FoodBridge.git
cd FoodBridge

# 2. Run the automated deployment script
sudo bash aws/setup-ec2.sh
```

### What `setup-ec2.sh` does automatically:
- ✅ Updates Ubuntu packages.
- ✅ Installs **Docker** and the **Docker Compose plugin**.
- ✅ Configures the **UFW Host Firewall** (allowing ports 22, 80, 443).
- ✅ Generates cryptographically secure production keys (`JWT_SECRET`, database passwords).
- ✅ Builds the production containers (Postgres 16, Node.js API, React Frontend, Python MobileNet AI, and Nginx Gateway).
- ✅ Applies all database schemas and migrations (`schema.sql`, `migration_v2.sql`, `migration_v3.sql`).
- ✅ Prints out your live public URL!

---

## 🌐 Step 4: Verify Your Live Website

Once the script completes, open your web browser and visit:

```
http://<YOUR_EC2_PUBLIC_IP>
```

You will see the **FoodBridge** application running live with full functionality:
- 🍱 Donors can list surplus food with interactive maps and AI Freshness inspection.
- 🍽️ NGOs can claim food and view nearby donations.
- 🚴 Volunteers can accept pickups, transmit live GPS, and see OSRM turn-by-turn routes.
- 🛡️ Admins can log in, verify organizations, and view platform analytics.
- 🔔 WebPush alerts and SMS dispatches are operational.

---

## 🔒 Step 5: (Optional) Attach Custom Domain & Free SSL (HTTPS)

If you have a domain (e.g. `foodbridge.example.com` or `myproject.org`):

1. Go to your DNS provider (Cloudflare, Namecheap, GoDaddy, AWS Route 53) and add an **A Record**:
   - **Type**: `A`
   - **Name**: `@` or `foodbridge`
   - **Value**: `<YOUR_EC2_PUBLIC_IP>`
2. On your EC2 terminal, run:
   ```bash
   sudo bash aws/enable-ssl.sh yourdomain.com your-email@example.com
   ```
3. Your site is now accessible via secure **`https://yourdomain.com`**!

---

## 🔧 Useful Maintenance & Management Commands

### View live logs of all microservices:
```bash
sudo docker compose -f docker-compose.prod.yml logs -f
```

### View logs of a specific service:
```bash
sudo docker compose -f docker-compose.prod.yml logs -f backend
sudo docker compose -f docker-compose.prod.yml logs -f frontend
sudo docker compose -f docker-compose.prod.yml logs -f ai-service
sudo docker compose -f docker-compose.prod.yml logs -f db
```

### Pull latest updates from GitHub and redeploy:
```bash
git pull origin main
sudo docker compose -f docker-compose.prod.yml up -d --build
```

### Restart all containers:
```bash
sudo docker compose -f docker-compose.prod.yml restart
```

### Stop the application:
```bash
sudo docker compose -f docker-compose.prod.yml down
```
