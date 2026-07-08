# Employee Android App: Architecture and Rollout Plan

## Recommendation

Build a separate Expo app in a small monorepo alongside the existing Next.js backend. Keep identity, attendance rules, face matching, consent, and auditing on the server. The app should be a thin employee client that captures a face and location, submits them securely, and renders server-owned state.

Do not duplicate Prisma models or business rules in React Native. Extract shared API schemas and enums into a framework-neutral package only after the mobile API contract is stable.

## Existing system assessment

The current system is a Next.js 15 application with PostgreSQL/Prisma, server-side attendance services, encrypted biometric embeddings, audit logging, a Python face service, and employee/admin web pages.

Reusable foundations:

- Login validation, lockout rules, account status checks, and audit events.
- Employee profile and biometric status data.
- PIN verification and two-minute duplicate-event protection.
- Consent, enrollment, deletion, and encrypted server-side face templates.
- Server-side face verification via the configured provider.
- Reverse geocoding to `Barangay,City/Municipality,Country`.

Mobile-readiness gaps:

- Authentication only reads an HTTP-only cookie; Expo needs an explicit bearer-token flow with secure device storage.
- Logout deletes the cookie but does not revoke the database session.
- Employee endpoints authenticate any signed-in role rather than enforcing `EMPLOYEE` consistently.
- Attendance history is fixed at 100 records with no cursor, filters, or summary contract.
- The dashboard has no mobile API and derives current status from a simplistic recent-record query.
- Attendance actions are not modeled as a server-owned state machine; the client can submit any event type.
- Face images are written into `captureImageUrl` as data URLs, conflicting with the stated memory-only capture policy and bloating the database.
- Location is accepted from the client without accuracy, capture time, geofence evaluation, or server normalization.
- Face enrollment uses one frame and has no explicit quality/liveness or multi-angle capture contract.
- API errors are free-form strings; mobile needs stable error codes.
- Current automated tests cover security helpers and two privacy source checks, not API behavior.

## Target structure

```text
face-attendance/
  apps/
    web/                 existing Next.js app and API
    employee-mobile/     Expo Router Android app
  packages/
    contracts/           Zod schemas, DTOs, error codes (no Prisma imports)
    config/              shared TypeScript/lint config when useful
```

If moving the existing project into a monorepo is too disruptive initially, create `mobile/` at the repository root and introduce `packages/contracts` in the second milestone. The API boundary matters more than the folder shape.

## Mobile app architecture

Use Expo Router with TypeScript and feature-oriented modules:

```text
app/
  (auth)/login.tsx
  (tabs)/index.tsx
  (tabs)/history.tsx
  (tabs)/face.tsx
  (tabs)/profile.tsx
  attendance/capture.tsx
src/
  api/          HTTP client, DTOs, error mapping
  auth/         token lifecycle and guarded navigation
  features/     attendance, history, biometrics, profile
  components/   reusable mobile UI
  storage/      SecureStore and non-sensitive preferences
  permissions/  camera/location permission orchestration
  theme/        tokens and accessible components
```

Recommended libraries:

- Expo Router for navigation and deep-link-safe route guards.
- TanStack Query for server state, retries, cache invalidation, and pagination.
- React Hook Form plus Zod for forms and boundary validation.
- `expo-secure-store` for access/refresh credentials.
- `expo-camera`, `expo-location`, `expo-image-manipulator`, and `expo-device`.
- Zustand only if genuine cross-screen client state appears; do not mirror server state into it.

The app should support Android first, use an Expo development build before face/camera QA, and keep Expo Go for early non-native UI work only.

## Mobile API v1

Add versioned endpoints rather than altering browser behavior implicitly:

| Endpoint | Purpose |
|---|---|
| `POST /api/mobile/v1/auth/login` | Employee-only login; returns short-lived access token and rotating refresh token |
| `POST /api/mobile/v1/auth/refresh` | Rotate refresh token and issue a new access token |
| `POST /api/mobile/v1/auth/logout` | Revoke the device session |
| `GET /api/mobile/v1/me` | Profile, shift, assigned site, attendance preference, biometric summary |
| `PATCH /api/mobile/v1/me` | Update allowed contact and preference fields |
| `GET /api/mobile/v1/dashboard` | Server-computed today status, next allowed actions, recent records |
| `GET /api/mobile/v1/attendance?cursor=...` | Cursor-paginated employee history |
| `POST /api/mobile/v1/attendance` | Submit face or PIN attendance with idempotency key and location evidence |
| `GET /api/mobile/v1/biometrics` | Consent version, enrollment state, expiry, alternatives |
| `POST /api/mobile/v1/biometrics/consent` | Record explicit versioned consent |
| `POST /api/mobile/v1/biometrics/enrollment` | Submit enrollment capture set |
| `DELETE /api/mobile/v1/biometrics/enrollment` | Delete template with a reason and revert to PIN |
| `GET /api/mobile/v1/locations/reverse` | Normalize coordinates into the required readable label |

Every response should use a stable envelope and machine-readable errors, for example `{ data, meta }` or `{ error: { code, message, retryable } }`. Return ISO-8601 UTC timestamps and an explicit display timezone. Decimal coordinates should be serialized as numbers or documented strings consistently.

### Authentication design

- Generate an opaque access token and refresh token; store only hashes in the database.
- Access token lifetime: about 15 minutes. Refresh lifetime: 30 days with rotation and reuse detection.
- Bind sessions to a generated installation ID and record device metadata for audit/revocation.
- Store both tokens only in SecureStore; never AsyncStorage, logs, analytics, or crash breadcrumbs.
- Keep cookie authentication unchanged for web users, but route cookie and bearer credentials through one server authentication service.
- Revoke sessions on logout and after password/account-status changes.
- Enforce HTTPS, employee role, active employment status, and rate limits on every mobile route.

The existing JWT-with-database-nonce pattern can be adapted, but opaque tokens are simpler to revoke and reduce accidental exposure of user claims.

### Attendance contract

The server should return `allowedActions` such as `CHECK_IN` or `CHECK_OUT`; the app presents those actions rather than a four-value picker. Submission should include:

- action, method, timezone, and a UUID idempotency key;
- compressed JPEG capture for face verification only;
- latitude, longitude, horizontal accuracy, and location capture timestamp;
- installation ID and app version.

The server must re-check the allowed transition, duplicate window, employment status, biometric consent/enrollment, assigned-site geofence (when configured), and time plausibility. Reverse-geocode server-side and save the normalized label. Return the authoritative attendance record and updated allowed actions.

Do not persist the submitted face image by default. Process it in memory, retain only the encrypted template for enrollment, and save restricted verification metadata. If evidentiary image retention is later required, make it a separate encrypted, access-controlled policy with a documented retention period and explicit notice.

### Capture flow

1. Explain why camera and location are needed before Android prompts appear.
2. Request camera only when the employee starts face attendance or enrollment.
3. Request foreground precise location at attendance time; never background location in phase 1.
4. Show face framing, lighting, and single-face guidance.
5. Capture, orient, resize, and compress locally; never save to the media library.
6. Show the readable detected place and accuracy state before submission.
7. Submit once using an idempotency key, then clear the in-memory image immediately.
8. On permission denial, provider failure, or poor capture, explain the remedy and keep PIN available.

Location permission should not become a hidden attendance blocker unless company policy explicitly requires it. The API should distinguish `VERIFIED`, `OUTSIDE_GEOFENCE`, `LOW_ACCURACY`, and `UNAVAILABLE` so policy can be applied transparently.

## Phase 1 screens

- Login: employee ID/email, password, lockout-safe errors.
- Home: greeting, today status, shift, assigned site, one primary next action, recent events.
- Attendance capture: action confirmation, camera, location label, progress, receipt, PIN fallback.
- History: paginated records grouped by date, event, time, location, method, status.
- Face & consent: plain-language notice, explicit consent, enrollment status/expiry, enroll/re-enroll, delete, PIN alternative.
- Profile: company-managed identity fields plus editable personal email, mobile, and preferred method.

Keep admin, payroll, reports, corrections, push notifications, offline attendance, background location, and unknown-person identification out of phase 1.

## Offline and failure policy

Do not queue biometric or PIN attendance offline in the first release: delayed submissions create fraud, ordering, and timestamp ambiguity. Cache profile and history read-only, show network state clearly, and allow retry with the same idempotency key while a request outcome is uncertain.

## Rollout plan

### 0. Contract and safety hardening (3–5 days)

- Add API v1 response/error conventions and contract tests.
- Refactor shared authentication so web cookie and mobile bearer sessions converge.
- Add token rotation, revocation, employee-role checks, rate limiting, and audit coverage.
- Stop storing face data URLs in attendance records.
- Define the attendance transition/state service and location policy.
- Confirm production face provider, liveness approach, consent wording, and retention policy.

Exit: API contract approved; privacy and threat-model review completed; web behavior remains green.

### 1. Mobile foundation (3–4 days)

- Create Expo TypeScript app, environments, navigation, theme, secure auth storage, API client, query cache, and error handling.
- Build login, session restoration, logout, profile shell, and Android permission education.

Exit: employee can sign in, restore/revoke a session, and view live profile data on a development build.

### 2. Attendance MVP (5–7 days)

- Build dashboard and next-action model.
- Implement camera capture, image normalization, foreground location, reverse geocoding, face submit, PIN fallback, receipts, and idempotent retry.
- Add device/API tests and verify captures are not retained locally or server-side.

Exit: check-in/out works end-to-end on the supported Android range under normal, denied-permission, poor-network, duplicate, and failed-match conditions.

### 3. Employee self-service (4–6 days)

- Add paginated history, profile editing, biometric consent, enrollment, expiry state, and deletion.
- Add accessibility, empty states, safe error copy, and session-expiry recovery.

Exit: all phase 1 screens pass acceptance and privacy tests.

### 4. Pilot and release hardening (5–10 business days)

- Test a representative device matrix, especially low/mid-range Android phones and weak networks.
- Add structured observability without credentials, coordinates, PINs, images, or biometric data.
- Run API load/security tests, migration rehearsal, backup/rollback check, and employee support dry run.
- Create internal AAB with EAS, staged configuration, versioning, signing, and a privacy-data declaration review.
- Pilot with 5–15 consenting employees, compare attendance outcomes with the web/PIN path, then expand gradually.

Exit: agreed reliability/error targets met, no high-severity privacy/security issues, support and rollback owners named.

## Test gates

- Unit: state transitions, error mapping, date/time formatting, location-label fallback, validation.
- API integration: token rotation/reuse, revocation, role/account enforcement, idempotency, duplicate prevention, consent gates, deletion, pagination.
- Mobile component: permission states, PIN fallback, expired session, retry behavior, destructive confirmation.
- End-to-end: login through check-in/out, face failure to PIN, enrollment/deletion, history refresh.
- Device: Android versions chosen for support, front-camera orientation, app background/restore, low memory, no GPS, slow/failed upload.
- Privacy/security: no image persistence, no sensitive logs, SecureStore use, TLS-only production, authorization object checks, rate limits.

## Decisions needed before implementation

1. Production face provider and whether reviewed liveness is mandatory at launch.
2. Whether attendance is allowed when location is unavailable or outside an assigned geofence.
3. Minimum supported Android version and target deployment channel (private/internal vs Play Store).
4. Whether employee biometric enrollment is self-service or requires HR approval.
5. Exact access/refresh lifetimes and device/session revocation UX.

## First build slice

Implement a vertical slice before polishing every screen: mobile login → dashboard → PIN check-in → refreshed status/history → logout. This validates authentication, contracts, state transitions, and release plumbing without coupling the first milestone to camera/provider uncertainty. Add face capture immediately after that foundation is proven.
