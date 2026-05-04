# NACSA Attendance — Setup Guide

## Prerequisites
- Node.js 18+
- EAS CLI: `npm install -g eas-cli`
- Expo account (free): https://expo.dev

## Install dependencies
```bash
npm install
```

## Run on device (requires custom dev build — Expo Go won't work)

### 1. Create a development build (once)
```bash
eas build --profile development --platform android
# or
eas build --profile development --platform ios
```

Install the resulting APK/IPA on your device.

### 2. Start the dev server
```bash
npx expo start --dev-client
```

Scan the QR code with the installed dev build app.

---

## Project structure

```
src/
  data/staffDirectory.ts   ← Staff ID → Name lookup (update with real staff)
  screens/
    HomeScreen.tsx         ← Time display + Start Clock button
    CameraScreen.tsx       ← Face detection (recognize or enroll modes)
    ManualIDScreen.tsx     ← 6-digit numeric input + keypad
    ConfirmationScreen.tsx ← Review + confirm clock event
  utils/
    storage.ts             ← AsyncStorage helpers
    clockLogic.ts          ← Next event type logic
    faceMatching.ts        ← Geometric face fingerprint matching
  types/index.ts           ← Shared TypeScript types
  theme/colors.ts          ← Dark theme tokens
```

## Adding real staff
Edit `src/data/staffDirectory.ts` — add each staff member's ID and name.

## Clock event sequence (per day, per staff)
1. Clock In (Arrival)
2. Clock Out (Lunch)
3. Clock In (Lunch Return)
4. Clock Out (End of Day)

## Face recognition notes
Uses geometric landmark ratios (eye distance, nose position, etc.) extracted
by `react-native-vision-camera-face-detector` for on-device matching.
Not ML-grade but reliable for a small known team.

First clock: staff enters ID → camera captures face template → confirmed.
Subsequent clocks: camera auto-matches → jumps straight to confirmation.
