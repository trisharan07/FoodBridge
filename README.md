# FoodBridge — Connecting Surplus Food with People Who Need It

Working MVP: donors list surplus food, NGOs claim it, volunteers deliver it, and everyone sees updates live.

## Run it locally
```bash
docker compose up -d                     # PostgreSQL + schema
cd backend && cp .env.example .env && npm install && npm run dev
cd frontend && npm install && npm run dev  # http://localhost:5173
```
Demo flow: register three accounts (donor, ngo, volunteer) in three browser windows.
Donor lists food -> NGO sees a live alert and claims it -> volunteer sees the pickup and accepts it.

## Layout
- `backend/` Express API, JWT auth, Socket.IO (rooms per role and per user)
- `frontend/` React + Vite (donor, NGO and volunteer views)
- `database/schema.sql` 8 tables with constraints and an index
- `docs/` put report chapters, UML and DFD exports here
- `aws/` deployment notes and scripts (later)

## Roadmap
1. Report volume 1: introduction, problem statement, objectives, scope, literature review, SRS
2. Diagrams: use case, class, sequence, activity, ER, DFD (draw.io)
3. Maps: lat/lng capture, nearby listings (Leaflet + OpenStreetMap is free)
4. Volunteer live tracking and delivery confirmation
5. Admin verification of donors/NGOs plus basic analytics
6. AI freshness score (image -> MobileNet -> score) as a separate Python service
7. Testing: Jest + Supertest for the API, a test-case table for the report
8. AWS: EC2 + RDS + S3 + Nginx, then CloudFront/SES if time allows
9. Final report, PPT, viva prep, GitHub repo
