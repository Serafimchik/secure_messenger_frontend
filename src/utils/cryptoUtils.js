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
      
export async function decryptMessageWithAESKey(aesKey, payload) {
  try {
    const iv = base64ToArrayBuffer(payload.iv);
    const ciphertext = base64ToArrayBuffer(payload.ciphertext);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      aesKey,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error("Ошибка при расшифровке сообщения с AES-ключом:", error);
    throw error;
  }
}

export function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function importAESKey(rawKey) {
  return await window.crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function decryptAESMessage(encryptedContent, aesKey) {
  try {
    const { iv, ciphertext } =
      typeof encryptedContent === 'string'
        ? JSON.parse(encryptedContent)
        : encryptedContent;
    const ivBuffer = base64ToArrayBuffer(iv);
    const ciphertextBuffer = base64ToArrayBuffer(ciphertext);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
      aesKey,
      ciphertextBuffer
    );

    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error("Ошибка при расшифровке сообщения:", err);
    return null;
  }
}
