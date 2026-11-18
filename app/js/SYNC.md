# Cloud backup (optional) — your own private GitHub repo

Gym keeps all data on the phone (IndexedDB). If the browser data is cleared or the phone is replaced, it is gone.
Cloud backup copies everything to **one JSON file (`gym-backup.json`) in a private GitHub repository that you own**.
There is no Gym server: the app talks directly to `api.github.com` with a token that only you have.

## 1. Create the private repository (once)

1. Sign in at <https://github.com>.
2. Top right **+** → **New repository**.
3. **Repository name**: `gym-data` (any name works).
4. Visibility: choose **Private**. (The app refuses to connect to a public repo.)
5. Turn on **Add README** ("Add a README file"), so the repo has a `main` branch.
6. Click **Create repository**.

## 2. Create a fine-grained token limited to that repo (once)

1. Top right profile picture → **Settings**.
2. Left sidebar, at the bottom → **Developer settings**.
3. **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
4. **Token name**: `Gym backup`. **Resource owner**: your account.
5. **Expiration**: choose a date (90 days is a good choice; the app reminds you after 80 days). When it expires, backup stops with "GitHub rejected the token" and you repeat this step.
6. **Repository access** → **Only select repositories** → pick `gym-data`. (Never "All repositories".)
7. **Permissions** → **Repository permissions** → **Contents** → **Read and write**.
   GitHub adds **Metadata: Read-only** automatically. Leave everything else at **No access**.
8. **Generate token**, then copy it (it starts with `github_pat_`). GitHub shows it only once.

## 3. Connect the app

Settings → **Cloud backup** → enter `yourname/gym-data`, paste the token → **Connect**.
Then tap **Back up now**. With **Auto backup** on, the app uploads about 20 seconds after each change
(and as soon as you're back online if you were offline). Each upload is a commit named `backup <date>`,
so GitHub keeps the full history: you can open any older version of `gym-backup.json` in the repo.

## Restore on a new phone (or after clearing the browser)

1. Install/open Gym on the new phone.
2. Settings → **Cloud backup** → connect with the same repo and token (or generate a new token as in step 2).
3. Tap **Restore from cloud**. The cloud data is **merged** into the phone: workouts, sessions, notes, favourites
   and body weight are combined; nothing is deleted. On an empty phone your cloud settings are restored too.

If two phones back up to the same repo, the app merges instead of overwriting (sessions/workouts by id,
the newer edit wins). A workout deleted on one phone can reappear if the other phone still has it — just delete it again.

## Security notes

- The token is stored **only on this device** (IndexedDB) and is **never written into the backup file**.
  Disconnect removes it from the device.
- The token can only read/write files in that one repo. It cannot touch your other repos, account, or settings.
- Anyone who gets the unlocked phone could read the token from the browser's storage. If the phone is lost:
  GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → the token → **Delete**.
- Keep the repo **private**. Do not share the token, paste it in chats, or commit it anywhere.
- The data is stored unencrypted inside your private repo (GitHub encrypts it at rest, but GitHub can technically read it).
- Use an expiration date; rotating the token every 90 days is good hygiene.
