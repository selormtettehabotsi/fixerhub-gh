# FixerHub

**Find a trusted worker near you.** FixerHub is a mobile marketplace that connects customers in Ghana with vetted local service workers — plumbers, electricians, carpenters, painters and more — with live tracking, in-app chat, and secure mobile payments.

Built by a team of students (FIXERHUB) at KNUST (Kwame Nkrumah University of Science and Technology).

## Features

- **Nearby worker search** — GPS-based, sorted closest-first, with live-updating distances as either party moves
- **Booking lifecycle** — request → accept/decline → quote → on the way → in progress → completed, enforced by a server-side state machine
- **Uber-style live tracking** — customers watch their worker approach on a map with a road-following route and ETA; workers see the job location
- **In-app chat** — real-time WebSocket (STOMP) messaging with read receipts, voice messages, photo sharing, unread badges, and cached history that stays readable offline
- **Payments via Paystack** — customers pay in GH₵; the platform takes a configurable commission and pays workers out automatically to mobile money
- **SMS + push notifications** — booking updates and payment receipts via African's Talking SMS and Firebase FCM
- **Worker KYC verification** — ID + selfie review flow with admin approval
- **Ratings & reviews** — verified per completed booking, averaged onto worker profiles
- **Admin dashboard** — users, bookings, revenue, commission, and payout stats
- **Account management** — edit profile, change password, and verify email (mail OTP) & phone (SMS OTP) with badges
- **Worker Pro subscription** — GH₵30/month for lower commission, a PRO badge, and priority in nearby search
- **Referrals** — every user gets a share code; the referrer is credited when their invitee completes a first paid booking
- **Retention** — favorite workers with one-tap rebooking, recurring bookings (weekly/bi-weekly/monthly), and worker "jobs completed" milestones
- **Light / Dark / System theme** — selectable in-app, applied instantly without a reload
- **Terms & Privacy** — in-app, accepted at sign-up and readable offline from either profile
- **Over-the-air updates** — JS fixes ship without a store release; the app applies them on the launch that finds them, and both profiles show which bundle is running

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

**Maps:** the tracking map is Leaflet rendered in a WebView, with OpenStreetMap tiles served by CARTO and driving routes from OSRM — no Maps SDK, no API key, no billing account. Google Maps is used server-side only, to geocode a worker's address into coordinates when their profile is created.

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

FixerHub runs publicly at **`https://api.fixerhub.me`** on an **AWS EC2 t3.large** — the nine-service Docker stack behind Nginx, with TLS from Let's Encrypt and a Cloudflare A record pointing at an Elastic IP.

**On the instance**

```bash
git clone https://github.com/selormtettehabotsi/fixerhub-gh.git
cd fixerhub-gh
cp .env.example .env          # fill in secrets

docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile app up -d --build
```

`docker-compose.prod.yml` is a production overlay: `restart: unless-stopped`, per-service memory limits, a Postgres healthcheck, Kafka retention caps, and `JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=65` so each JVM heap derives from its container limit rather than a hardcoded `-Xmx`.

**In front of it**

Nginx proxies 80/443 to the gateway on 8080; `certbot --nginx` issues and renews the certificate. DNS is a plain A record from Cloudflare to the Elastic IP.

Then point the app and the webhook at it: `EXPO_PUBLIC_API_URL=https://api.fixerhub.me` (in `frontend/.env` and `eas.json`) and the Paystack webhook to `https://api.fixerhub.me/payments/webhook`.

**Notes**

- First boot is slow — services take a couple of minutes to register with Eureka, and a 503 immediately after deploy usually means registration hasn't finished.
- `backend/Dockerfile` uses a BuildKit `.m2` cache mount; without it, nine parallel cold Maven downloads exhaust DNS and the build fails on name resolution.

> Still a **pilot** deployment: SSH is open while testing, Paystack is on test keys, SMS is on the Africa's Talking sandbox, and database backups to S3 are scripted (`scripts/backup-db.sh`) but not yet scheduled on the server.

## Over-the-air updates

JavaScript changes ship without rebuilding the APK:

```bash
cd frontend
npx eas update --branch preview --message "what changed"
```

The app checks on launch and applies the update immediately rather than waiting for the next cold start, and both profile screens carry a **Check for updates** button plus a label showing which bundle is running. Native changes — a new native module, anything in `app.json` — still need a full `eas build`.

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
