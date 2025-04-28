export function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("keyStorage", 1);
  
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains("keys")) {
          db.createObjectStore("keys", { keyPath: "id" });
        }
      };
  
      request.onerror = (event) => reject(event.target.error);
      request.onsuccess = (event) => resolve(event.target.result);
    });
  }
  
  export function savePrivateKey(privateKey) {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(["keys"], "readwrite");
        const store = transaction.objectStore("keys");
        const keyData = { id: "privateKey", key: privateKey };
  
        const request = store.put(keyData);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
      });
    });
  }
  
  export function getPrivateKey() {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(["keys"], "readonly");
        const store = transaction.objectStore("keys");
  
        const request = store.get("privateKey");
        request.onsuccess = (event) => resolve(event.target.result ? event.target.result.key : null);
        request.onerror = (event) => reject(event.target.error);
      });
    });
  }
  