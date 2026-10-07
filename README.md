# Expo SDK 57 sample project

An empty Expo TypeScript application linked to `@yast-ai/expo-sample-project`.

```sh
bun install
bun start
bun run build:preview:android
```

The preview profile creates a signed Android release APK with local EAS Build. `expo` and `eas-cli` are repository dependencies. Expo authentication uses `EXPO_TOKEN` or your existing EAS CLI login. Native JDK/Android SDK/NDK tooling is required for local builds.

## Boat build through Convex

The `backend/` directory contains the separate `yast-ai` Convex cloud project `expo-sample-builds`. Its only public function, `android:runBuild`, takes no arguments and requires no auth.

```sh
cd backend
bun install
bunx convex dev --once
bunx convex run android:runBuild
```

It creates a Boat VM, runs a 19-line setup script, and saves timestamped build logs through scheduled polling every 15 seconds. It stores the APK before stopping the VM. See [backend/README.md](backend/README.md) for the build schema and status helper.

Set `EXPO_TOKEN` and a dedicated `BOAT_API_KEY` in the Convex deployment. Credentials and APKs are excluded from Git. This is an intentionally unauthenticated sample.
