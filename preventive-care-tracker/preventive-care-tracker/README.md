# Preventive Care Tracker

USPSTF A/B screenings + labs and ACIP vaccines, filtered to the individual patient.
React + Vite. Ships as a web app **and** an Android APK built automatically by GitHub.

You do **not** need Android Studio, the Android SDK, or Java on your computer.
GitHub builds the APK in the cloud; you download it and install it on your phone.

---

## What's in here

| Path | What it is |
|------|-----------|
| `src/App.jsx` | The whole app — edit rules here |
| `index.html`, `src/main.jsx` | Vite entry points |
| `capacitor.config.json` | Wraps the web app into an Android app |
| `.github/workflows/build-apk.yml` | Cloud APK build |
| `public/manifest.webmanifest`, `public/icon-*.png` | Home-screen install + icons |

---

## Part A — Put it on GitHub

1. Create a new repository at github.com (name it `preventive-care-tracker`, keep it **Private**, don't add any files).
2. In a terminal, from this folder:
   ```bash
   git init
   git add .
   git commit -m "Preventive care tracker"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/preventive-care-tracker.git
   git push -u origin main
   ```

The push triggers the build automatically.

## Part B — Get the APK

1. On GitHub, open the **Actions** tab. You'll see a run called *Build Android APK*.
2. Wait for the green check (~4–6 min the first time).
3. Click the run → scroll to **Artifacts** → download **preventive-care-apk**.
4. Unzip it — inside is `app-debug.apk`.

## Part C — Install on your Android

1. Email/AirDrop/Drive the `app-debug.apk` to your phone, or download it directly from GitHub in your phone's browser.
2. Tap it. Android will ask to allow installing from this source — allow it.
3. Because it's a debug build, you may see a "Play Protect" warning — choose **Install anyway**. (It's unsigned/self-built, not malicious — this is expected for sideloaded apps.)
4. Icon appears in your app drawer.

## Rebuilding after you change a rule

Edit `src/App.jsx`, then:
```bash
git add . && git commit -m "update rules" && git push
```
GitHub rebuilds a fresh APK. Download and reinstall (it upgrades in place).

---

## Faster alternative (no APK): install as a web app

If the APK route ever fights you, deploy `dist/` free on Vercel or Netlify (both import
straight from the GitHub repo, zero config), open the URL in Chrome on Android, then
menu → **Add to Home Screen**. Full-screen icon, works offline. Same result, less friction.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173
```

---

## Reusing this for the board planner

This scaffold is app-agnostic. To build the study planner the same way:
1. Copy this whole folder, rename it.
2. Replace `src/App.jsx` with the planner component.
3. Change `appId` / `appName` in `capacitor.config.json` (e.g. `com.jess.boardplanner`).
4. New GitHub repo, push, same Actions build.

---

**Clinical note:** personal reference tool, not validated clinical decision support.
"N yrs due" = years since the patient became eligible, not since last done — the app
stores no prior-screening history. Confirm against current USPSTF & ACIP before acting.
