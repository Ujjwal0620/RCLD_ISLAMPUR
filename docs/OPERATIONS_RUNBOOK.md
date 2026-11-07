# Operations runbook

This is the practical checklist for setting up a local copy, configuring integrations, verifying a release and recovering from a bad application change.

## Local prerequisites

- Node.js compatible with the Next.js version in package.json.
- npm.
- A running MongoDB instance or a reachable MongoDB Atlas cluster.
- Cloudinary account credentials for upload workflows.

## Local setup

From the repository root:

1. Install dependencies with npm install.
2. Copy .env.example to .env.local.
3. Set MONGODB_URI and AUTH_SECRET.
4. Set Cloudinary credentials if testing uploads.
5. Run npm run dev.
6. Open http://localhost:3000.

If MONGODB_URI is omitted in development, lib/mongodb.js falls back to mongodb://127.0.0.1:27017/rcld_islampur. Production has no such fallback and must define MONGODB_URI.

NEXT_PUBLIC_APP_URL is present in the sample environment but is not required for the MongoDB connection or standard local startup. Do not add dependencies on this variable without a specific reason.

## Environment variables

| Variable | Purpose | Required |
|---|---|---|
| MONGODB_URI | MongoDB connection string | Yes in production; optional for local fallback |
| AUTH_SECRET | JWT signing secret | Must be explicitly set to a strong random value in every deployed environment |
| CLOUDINARY_CLOUD_NAME | Cloudinary cloud name | Required for Cloudinary uploads when not using CLOUDINARY_URL |
| CLOUDINARY_API_KEY | Cloudinary API key | Required for Cloudinary uploads when not using CLOUDINARY_URL |
| CLOUDINARY_API_SECRET | Cloudinary API secret | Required for Cloudinary uploads when not using CLOUDINARY_URL |
| CLOUDINARY_URL | Alternative Cloudinary connection string | Optional alternative; do not mix mismatched account credentials |
| NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME | Public cloud name for browser-side integrations, if used | Optional |
| NEXT_PUBLIC_APP_NAME | Display name | Optional |
| NEXT_PUBLIC_APP_URL | Public application URL | Optional for normal local startup |
| PHONEPE_MERCHANT_ID | PhonePe merchant identifier | Placeholder only until gateway integration is implemented |
| PHONEPE_SALT_KEY | PhonePe signing secret | Placeholder only; never expose to browser |
| PHONEPE_SALT_INDEX | PhonePe key index | Placeholder only |
| PHONEPE_ENV | Gateway environment label | Sample defaults to SANDBOX; integration must be verified |
| GROQ_API_KEY | AI provider credential | Optional; needed only for configured AI features |
| GROQ_MODEL | AI model identifier | Optional |

Never commit .env, .env.local or production secrets. Do not paste API secrets into chat, issue trackers or screenshots.

## Cloudinary troubleshooting

The Cloudinary helper reads credentials at request time. It accepts either the three standard variables or CLOUDINARY_URL. When individual variables are populated, they take precedence.

If an upload returns Invalid Signature:
1. Confirm Cloud Name, API Key and API Secret belong to the same Cloudinary account/key.
2. Rotate the API Secret in Cloudinary if it may have been exposed.
3. Remove stale duplicate values from .env.local.
4. Restart the Next.js development server.
5. Retry with a small supported image.
6. Review the server response detail without exposing credentials.

An Invalid Signature response normally indicates a credential/signature mismatch, not a problem with the image itself.

## Development commands

- npm run dev — development server.
- npm run lint — ESLint.
- npm run build — production compilation.
- npm run start — starts a previously built production application.
- npm run import:students — runs the student import script using Node's --env-file support; review the script and target database before running.

Do not run import, seed, migration or cleanup scripts against production until the target URI and data filter have been checked.

## Release checklist

Before deploying:
1. Confirm the repository and intended commit.
2. Review the diff and the implementation audit.
3. Confirm all required environment variables are configured in the hosting provider.
4. Ensure AUTH_SECRET and Super Admin credentials are not source-code defaults.
5. Confirm production MongoDB is reachable and backed up.
6. Confirm Cloudinary credentials are from the intended account.
7. Protect development endpoints.
8. Run npm run lint and npm run build.
9. Test login/logout and the key workflows against a production-like database.
10. Verify role restrictions and direct API access.
11. Verify student fee calculations and receipt output.
12. Create or record a restore point.
13. Deploy and run smoke tests.
14. Record the deployed commit SHA and any known limitations.

A green deployment alone does not replace workflow testing.

## Application restore

The Git restore branch recorded in docs/RESTORE_POINTS.md preserves the application source at the named commit. To restore the source:
1. Inspect the restore branch and compare it with main.
2. Prefer a revert commit for a targeted bad change.
3. For a full source rollback, move main only through a reviewed, explicit Git operation. Do not force-push casually.
4. Remember that restoring source code does not restore MongoDB data or Cloudinary assets.

Local update commands:

- git checkout main
- git pull --ff-only origin main

Start locally with npm run dev.

## Database backup and recovery

Application Git branches do not back up the MongoDB database. Before migrations or bulk changes, take a MongoDB backup using the database provider's supported backup/export process. Keep backups access-controlled and encrypted. Verify restore procedures on a non-production database.

For Atlas, use the provider's backup/snapshot or mongodump workflow appropriate to the cluster. For local MongoDB, use mongodump/mongorestore with the correct database name. Never publish a dump containing student or employee personal data.

Before restoring a database:
- stop writes or place the application in maintenance mode;
- identify the exact backup and target database;
- restore to a separate database first when possible;
- verify collection counts and sample documents;
- confirm fees, receipts, attendance and batch histories;
- switch the application only after the restored data is accepted.

## Incident notes

When investigating a production issue, record:
- timestamp and affected workflow;
- deployed commit SHA;
- affected user role and record type (avoid storing unnecessary personal data);
- request path and safe error details;
- whether the database or Cloudinary was affected;
- mitigation and recovery steps;
- follow-up test and documentation update.
