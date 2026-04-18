// ABOUT: Unit tests for RS256 JWT signing.
// ABOUT: Round-trips with a throwaway RSA keypair fixture to verify signature correctness.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createVerify } from 'node:crypto';
import { join } from 'node:path';
import { signServiceAccountJWT, type ServiceAccountClaims } from '@/jwt';

const FIXTURE_DIR = join(__dirname, '..', 'fixtures');
const privateKeyPem = readFileSync(join(FIXTURE_DIR, 'test-private-key.pem'), 'utf8');
const publicKeyPem = readFileSync(join(FIXTURE_DIR, 'test-public-key.pem'), 'utf8');

const baseClaims: ServiceAccountClaims = {
  iss: 'test-account@example.iam.gserviceaccount.com',
  scope: 'https://www.googleapis.com/auth/webmasters.readonly',
  aud: 'https://oauth2.googleapis.com/token',
  iat: 1_700_000_000,
  exp: 1_700_003_600,
};

function b64urlToBuffer(b64url: string): Buffer {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

describe('signServiceAccountJWT', () => {
  it('produces a three-part JWT with header, payload, and signature', async () => {
    const jwt = await signServiceAccountJWT(baseClaims, privateKeyPem);
    const parts = jwt.split('.');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBeTruthy();
    expect(parts[1]).toBeTruthy();
    expect(parts[2]).toBeTruthy();
  });

  it('encodes the header as {alg:RS256, typ:JWT}', async () => {
    const jwt = await signServiceAccountJWT(baseClaims, privateKeyPem);
    const header = JSON.parse(b64urlToBuffer(jwt.split('.')[0]).toString('utf8'));
    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' });
  });

  it('encodes the provided claims as the payload', async () => {
    const jwt = await signServiceAccountJWT(baseClaims, privateKeyPem);
    const payload = JSON.parse(b64urlToBuffer(jwt.split('.')[1]).toString('utf8'));
    expect(payload).toEqual(baseClaims);
  });

  it('produces a signature that the matching public key can verify', async () => {
    const jwt = await signServiceAccountJWT(baseClaims, privateKeyPem);
    const [header, payload, signature] = jwt.split('.');
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${header}.${payload}`);
    const ok = verifier.verify(publicKeyPem, b64urlToBuffer(signature));
    expect(ok).toBe(true);
  });

  it('produces different signatures for different claims', async () => {
    const jwtA = await signServiceAccountJWT(baseClaims, privateKeyPem);
    const jwtB = await signServiceAccountJWT({ ...baseClaims, iat: baseClaims.iat + 1, exp: baseClaims.exp + 1 }, privateKeyPem);
    expect(jwtA.split('.')[2]).not.toBe(jwtB.split('.')[2]);
  });

  it('throws a clear error when the PEM body is empty', async () => {
    const emptyPem = '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----';
    await expect(signServiceAccountJWT(baseClaims, emptyPem)).rejects.toThrow(/private key is empty/);
  });

  it('throws when the private key is not valid PKCS8', async () => {
    const junk = '-----BEGIN PRIVATE KEY-----\nnot-real-base64\n-----END PRIVATE KEY-----';
    await expect(signServiceAccountJWT(baseClaims, junk)).rejects.toThrow();
  });
});
