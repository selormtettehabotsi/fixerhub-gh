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

Scan the QR code with Expo Go. Set `EXPO_PUBLIC_API_URL` in `frontend/.env` to your machine's LAN IP, e.g. `http://192.168.x.x:8080`.

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
