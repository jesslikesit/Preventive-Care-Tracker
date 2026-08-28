# Preventive Care Tracker

USPSTF A/B screenings and labs, plus ACIP vaccines, filtered to the individual patient.

## Upload order matters

This zip deliberately contains NO files starting with a dot. Browser uploads to
GitHub handle dotfiles unreliably, and the workflow file is what builds your APK —
if it silently fails to upload, nothing works and there is no obvious error.

So: upload this folder first, then create the dotfile by hand on GitHub.

---

## Step 1 — Create the repository

github.com -> sign in -> "+" (top right) -> New repository.
- Name: preventive-care-tracker
- Private
- Do NOT check "Add a README file"
- Do NOT add a .gitignore or license
- Create repository

## Step 2 — Upload this folder's contents

On the empty repo page, click "uploading an existing file".
Open the unzipped folder, select ALL items inside it, and drag them onto the page.

Drag the CONTENTS, not the folder itself.
You should see: src, public, index.html, package.json, package-lock.json,
vite.config.js, capacitor.config.json, README.md, and two COPY-INTO-GITHUB txt files.

Scroll down, click "Commit changes".

## Step 3 — Create the workflow file on GitHub

This is the step that makes the APK build.

1. In your repo, click "Add file" -> "Create new file".
2. In the filename box, type exactly:

       .github/workflows/build-apk.yml

   As you type each "/", GitHub creates the folder automatically.
3. Open COPY-INTO-GITHUB--build-apk.yml.txt in your repo, click the copy icon,
   and paste the whole thing into the editor.
4. Click "Commit changes".

The build starts immediately.

## Step 4 — Optional but recommended: .gitignore

Repeat step 3 with the filename `.gitignore` and the contents of
COPY-INTO-GITHUB--gitignore.txt. This keeps build junk out of the repo later.

## Step 5 — Get the APK

1. Click the "Actions" tab.
2. Wait for the green check on "Build Android APK" (about 5 minutes).
3. Click the run -> scroll to "Artifacts" -> download "preventive-care-apk".
4. Unzip it. Inside is app-debug.apk.

## Step 6 — Install on Android

1. Get app-debug.apk onto your phone (email, Drive, or download it from GitHub
   directly in your phone's browser).
2. Tap it. Allow installing from this source when asked.
3. Play Protect will warn you about an unknown app. Choose "Install anyway" —
   expected for a self-built app.

## If the build fails

Actions tab -> click the failed run -> click the red step -> copy the error.
The build has not been tested end to end; the web build is verified, the Android
wrap is not.

## Changing a rule later

Everything clinical lives in src/App.jsx in the RULES array. Edit it on GitHub
directly (pencil icon), commit, and a new APK builds automatically.

## Cleanup

Once the build works you can delete the two COPY-INTO-GITHUB txt files from the
repo. They are only there to be pasted from.

---

Personal reference tool, not validated clinical decision support. The badge on each
card is the eligible age range or trigger, not a due date — the app keeps no record
of prior screening. Confirm against current USPSTF and ACIP before acting.
No patient data is stored.
