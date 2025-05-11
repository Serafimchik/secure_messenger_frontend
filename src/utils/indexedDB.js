export function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("SecureMessenger", 2);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("keys")) {
          db.createObjectStore("keys", { keyPath: "id" });
        }
      };
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
}
  
export async function savePrivateKey(privateKey) {
    try {
      const jwkKey = await window.crypto.subtle.exportKey("jwk", privateKey);
      const keyData = { id: "privateKey", key: jwkKey };
  
      const db = await openDB();
      const transaction = db.transaction(["keys"], "readwrite");
      const store = transaction.objectStore("keys");
  
      await new Promise((resolve, reject) => {
        const request = store.put(keyData);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
      });
  
      await transaction.done?.(); 
    } catch (error) {
      console.error("Ошибка при сохранении приватного ключа:", error);
      throw error;
    }
  }
  
  
export async function exportPrivateKey(privateKey) {
    try {
      const exportedKey = await window.crypto.subtle.exportKey("jwk", privateKey);
      return exportedKey;
    } catch (error) {
      console.error("Ошибка экспорта приватного ключа:", error);
      throw error;
    }
}

export async function loadPrivateKey() {
    try {
      const db = await openDB();
  
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(["keys"], "readonly");
        const store = transaction.objectStore("keys");
  
        const request = store.get("privateKey");
        request.onsuccess = () => {
          const keyData = request.result?.key;
          if (!keyData) {
            reject(new Error("Приватный ключ не найден"));
            return;
          }
          window.crypto.subtle
            .importKey(
              "jwk",
              keyData,
              {
                name: "RSA-OAEP",
                hash: "SHA-256",
              },
              true,
              ["decrypt"]
            )
            .then((privateKey) => resolve(privateKey))
            .catch((error) => reject(error));
        };
  
        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("Ошибка при загрузке приватного ключа:", error);
      throw error;
    }
}