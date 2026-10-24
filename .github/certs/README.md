# Public database CA trust

`supabase-root-2021.crt` is the public **Supabase Root 2021 CA** certificate supplied by the operator from the project's official Supabase dashboard SSL certificate download. It contains no private key or credentials. It is used by the recovery source connection/pg_dump and the separate operator and account-retry mail dispatchers; it does not alter web application TLS settings.

- SHA-256 fingerprint: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`
- Valid from April 28, 2021 through April 26, 2031.
- CA constraint and self-signature were checked locally; the fingerprint and expiry are covered by tests.

Recovery includes this certificate with Node's default trusted roots when no nonempty RECOVERY_SOURCE_CA_PEM override is configured. Both Node and libpq retain certificate/hostname verification. Renew/rotate through a reviewed official provider CA download; never replace it with an arbitrary certificate copied from a failed connection. The operator confirmed hosted recovery run #3 at 4ac862a. New worker deployments still need their own connection/delivery evidence.
