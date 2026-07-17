# FixerHub

**Find a trusted worker near you.** FixerHub is a mobile marketplace that connects customers in Ghana with vetted local service workers — plumbers, electricians, carpenters, painters and more — with live tracking, in-app chat, and secure mobile payments.

Built by a team of students (FIXERHUB) at KNUST (Kwame Nkrumah University of Science and Technology).

## Features

- **Nearby worker search** — GPS-based, sorted closest-first, with live-updating distances as either party moves
- **Booking lifecycle** — request → accept/decline → quote → on the way → in progress → completed, enforced by a server-side state machine
- **Uber-style live tracking** — customers watch their worker approach on a map with ETA; workers see the job location
- **In-app chat** — real-time WebSocket (STOMP) messaging between customer and worker, with WhatsApp-style unread badges
- **Payments via Paystack** — customers pay in GH₵; the platform takes a configurable commission and pays workers out automatically to mobile money
- **SMS + push notifications** — booking updates and payment receipts via African's Talking SMS and Firebase FCM
- **Worker KYC verification** — ID + selfie review flow with admin approval
- **Ratings & reviews** — verified per completed booking, averaged onto worker profiles
- **Admin dashboard** — users, bookings, revenue, commission, and payout stats
- **Account management** — edit profile, change password, and verify email (mail OTP) & phone (SMS OTP) with badges
- **Worker Pro subscription** — GH₵30/month for lower commission, a PRO badge, and priority in nearby search
- **Referrals** — every user gets a share code; the referrer is credited when their invitee completes a first paid booking
- **Retention** — favorite workers with one-tap rebooking, recurring bookings (weekly/bi-weekly/monthly), and worker "jobs completed" milestones
- **Light / Dark / System theme** — selectable in-app and persisted

## Architecture

Spring Boot microservices behind an API gateway, with service discovery, async events, and a React Native mobile app.

| Service | Port | Responsibility |
|---|---|---|
| eureka-server | 8761 | Service discovery |
| api-gateway | 8080 | Single entry point, JWT validation, routing |
| auth-service | 8081 | Register/login, refresh tokens, password reset (OTP via SMS), reports |
| worker-service | 8082 | Worker profiles, live location, KYC, nearby search |
| booking-service | 8083 | Bookings, state machine, chat + live tracking (WebSocket) |
| payment-service | 8084 | Paystack payments, commission, worker payouts |
| review-service | 8085 | Ratings & reviews |
| notification-service | 8086 | SMS (African's Talking) + FCM push |
| admin-service | 8087 | Admin stats and management |

**Stack:** Java 21 · Spring Boot 3.2 · Spring Cloud (Eureka, Gateway) · PostgreSQL (Flyway migrations) · Redis (caching) · Apache Kafka (booking events) · Docker Compose · React Native (Expo) frontend.

**Security highlights:** 15-minute JWTs with rotating 7-day refresh tokens (hashed at rest), gateway-signed identity headers verified by every downstream service, ownership checks on all resources, PII-sanitized public endpoints, authenticated WebSockets, idempotent payments and payouts, BigDecimal money end-to-end.

## Getting started

### Prerequisites

- Java 21, Maven
- Node.js 18+, Expo Go on your phone (or an emulator)
- Docker Desktop

### 1. Configure environment

```bash
  cp .env.example .env
```

Fill in the values — Paystack test key, African's Talking sandbox key, Google Maps key, and generated secrets:

```bash
  openssl rand -hex 32   # run twice: once for JWT_SECRET, once for GATEWAY_SECRET
```

All services fail fast if secrets are missing. Never commit `.env`.

### 2. Start infrastructure

```bash
  docker compose up -d          # PostgreSQL + Redis + Kafka + Zookeeper
```

### 3. Run the backend

Either run all nine services in containers:

```bash
  docker compose --profile app up -d --build
```

or run them from your IDE (start `eureka-server` first, then the rest). Flyway creates and migrates the schema automatically on first start.

### 4. Run the mobile app

```bash

cd frontend
npm install
npx expo start --port 8088
```

Scan the QR code with Expo Go. Set `EXPO_PUBLIC_API_URL` in `frontend/.env` to your machine's LAN IP, e.g. `http://192.168.x.x:8080` (or the deployed URL — see Deployment below).

> On a locked-down campus network that blocks device-to-device traffic, use `--tunnel`, or run Metro over the phone's personal hotspot with `REACT_NATIVE_PACKAGER_HOSTNAME=<laptop-hotspot-ip> npx expo start -c --port 8088`.

### 5. Build the Android APK

Installable APK via EAS (cloud build — no Android Studio needed):

```bash
cd frontend
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

The build URL lives in `eas.json` (`preview.env.EXPO_PUBLIC_API_URL`), so the APK talks to whatever backend you point it at. A config plugin (`plugins/withAndroidV1Signing.js`) re-enables **v1 APK signing** so the APK installs on OEM skins (MIUI/EMUI) that reject v2-only packages.

## Deployment

FixerHub is deployed publicly at **`https://api.fixerhub.me`** via a **Cloudflare Tunnel** that exposes the local `docker compose` stack over HTTPS — free, no cloud VM, no card required.

**One-time setup**

1. Register a free domain (e.g. a `.me` from the GitHub Student Pack / Namecheap) and add it to a free Cloudflare account; point the registrar's nameservers at Cloudflare.
2. Install `cloudflared`, then create the named tunnel and DNS route:
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create fixerhub
   cloudflared tunnel route dns fixerhub api.fixerhub.me
   ```
3. Create `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: <tunnel-id>
   credentials-file: C:/Users/<you>/.cloudflared/<tunnel-id>.json
   ingress:
     - hostname: api.fixerhub.me
       service: http://localhost:8080
     - service: http_status:404
   ```

**Run it**

```bash
docker compose --profile app up -d          # the 9-service backend
cloudflared tunnel run fixerhub             # expose it at https://api.fixerhub.me
```

To keep the tunnel up without a terminal, install it as a background service (PowerShell as Administrator): copy `~/.cloudflared` into the SYSTEM profile, `cloudflared service install`, then `Start-Service Cloudflared`.

Point the app + webhook at the deployment: set `EXPO_PUBLIC_API_URL=https://api.fixerhub.me` (in `frontend/.env` and `eas.json`) and the Paystack webhook to `https://api.fixerhub.me/payments/webhook`.

> This is a **pilot/demo** deployment — the backend runs through the host machine, so Docker and one `cloudflared` instance must stay running. A 24/7 production host would use a cloud VM behind TLS; everything else (custom domain, public reachability, HTTPS, working webhook) is already in place.

## Repository layout

```
backend/     # 9 Maven modules (one per service) + shared Dockerfile
frontend/    # Expo React Native app (expo-router)
docs/        # QA/security audit history and project documents
```

## CI

GitHub Actions runs the backend test suite (`mvn clean verify` across all modules) and a frontend type check on every push. Credentials come from repository secrets (`CI_POSTGRES_USER`, `CI_POSTGRES_PASSWORD`, `CI_JWT_SECRET`, `CI_GATEWAY_SECRET`).

## License

Academic project — all rights reserved by the FixerHub team, KNUST.
