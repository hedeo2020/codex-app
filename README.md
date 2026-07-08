# Clockwise Employee

Android-first employee attendance app built with React Native and Expo.

## Run locally

```bash
cd apps/employee-mobile
pnpm install
pnpm start
```

Without an API URL, the app runs in demo mode. Use any non-empty employee ID and a password of at least eight characters.

To connect the mobile backend:

```bash
EXPO_PUBLIC_API_URL=https://attendance.example.com pnpm start
```

The expected endpoints are documented in [MOBILE_ARCHITECTURE_AND_ROLLOUT.md](./MOBILE_ARCHITECTURE_AND_ROLLOUT.md).

