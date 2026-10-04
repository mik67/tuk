export class Store {
  constructor(db) {
    this.db = db;
  }

  static open(name = 'tuk') {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('events', { keyPath: 'id' });
        req.result.createObjectStore('meta');
      };
      req.onsuccess = () => resolve(new Store(req.result));
      req.onerror = () => reject(req.error);
    });
  }

  #run(storeName, mode, fn) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, mode);
      const req = fn(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  allEvents() { return this.#run('events', 'readonly', (s) => s.getAll()); }
  getEvent(id) { return this.#run('events', 'readonly', (s) => s.get(id)); }
  putEvent(e) { return this.#run('events', 'readwrite', (s) => s.put(e)); }
  getMeta(k) { return this.#run('meta', 'readonly', (s) => s.get(k)); }
  setMeta(k, v) { return this.#run('meta', 'readwrite', (s) => s.put(v, k)); }

  clearAll() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['events', 'meta'], 'readwrite');
      tx.objectStore('events').clear();
      tx.objectStore('meta').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
}
