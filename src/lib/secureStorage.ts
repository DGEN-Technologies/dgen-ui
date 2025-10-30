export class SecureStorage {
  private static instance: SecureStorage;
  private db: IDBDatabase | null = null;
  private encryptionKey: CryptoKey | null = null;
  private lockTimer: number | null = null;
  private readonly DB_NAME = 'dgen_secure';
  private readonly STORE_NAME = 'vault';
  private lockTimeout: number = 15 * 60 * 1000; // Default: 15 minutes

  private constructor() {}

  static getInstance(): SecureStorage {
    if (!SecureStorage.instance) {
      SecureStorage.instance = new SecureStorage();
    }
    return SecureStorage.instance;
  }

  async init(): Promise<void> {
    if (!this.checkBrowserSupport()) {
      throw new Error('Browser does not support required crypto APIs');
    }

    if (typeof indexedDB === 'undefined') {
      console.warn('IndexedDB not available in test environment');
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);
      
      request.onerror = () => reject(new Error('Failed to open database'));
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };
    });
  }

  private checkBrowserSupport(): boolean {
    if (typeof window === 'undefined') {
      return typeof globalThis.crypto?.subtle !== 'undefined';
    }
    return !!(window.crypto?.subtle && window.indexedDB);
  }

  async unlock(password: string, userId?: string): Promise<boolean> {
    // Use user-specific salt for better isolation
    const saltKey = userId ? `salt_${userId}` : 'salt';
    const salt = await this.getSalt(saltKey);
    this.encryptionKey = await this.deriveKey(password, salt);
    this.resetLockTimer();
    return true;
  }

  async lock(): void {
    this.encryptionKey = null;
    if (this.lockTimer) {
      clearTimeout(this.lockTimer);
      this.lockTimer = null;
    }
    this.clearMemory();
  }

  private clearMemory(): void {
    if (typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
  }

  private resetLockTimer(): void {
    if (this.lockTimer) clearTimeout(this.lockTimer);
    this.lockTimer = window.setTimeout(() => this.lock(), this.lockTimeout);
  }

  // Set lock timeout (in milliseconds)
  setLockTimeout(milliseconds: number): void {
    this.lockTimeout = milliseconds;
    // Reset timer with new timeout if already running
    if (this.encryptionKey && this.lockTimer) {
      this.resetLockTimer();
    }
  }

  // Get current lock timeout
  getLockTimeout(): number {
    return this.lockTimeout;
  }

  private async getSalt(saltKey: string = 'salt'): Promise<Uint8Array> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(saltKey);
      
      request.onsuccess = async () => {
        if (request.result) {
          resolve(new Uint8Array(request.result));
        } else {
          const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
          const salt = cryptoObj.getRandomValues(new Uint8Array(16));
          await this.storeSalt(salt, saltKey);
          resolve(salt);
        }
      };
      
      request.onerror = () => reject(new Error('Failed to get salt'));
    });
  }

  private async storeSalt(salt: Uint8Array, saltKey: string = 'salt'): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put(Array.from(salt), saltKey);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to store salt'));
    });
  }

  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
    const encoder = new TextEncoder();
    const keyMaterial = await cryptoObj.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return cryptoObj.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async store(key: string, value: string): Promise<void> {
    if (!this.encryptionKey) throw new Error('Storage locked');
    if (!this.db) throw new Error('Database not initialized');
    
    this.resetLockTimer();
    
    const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
    const iv = cryptoObj.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    
    const encrypted = await cryptoObj.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      encoder.encode(value)
    );
    
    const data = {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encrypted))
    };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put(data, key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to store data'));
    });
  }

  async retrieve(key: string): Promise<string | null> {
    if (!this.encryptionKey) throw new Error('Storage locked');
    if (!this.db) throw new Error('Database not initialized');
    
    this.resetLockTimer();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(key);
      
      request.onsuccess = async () => {
        if (!request.result || !request.result.iv || !request.result.data) {
          resolve(null);
          return;
        }
        
        try {
          const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
          const decrypted = await cryptoObj.subtle.decrypt(
            {
              name: 'AES-GCM',
              iv: new Uint8Array(request.result.iv)
            },
            this.encryptionKey!,
            new Uint8Array(request.result.data)
          );
          
          const decoder = new TextDecoder();
          resolve(decoder.decode(decrypted));
        } catch {
          resolve(null);
        }
      };
      
      request.onerror = () => reject(new Error('Failed to retrieve data'));
    });
  }

  async remove(key: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to remove data'));
    });
  }

  isUnlocked(): boolean {
    return this.encryptionKey !== null;
  }
}

export const secureStorage = SecureStorage.getInstance();