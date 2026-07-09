# Clockwise Employee

Android-first employee attendance app built with React Native and Expo.

## Run locally

```bash
pnpm install
pnpm start
```

The repository root is now a valid Expo app entrypoint for AI Studio and GitHub-based builders. The app source still lives in `apps/employee-mobile`.

The app defaults to `https://register.3dbpoint.com`. On first launch, you can keep that URL or edit it on the login screen, then sign in with a real employee ID or email and password. The app saves that URL on the device for later launches.

You can also bake the website URL into the app while developing:

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
