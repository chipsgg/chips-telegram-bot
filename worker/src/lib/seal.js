/**
 * Seal a secret to an X25519 public key (ECDH + HKDF-SHA256 + AES-GCM), WebCrypto only so the
 * Worker (seal) and the gateway box (gateway/unseal.js, open) share it. Used once to hand the
 * Discord token to the box without it passing through anyone's laptop or chat.
 */
const X = { name: "X25519" };
const INFO = new TextEncoder().encode("chips-bot seal v1");
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function aesKey(priv, pub, salt) {
  const bits = await crypto.subtle.deriveBits({ ...X, public: pub }, priv, 256);
  const ikm = await crypto.subtle.importKey("raw", bits, "HKDF", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: INFO },
    ikm,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function newKeyPair() {
  const kp = await crypto.subtle.generateKey(X, true, ["deriveBits"]);
  return {
    pub: b64(await crypto.subtle.exportKey("raw", kp.publicKey)),
    priv: await crypto.subtle.exportKey("jwk", kp.privateKey),
  };
}

export async function seal(pubB64, text) {
  const pub = await crypto.subtle.importKey("raw", unb64(pubB64), X, false, []);
  const eph = await crypto.subtle.generateKey(X, true, ["deriveBits"]);
  const epk = await crypto.subtle.exportKey("raw", eph.publicKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await aesKey(eph.privateKey, pub, new Uint8Array(epk));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(text)
  );
  return { epk: b64(epk), iv: b64(iv), ct: b64(ct) };
}

export async function open(privJwk, { epk, iv, ct }) {
  const priv = await crypto.subtle.importKey("jwk", privJwk, X, false, [
    "deriveBits",
  ]);
  const pub = await crypto.subtle.importKey("raw", unb64(epk), X, false, []);
  const key = await aesKey(priv, pub, unb64(epk));
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(iv) },
    key,
    unb64(ct)
  );
  return new TextDecoder().decode(pt);
}
