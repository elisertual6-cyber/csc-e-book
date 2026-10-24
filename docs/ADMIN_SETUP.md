# Create the hosted administrator

The manual **Create administrator account** workflow uses the existing operator CLI. It creates an ADMIN account and an audit event in one transaction. Passwords are salted and hashed using the same scrypt settings as web accounts. Duplicate emails fail without replacing passwords, changing roles or revoking existing sessions. This job does not migrate, seed content, mark email verified, publish content or enable registration, mail or GCash.

## Save credentials privately

Open [repository Actions secrets](https://github.com/elisertual6-cyber/csc-e-book/settings/secrets/actions) and add these two **repository secrets**:

| Name | Value |
| --- | --- |
| `ADMIN_BOOTSTRAP_EMAIL` | Your administrator login email |
| `ADMIN_BOOTSTRAP_PASSWORD` | A unique password of 12–128 characters, saved in your password manager |

Use an email address you control. Do not reuse the Supabase database password. The existing `DATABASE_MIGRATION_URL` secret supplies the session/direct database connection. If you reset the database password since running migrations, update that secret first. Do not put credentials in workflow inputs, commits, screenshots or chat.

## Run and sign in

1. Open [the administrator workflow](https://github.com/elisertual6-cyber/csc-e-book/actions/workflows/create-admin.yml).
2. Click **Run workflow**, select **main**, and confirm. Only trusted main-branch source is used; the job shares a concurrency lock with migrations.
3. Wait for success. Schema checks run before account creation. Command output contains only generic success/failure text; email/password values are not printed. Password input is passed on stdin, never as a process argument.
4. Open [the login page](https://csc-e-book.vercel.app/login), sign in with your saved credentials, then open [the admin workspace](https://csc-e-book.vercel.app/admin).
5. Confirm that the editorial workspace opens. This hosted login check must be performed by the operator; a green creation job alone does not verify browser cookies or APP_URL configuration.
6. Delete `ADMIN_BOOTSTRAP_PASSWORD` from GitHub after successful login. Keep the password in your password manager. You may also remove `ADMIN_BOOTSTRAP_EMAIL`. Keep `DATABASE_MIGRATION_URL` for future controlled migrations.

No redeployment is needed for a newly created database account. Keep public registration, GCash checkout and mail disabled while their release prerequisites remain incomplete. Staff access does not certify content as independently reviewed. PDF generation still needs its separately deployed browser worker and durable storage.

## If the job or login fails

The CLI reports fixed error categories without logging identities, secret values or provider exceptions: invalid email, invalid password length, existing account, hashing failure or database write failure. Email input is trimmed and lowercased; passwords are not trimmed apart from a final stdin line ending. Check the named Actions secret when a validation category appears. If the account already exists, try signing in with its original password. Re-running this workflow cannot reset it or promote an existing customer. Use the separately documented operator procedures for intentional role changes or recovery; do not delete accounts to bypass the check.

After a workflow source fix, start a **new Run workflow on main**. GitHub's **Re-run jobs** on an old run uses that old commit and will not include updated diagnostics.

If the browser reports an origin error, confirm Vercel's production `APP_URL` is exactly `https://csc-e-book.vercel.app` and redeploy after correcting it. Email verification remains pending until an authorized mail service is configured; this workflow never bypasses it.

## Validation

The disposable-database test `operator-account.spec.ts` invokes the same CLI, checks the ADMIN role and audit record, verifies hashed credentials, rejects duplicate replacement, and exercises browser login and the protected admin workspace. Synthetic accounts stay inside the generated test database. Run it through `npm run test:e2e -- operator-account.spec.ts --project=desktop` after a production build, never against hosted customer data.
