# Test fixtures

Files in this directory are **test-only** and safe to commit.

## `test-private-key.pem` / `test-public-key.pem`

Throwaway RSA 2048-bit key pair generated at project-setup time for `tests/unit/jwt.test.ts`. Used to round-trip sign+verify the JWT output of `src/jwt.ts` against Node's `crypto`.

This key has **no authority anywhere** — it was never uploaded to any service, never used as a service account credential, and produces JWTs no remote system accepts.

**Never replace this file with a real service-account private key.** If you need to regenerate:

```bash
openssl genpkey -algorithm RSA -out tests/fixtures/test-private-key.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -in tests/fixtures/test-private-key.pem -pubout -out tests/fixtures/test-public-key.pem
```
