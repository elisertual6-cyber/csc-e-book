# Connect Supabase to the Vercel app

The repository now includes a manually triggered migration workflow. Hosted migrations have not been run from this cloud conversation: Supabase and Vercel connectors are not attached here. Successful connector access in another chat does not configure this app's database connection.

## 1. Save the migration connection privately

In Supabase, open **Connect → Direct**, then select **Session pooler**, URI format, port **5432**. Use the complete connection string provided for your project, replacing the password placeholder with your database password. Percent-encode special characters in the password. Preserve the provider's TLS settings; do not disable certificate verification. A direct port-5432 connection also works when reachable from the runner. Do not use the transaction pooler's port 6543 for migrations.

In [GitHub repository settings](https://github.com/elisertual6-cyber/csc-e-book/settings/secrets/actions), choose **New repository secret**:

| Name | Value |
| --- | --- |
| `DATABASE_MIGRATION_URL` | The complete private session/direct connection URI |

Save this in GitHub's secret form, never in a commit, screenshot or chat message. Supabase publishable, anon and service-role API keys are not PostgreSQL connection strings. Confirm the URI targets the intended Supabase project before saving it. Back up an existing database before a release.

## 2. Apply the schema

Open [GitHub Actions](https://github.com/elisertual6-cyber/csc-e-book/actions), select **Apply database migrations**, choose **Run workflow**, and select **main**. Enable Actions if GitHub prompts you.

The workflow installs locked dependencies, runs `prisma migrate deploy`, and verifies eight migration checksums and row-level security on 28 app tables plus the Prisma history table. It runs only when manually requested on main. It does not reset the database, seed content, create an administrator, approve questions, activate products, or enable payments. Do not change Vercel's build command to migrate automatically.

Prisma retains its migration ledger. Do not separately apply these same SQL files through an MCP migration tool or SQL Editor without an explicit Prisma baselining plan. If a migration fails, investigate its state before retrying; do not use `migrate reset` against hosted data. Migration command output is kept in the runner's temporary directory and is not uploaded or printed, because provider errors can contain connection details. A generic failure requires a private operator investigation.

## 3. Configure Vercel's runtime connection

In Supabase **Connect**, copy the **Transaction pooler** URI on port **6543**, with the password correctly encoded. In Vercel → csc-e-book → **Settings → Environment Variables**, add it as server-only `DATABASE_URL` for **Production**. Use the provider-supplied connection settings. Never prefix this secret with `NEXT_PUBLIC_`. Runtime code uses `DATABASE_URL`; the optional `DIRECT_URL` is reserved for CLI migrations.

Set `APP_URL` to the stable HTTPS domain assigned to your Vercel project, then redeploy. Avoid a disposable deployment URL for the permanent application origin. Keep these values while infrastructure and launch checks remain incomplete:

```dotenv
REGISTRATION_ENABLED=false
GCASH_CHECKOUT_ENABLED=false
MAIL_TRANSPORT=disabled
```

Use a separate test database or Supabase branch for Preview deployments. Do not point previews or browser tests at the customer database. A successful `/api/health` checks connectivity only; the migration workflow checks the schema separately. Test a protected app operation before enabling accounts.

## Private tables and authentication

After migration and runtime connectivity are confirmed, follow [ADMIN_SETUP.md](ADMIN_SETUP.md) to create the operator account using a separate manual workflow. A successful health check does not create an account.

This application uses its existing server-side authentication and Prisma authorization. No Supabase browser SDK or Supabase Auth migration is needed. The eighth migration enables row-level security and revokes PUBLIC, anon and authenticated grants on the app tables and migration ledger. It creates no browser-access policies. The server's table-owner connection retains access. A future dedicated non-owner runtime role needs explicitly reviewed grants and RLS policies; do not solve access errors by granting browser roles access to private records. New application tables must receive equivalent protection in their own migration.

Paid files, PDF/mail workers, real SMTP and PayMongo merchant sandbox verification still need separate deployment work. GCash remains disabled in production. Creating the tables does not complete the content review or commerce launch gates.

## Local verification

`npm run db:check-schema` verifies the current migration connection without printing records or connection details. `npm run test:e2e` creates a disposable database and overrides both DATABASE_URL and DIRECT_URL for child commands. Its database-policy test creates and removes a random NOLOGIN role inside that isolated run; the local test administrator therefore needs CREATEROLE as well as CREATEDB. Never grant those privileges to a hosted application runtime merely to run this test.
