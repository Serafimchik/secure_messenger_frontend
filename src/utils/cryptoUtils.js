export async function importPublicKey(base64Key) {
  try {
    const json = atob(base64Key);
    const jwk = JSON.parse(json);

    const key = await window.crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      true,
      ["encrypt"]
    );
    return key;
  } catch (error) {
    console.error("Ошибка импорта ключа:", error);
    throw error;
  }
}
      
export async function decryptMessage(privateKey, payload) {
  try {
    const encryptedAesKey = base64ToArrayBuffer(payload.encrypted_key);
    const iv = base64ToArrayBuffer(payload.iv);
    const ciphertext = base64ToArrayBuffer(payload.ciphertext);
    const rawAesKey = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      encryptedAesKey
    );
    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      rawAesKey,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      aesKey,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error("Ошибка при расшифровке:", error);
    throw error;
  }
}
  
export function exportKeyToBase64(key) {
  return btoa(JSON.stringify(key));
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
  
export function arrayBufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}
  