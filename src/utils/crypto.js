import { savePrivateKey } from './indexedDB';

export async function generateKeyPair() {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API недоступен');
  }
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
  const publicKeyJwk = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
  await savePrivateKey(keyPair.privateKey);
  const publicKeyBase64 = jwkToBase64(publicKeyJwk);
  return publicKeyBase64;
}

function jwkToBase64(jwk) {
  const json = JSON.stringify(jwk);
  const base64 = btoa(json);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); 
}
