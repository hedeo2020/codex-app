# Clockwise Employee

Android-first employee attendance app built with React Native and Expo.

## Run locally

```bash
cd apps/employee-mobile
pnpm install
pnpm start
```

Without an API URL, the app runs in demo mode. Use any non-empty employee ID and a password of at least eight characters.

To connect your deployed Clockwise website backend:

```bash
EXPO_PUBLIC_API_URL=https://attendance.example.com pnpm start
```

The app now uses the existing website API routes:

- `/api/auth/login`
- `/api/auth/logout`
- `/api/employees/me`
- `/api/employees/me/attendance`
- `/api/location/reverse`

The longer mobile rollout plan is documented in [MOBILE_ARCHITECTURE_AND_ROLLOUT.md](./MOBILE_ARCHITECTURE_AND_ROLLOUT.md).
