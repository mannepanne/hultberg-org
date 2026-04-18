// ABOUT: RS256 JWT signing via Web Crypto for Workers runtime.
// ABOUT: Used to authenticate as a Google service account (OAuth 2.0 JWT bearer grant).

/**
 * Claims for a service-account JWT bearer assertion.
 * Matches the shape Google expects at the token endpoint.
 * See: https://developers.google.com/identity/protocols/oauth2/service-account#jwt-auth
 */
export interface ServiceAccountClaims {
  iss: string;   // service account email
  scope: string; // space-separated OAuth scopes
  aud: string;   // token endpoint (usually https://oauth2.googleapis.com/token)
  iat: number;   // seconds since epoch
  exp: number;   // seconds since epoch (max 1h after iat)
}

/**
 * Sign a JWT (header + claims) with an RS256 PEM-encoded private key.
 * Returns the encoded JWT string (header.payload.signature).
 *
 * The PEM is expected in PKCS#8 form, which is what Google's service-account
 * JSON keys use (lines start with "-----BEGIN PRIVATE KEY-----").
 */
export async function signServiceAccountJWT(
  claims: ServiceAccountClaims,
  privateKeyPem: string,
): Promise<string> {
  const encodedHeader = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const encodedClaims = base64url(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedClaims}`;

  const cryptoKey = await importPkcs8PrivateKey(privateKeyPem);

  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const encodedSignature = base64urlFromBytes(new Uint8Array(signature));
  return `${signingInput}.${encodedSignature}`;
}

/**
 * Strip PEM headers, base64-decode, and import as a PKCS#8 RSASSA private key.
 * Web Crypto wants raw DER bytes, not the PEM string.
 */
async function importPkcs8PrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  if (!body) {
    throw new Error('JWT: private key is empty after stripping PEM headers');
  }

  const binary = base64ToBytes(body);

  return crypto.subtle.importKey(
    'pkcs8',
    binary,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

function base64url(input: string): string {
  return base64urlFromBytes(new TextEncoder().encode(input));
}

function base64urlFromBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
