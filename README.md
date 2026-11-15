# CV World Job Sync

This repository runs a scheduled job synchronizer for the CV World mobile app. It discovers supported public employer ATS boards, writes verified active jobs to the existing Firestore `jobs` collection, and sends a OneSignal push when newly discovered jobs are added.

Firebase Cloud Functions are not used by this workflow. GitHub Actions runs the schedule; Firestore remains the app's live data source. Keep usage within the Firebase Spark plan quotas to avoid billing.

## Schedule

Runs daily at 09:00, 15:00, and 21:00 Qatar time (06:00, 12:00, and 18:00 UTC). A manual run defaults to dry-run and does not write jobs or send pushes.

## Required GitHub Actions secrets

- `FIREBASE_SERVICE_ACCOUNT`: service-account JSON (or base64-encoded JSON) with Firestore access.
- `ONESIGNAL_REST_API_KEY`: OneSignal REST API key for the CV World OneSignal app.

The OneSignal App ID is configured in the workflow. Never commit service-account JSON, API keys, or access tokens.

## Job sources

The synchronizer uses public SmartRecruiters, Greenhouse, Lever, and Ashby job-board APIs. It discovers additional boards from existing active jobs and includes a small set of seed boards. Only results with a supported official ATS apply URL and a matching Qatar, UAE, or Saudi location are written.

Government hiring portals that do not publish through these ATS providers need a dedicated source connector; this workflow does not claim to cover every government vacancy.

## Verify

Open **Actions → CV World Job Sync and Push → Run workflow** and leave dry-run set to true first. After confirming source results, run with dry-run false. Check the run logs and OneSignal recipient count.