# 🍽️ FoodBridge

<div align="center">

![FoodBridge Banner](docs/images/banner.jpg)

### **Hyperlocal Real-Time Food Rescue & Surplus Redistribution Platform**

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black&style=for-the-badge)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white&style=for-the-badge)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white&style=for-the-badge)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.19-000000?logo=express&logoColor=white&style=for-the-badge)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white&style=for-the-badge)](https://www.postgresql.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.7-010101?logo=socket.io&logoColor=white&style=for-the-badge)](https://socket.io/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet&logoColor=white&style=for-the-badge)](https://leafletjs.com/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?logo=docker&logoColor=white&style=for-the-badge)](https://www.docker.com/)

<p align="center">
  <a href="#-key-features"><b>Key Features</b></a> •
  <a href="#-system-architecture"><b>Architecture</b></a> •
  <a href="#-user-roles--lifecycle"><b>Lifecycle Flow</b></a> •
  <a href="#-database-schema"><b>Database</b></a> •
  <a href="#-quickstart-guide"><b>Quickstart</b></a> •
  <a href="#-api-documentation"><b>API Reference</b></a> •
  <a href="#-roadmap"><b>Roadmap</b></a>
</p>

</div>

---

## 📖 Overview

Every day, commercial kitchens, banquet halls, supermarkets, and restaurants discard metric tons of edible, high-quality surplus food due to logistical latency and fragmented communication. Concurrently, local orphanages, shelters, and community food banks struggle to fulfill basic daily nutritional needs.

**FoodBridge** is a modern, full-stack, real-time logistics platform designed to solve this last-mile coordination problem. By integrating:
1. **Interactive OpenStreetMap Geocoding** for precise pickup geofencing,
2. **Real-time Volunteer GPS Delivery Tracking** powered by bi-directional WebSocket channels,
3. **Centralized Administrative Verification** ensuring food safety and verified NGO legitimacy, and
4. **Computer Vision-Ready AI Freshness Scoring** to assess food safety before dispatch,

FoodBridge reduces the turnaround time from kitchen surplus to table delivery from hours to minutes.

---

## 🌟 Key Features

```
┌───────────────────────────────────────────────────────────────────────────┐
│                           FOODBRIDGE CORE SUITE                           │
├─────────────────────┬─────────────────────┬───────────────────────────────┤
│ 🗺️ Leaflet & OSM    │ 🚚 Real-Time GPS    │ 🛡️ Admin Verification         │
│ • Click-to-pin maps │ • Live courier ping │ • KYC / NGO accreditation     │
│ • Proximity search  │ • Stage progression │ • Audit trails & platform KPI │
│ • Free & open-source│ • ETA & delivery log│ • Fraud mitigation            │
├─────────────────────┴─────────────────────┴───────────────────────────────┤
│ 🧠 AI Freshness Score Engine                                              │
│ • Automated image capture & computer-vision scoring pipeline               │
│ • Confidence tiers: Fresh (85-99) • Good (65-84) • Okay • Wilted          │
│ • Real-time status badges with interactive freshness gauge                │
└───────────────────────────────────────────────────────────────────────────┘
```

### 1. 🗺️ Interactive Maps (Leaflet + OpenStreetMap)
- **Zero Cost, Zero API Quota**: Built with Leaflet and OpenStreetMap tile layers, requiring no proprietary API keys or paid billing tiers.
- **Location Picker**: Donors can click directly on the interactive map to place a pinpoint marker or allow browser geocoding.
- **Proximity-Based Discovery**: NGOs view listings plotted as interactive food markers with instant claim triggers.
- **Haversine Distance Filter**: Server-side trigonometric computation calculates accurate direct distances in kilometers.

### 2. 🚚 Real-Time Volunteer Delivery Tracking
- **Multi-Stage Delivery Progression**: Seamless progression through `pending` ➔ `assigned` ➔ `in_transit` ➔ `delivered`.
- **Live Geolocation Broadcasts**: Volunteers transmit GPS coordinates via high-precision device sensors, dynamically updating volunteer markers on donor and NGO dashboards without refreshing.
- **Proof of Delivery**: Delivery completion logs timestamps, volunteer attribution, and optional delivery notes.

### 3. 🛡️ Admin Governance & Verification
- **Safety & Quality Guard**: Unverified donors or NGOs cannot transact until verified by platform administrators.
- **One-Click Approval / Rejection**: Admins review credentials, contact details, and organization legitimacy with custom rejection reasoning.
- **Platform Analytics**: Real-time breakdown of user counts, active listings, fulfilled deliveries, and operational volume.

### 4. 🧠 AI Freshness Scoring
- **Automated Food Quality Evaluation**: Donors upload photos of surplus dishes during listing creation.
- **Quality Score Calculation**: MobileNet-compatible pipeline calculates an integrity score (0–99), categorical label, and confidence rating.
- **Transparency Gauge**: Both NGOs and drivers see an intuitive, color-coded circular gauge displaying food freshness prior to claiming.

---

## 🏛️ System Architecture

```mermaid
graph TB
    subgraph ClientTier ["🖥️ Client Tier (React 18 + Vite + Leaflet)"]
        UI_Donor["🍱 Donor Portal<br/>(Create Listing, Freshness Gauge, Pin Location)"]
        UI_NGO["🍽️ NGO Portal<br/>(Discover Nearby, Interactive Map, Claim Food)"]
        UI_Vol["🚴 Volunteer App<br/>(Accept Task, GPS Broadcaster, Live Route)"]
        UI_Admin["🛡️ Admin Console<br/>(User Verification, Analytics Dashboard)"]
    end

    subgraph Gateway ["⚡ Real-Time & API Layer"]
        CORS["CORS & Body Parser Middleware"]
        AuthMiddleware["JWT Token Verification & RBAC Guards"]
        SocketServer["Socket.IO Event Gateway<br/>(Rooms: 'donor', 'ngo', 'volunteer', 'user:ID')"]
    end

    subgraph ServiceModules ["📦 Backend Modules (Express.js)"]
        AuthSvc["Auth Service<br/>(/api/auth)"]
        DonationSvc["Donations & Haversine Engine<br/>(/api/donations)"]
        PickupSvc["Pickup Dispatcher<br/>(/api/pickups)"]
        TrackingSvc["Live Tracking Engine<br/>(/api/tracking)"]
        FreshnessSvc["Freshness AI Scoring<br/>(/api/freshness)"]
        AdminSvc["Admin Governance<br/>(/api/admin)"]
    end

    subgraph DataTier ["🗄️ Persistence Tier"]
        PG[("PostgreSQL 16 Engine")]
        Uploads[("Static File Storage<br/>/uploads")]
    end

    UI_Donor & UI_NGO & UI_Vol & UI_Admin -->|"HTTP REST API"| CORS
    UI_Donor & UI_NGO & UI_Vol & UI_Admin <-->|"WebSockets (WSS)"| SocketServer
    
    CORS --> AuthMiddleware
    AuthMiddleware --> ServiceModules
    
    ServiceModules --> PG
    FreshnessSvc --> Uploads
    ServiceModules --> SocketServer
```

---

## 🔄 User Roles & Lifecycle Flow

```mermaid
sequenceDiagram
    autonumber
    actor Donor as 🍱 Donor (Restaurant)
    actor NGO as 🍽️ NGO (Shelter)
    actor Volunteer as 🚴 Volunteer
    actor Admin as 🛡️ Admin
    participant System as ⚡ FoodBridge Core
    participant DB as 🗄️ PostgreSQL

    Note over Donor,Admin: 1. Registration & Verification
    Donor->>System: Register account (role: donor)
    NGO->>System: Register account (role: ngo)
    Admin->>System: Review pending list & verify organizations
    System->>DB: UPDATE users SET is_verified = TRUE

    Note over Donor,NGO: 2. Listing Creation & AI Inspection
    Donor->>System: Upload food image & metadata with map coordinates
    System->>System: Calculate AI Freshness Score (e.g. 94/100 'Fresh')
    System->>DB: INSERT INTO food_listings (lat, lng, freshness_score)
    System-->>NGO: Socket.IO Event: "donation:new" (alert nearby food)

    Note over NGO,Volunteer: 3. Claiming & Dispatch
    NGO->>System: Claim available food donation
    System->>DB: UPDATE food_listings SET status = 'claimed'
    System->>DB: INSERT INTO pickups (status = 'pending')
    System-->>Volunteer: Socket.IO Event: "pickup:open"

    Note over Volunteer,NGO: 4. Acceptance, Live Tracking & Delivery
    Volunteer->>System: Accept pickup task
    System->>DB: INSERT INTO volunteer_assignments
    loop Live Tracking
        Volunteer->>System: Push GPS coordinates (lat, lng)
        System-->>NGO: Broadcast: "tracking:location"
    end
    Volunteer->>System: Advance status: "in_transit"
    Volunteer->>System: Confirm Delivery (notes / proof)
    System->>DB: UPDATE pickups SET status = 'delivered'
    System-->>Donor: Notification: Delivery confirmed
    System-->>NGO: Notification: Food received
```

---

## 📊 Database Schema

```mermaid
erDiagram
    USERS ||--o{ ORGANIZATIONS : owns
    USERS ||--o{ FOOD_LISTINGS : creates
    USERS ||--o{ PICKUPS : claims
    USERS ||--o{ VOLUNTEER_ASSIGNMENTS : delivers
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ AUDIT_LOGS : triggers
    FOOD_LISTINGS ||--|| PICKUPS : fulfills
    PICKUPS ||--|| VOLUNTEER_ASSIGNMENTS : routes

    USERS {
        UUID id PK
        user_role role
        TEXT name
        TEXT email UK
        TEXT phone
        TEXT password_hash
        BOOLEAN is_verified
        TIMESTAMPTZ verified_at
        UUID verified_by
        TEXT rejection_reason
        TIMESTAMPTZ created_at
    }

    ORGANIZATIONS {
        UUID id PK
        UUID user_id FK
        TEXT org_name
        TEXT org_type
        TEXT address
        DOUBLE lat
        DOUBLE lng
        TEXT registration_no
    }

    FOOD_LISTINGS {
        UUID id PK
        UUID donor_id FK
        TEXT food_name
        INT quantity
        TEXT unit
        TIMESTAMPTZ pickup_from
        TIMESTAMPTZ pickup_until
        TIMESTAMPTZ expires_at
        TEXT address
        DOUBLE lat
        DOUBLE lng
        TEXT image_url
        NUMERIC freshness_score
        TEXT freshness_label
        listing_status status
        TIMESTAMPTZ created_at
    }

    PICKUPS {
        UUID id PK
        UUID listing_id FK
        UUID ngo_id FK
        pickup_status status
        TIMESTAMPTZ delivered_at
        TEXT delivery_note
        TIMESTAMPTZ created_at
    }

    VOLUNTEER_ASSIGNMENTS {
        UUID id PK
        UUID pickup_id FK
        UUID volunteer_id FK
        DOUBLE current_lat
        DOUBLE current_lng
        TIMESTAMPTZ location_updated_at
        TIMESTAMPTZ assigned_at
    }

    AUDIT_LOGS {
        BIGSERIAL id PK
        UUID user_id FK
        TEXT action
        TEXT entity
        UUID entity_id
        TIMESTAMPTZ created_at
    }
```

---

## 🚀 Quickstart Guide

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or newer
- [Docker & Docker Compose](https://www.docker.com/) (recommended for PostgreSQL)
- [Git](https://git-scm.com/)

### 1. Clone & Setup Workspace
```bash
git clone https://github.com/trisharan07/FoodBridge.git
cd FoodBridge
```

### 2. Start PostgreSQL Database
```bash
# Spins up PostgreSQL 16 container with schema initialized
docker compose up -d

# Apply v2 migrations (maps, tracking, admin, freshness)
docker exec -i $(docker ps -qf "name=db") psql -U foodbridge foodbridge < database/migration_v2.sql
```

### 3. Start the Backend API
```bash
cd backend
cp .env.example .env
npm install
npm run dev
# Running on http://localhost:4000
```

### 4. Start the Frontend Application
```bash
cd ../frontend
npm install
npm run dev
# Running on http://localhost:5173
```

---

## 🧪 Interactive Multi-Role Testing Walkthrough

To experience the real-time synergy of FoodBridge, open **four distinct browser windows or private incognito tabs**:

| Window | Role | Credentials | Action |
|:------:|:----:|:-----------:|:-------|
| **Tab 1** | 🛡️ **Admin** | `admin@foodbridge.local` | Open **Admin Panel** to view statistics and approve pending users. |
| **Tab 2** | 🍱 **Donor** | `donor@restaurant.com` | Pick location on the map, upload an image for AI score, and list food. |
| **Tab 3** | 🍽️ **NGO** | `ngo@care.org` | Watch the real-time notification pop up, view the food on the map, and click **Claim**. |
| **Tab 4** | 🚴 **Volunteer** | `volunteer@rider.org` | See the open pickup, click **Accept**, click **Send GPS** to transmit live coordinates, and mark **Delivered**. |

---

## 📡 API Reference

### 🔐 Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
|:------:|:---------|:------:|:------------|
| `POST` | `/register` | Public | Register (`donor`, `ngo`, `volunteer`, `admin`) |
| `POST` | `/login` | Public | Authenticate and obtain JWT bearer token |

### 🍱 Food Listings (`/api/donations`)
| Method | Endpoint | Access | Description |
|:------:|:---------|:------:|:------------|
| `GET` | `/` | All Roles | Fetch active, non-expired listings |
| `GET` | `/nearby?lat=&lng=&radius=` | All Roles | Proximity search via Haversine distance formula |
| `POST` | `/` | Donor | Create surplus food donation with map coordinates |
| `POST` | `/:id/claim` | NGO | Atomically claim available listing |

### 📦 Pickups & Volunteers (`/api/pickups`)
| Method | Endpoint | Access | Description |
|:------:|:---------|:------:|:------------|
| `GET` | `/open` | Volunteer | Retrieve unassigned claimed pickups |
| `GET` | `/my-active` | Volunteer | List assignments actively in progress |
| `POST` | `/:id/accept` | Volunteer | Claim pickup assignment |
| `PATCH`| `/:id/advance` | Volunteer | Advance status (`assigned` ➔ `in_transit` ➔ `delivered`) |

### 🚚 Live Tracking (`/api/tracking`)
| Method | Endpoint | Access | Description |
|:------:|:---------|:------:|:------------|
| `POST` | `/:pickupId/location` | Volunteer | Transmit device GPS coordinates |
| `GET` | `/:pickupId/location` | Authenticated | Retrieve latest volunteer + pickup locations |
| `POST` | `/:pickupId/confirm-delivery` | Volunteer | Mark delivery complete with notes |
| `GET` | `/:pickupId/timeline` | Authenticated | Fetch comprehensive delivery timeline audit |

### 🧠 AI Freshness (`/api/freshness`)
| Method | Endpoint | Access | Description |
|:------:|:---------|:------:|:------------|
| `POST` | `/analyze` | Donor | Upload multipart food photo for freshness scoring |
| `GET` | `/score/:listingId` | Authenticated | Fetch computed freshness metrics for listing |

### 🛡️ Admin Verification (`/api/admin`)
| Method | Endpoint | Access | Description |
|:------:|:---------|:------:|:------------|
| `GET` | `/users/pending` | Admin | List accounts awaiting verification |
| `GET` | `/users` | Admin | Query all accounts with optional role filter |
| `POST` | `/users/:id/verify` | Admin | Approve and verify user account |
| `POST` | `/users/:id/reject` | Admin | Reject user account with recorded reason |
| `GET` | `/stats` | Admin | Aggregated platform operational metrics |

---

## 📁 Repository Structure

```
FoodBridge/
├── backend/
│   ├── src/
│   │   ├── middleware/
│   │   │   └── auth.js         # JWT verification & RBAC guard
│   │   ├── routes/
│   │   │   ├── admin.js        # Admin verification & KPI routes
│   │   │   ├── auth.js         # User registration & JWT auth
│   │   │   ├── donations.js    # Food listings & Haversine proximity
│   │   │   ├── freshness.js    # Multer upload & MobileNet bridge
│   │   │   ├── notifications.js# WebPush VAPID & SMS dispatcher
│   │   │   ├── pickups.js      # Assignment & status state engine
│   │   │   └── tracking.js     # OSRM turn-by-turn routing & live GPS
│   │   ├── services/
│   │   │   └── notificationService.js # WebPush & SMS integration
│   │   ├── db.js               # PostgreSQL pool connection
│   │   └── server.js           # Express setup + Socket.IO server
│   ├── uploads/                # Food imagery storage
│   └── package.json
│
├── frontend/
│   ├── public/
│   │   └── sw.js               # Service Worker for WebPush alerts
│   ├── src/
│   │   ├── App.jsx             # Unified SPA with role views & OSRM maps
│   │   ├── main.jsx            # React root mount
│   │   └── style.css           # Premium design tokens & responsive CSS
│   ├── index.html              # HTML5 entry with fonts & meta tags
│   ├── vite.config.js          # Vite config & API/Socket proxying
│   └── package.json
│
├── ml-service/                 # MobileNet AI Python Microservice
│   ├── app.py                  # Standalone classification HTTP microservice
│   ├── requirements.txt        # PyTorch, TorchVision, Pillow dependencies
│   └── Dockerfile              # Containerized ML inference runtime
│
├── database/
│   ├── schema.sql              # Initial 8-table relational schema
│   ├── migration_v2.sql        # v2 schema updates (tracking, admin, AI)
│   └── migration_v3.sql        # v3 schema updates (push subscriptions, SMS)
│
├── docs/
│   └── images/
│       └── banner.jpg          # FoodBridge visual illustration
│
└── docker-compose.yml          # PostgreSQL & MobileNet AI Microservice

```

---

## 🗺️ Roadmap & Milestones

- [x] **Core MVP**: JWT authentication, listing management, claim lifecycle.
- [x] **Maps & Geolocation**: Leaflet + OpenStreetMap integration with click-to-pin.
- [x] **Delivery Tracking**: Volunteer GPS pinging, real-time Socket.IO broadcasts.
- [x] **Admin Governance**: Verification workflows and system health analytics.
- [x] **AI Freshness Scoring**: Image analysis pipeline and visual status gauges.
- [x] **MobileNet Python Microservice**: Standalone classification microservice (`ml-service/`).
- [x] **Turn-by-Turn Route Optimization**: OSRM (Open Source Routing Machine) waypoint routing.
- [x] **Cloud Deployment**: AWS ECS / EC2 container deployment with Amazon RDS PostgreSQL & S3 bucket assets.
- [ ] **Continuous Integration (CI/CD)**: GitHub Actions workflow for automated testing & ECR build triggers.



---

## 📄 License & Attribution

Developed with ❤️ as an Engineering Final Year Project. Open-sourced under the [MIT License](LICENSE).
