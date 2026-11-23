# Backups

Everything Unity knows lives on one Render disk at `/var/data`: `unity.json` (listings, people,
chats, accounts), `photos/`, `account-secret` (without it nobody can sign in) and `vapid.json`
(push alerts).

There are two layers of backup:

1. **Render disk snapshots.** Render snapshots the disk once a day and keeps them for a week.
   Restore one from the Render dashboard: unity → Disks → Snapshots.
2. **Nightly copy outside Render.** `.github/workflows/backup.yml` downloads an encrypted
   backup every night, checks that it opens and keeps it for 30 days as a GitHub artifact. The repo is
   public, so the file is encrypted with `UNITY_BACKUP_TOKEN`. Anyone can download it, but
   nobody can open it without the token.

## Setup (once)

1. Make a token: `openssl rand -hex 32 | pbcopy`
2. Save it in your password manager as "Unity backup token". **Lose it and the backups can't be opened.**
3. Render → unity → Environment → add `UNITY_BACKUP_TOKEN` with the token.
4. GitHub → repo Settings → Secrets and variables → Actions → New repository secret →
   `UNITY_BACKUP_TOKEN` with the same token.
5. GitHub → Actions → Nightly backup → Run workflow, to check it works now.

## Restore

1. GitHub → Actions → Nightly backup → pick a night → download the artifact and unzip it.
2. Check it: `UNITY_BACKUP_TOKEN=... node scripts/restore-backup.mjs unity-backup.bin`
3. Unpack it: `UNITY_BACKUP_TOKEN=... node scripts/restore-backup.mjs unity-backup.bin restored/`
4. Copy `restored/` onto the server's `/var/data` (Render → unity → Shell, or `scp` over Render SSH),
   then restart the service from the dashboard.

GitHub turns scheduled jobs off in a public repo after 60 days with no commits. If that
happens, Actions shows a banner. Click "Enable workflow".
