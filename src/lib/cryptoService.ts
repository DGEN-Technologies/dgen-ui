const ITERATIONS = 100000;
const SALT_LENGTH = 32;
const IV_LENGTH = 12;

export class CryptoService {
  private static instance: CryptoService;
  
  private constructor() {
    if (typeof window !== 'undefined' && !window.crypto?.subtle) {
      throw new Error('Web Crypto API not available');
    }
  }

  static getInstance(): CryptoService {
    if (!CryptoService.instance) {
      CryptoService.instance = new CryptoService();
    }
    return CryptoService.instance;
  }

  generateSalt(): Uint8Array {
    const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
    return cryptoObj.getRandomValues(new Uint8Array(SALT_LENGTH));
  }

  generateIV(): Uint8Array {
    const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
    return cryptoObj.getRandomValues(new Uint8Array(IV_LENGTH));
  }

  async deriveKey(
    password: string,
    salt: Uint8Array,
    iterations: number = ITERATIONS
  ): Promise<CryptoKey> {
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
        iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private async encryptRaw(
    plaintext: string,
    password: string,
    salt?: Uint8Array
  ): Promise<{
    ciphertext: Uint8Array;
    salt: Uint8Array;
    iv: Uint8Array;
  }> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    
    const useSalt = salt || this.generateSalt();
    const iv = this.generateIV();
    const key = await this.deriveKey(password, useSalt);
    
    const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
    const encrypted = await cryptoObj.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    return {
      ciphertext: new Uint8Array(encrypted),
      salt: useSalt,
      iv
    };
  }

  private async decryptRaw(
    ciphertext: Uint8Array,
    password: string,
    salt: Uint8Array,
    iv: Uint8Array
  ): Promise<string> {
    const key = await this.deriveKey(password, salt);
    
    const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
    const decrypted = await cryptoObj.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  packEncrypted(
    ciphertext: Uint8Array,
    salt: Uint8Array,
    iv: Uint8Array
  ): string {
    const combined = new Uint8Array(
      salt.length + iv.length + ciphertext.length
    );
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(ciphertext, salt.length + iv.length);
    
    return btoa(String.fromCharCode(...combined));
  }

  unpackEncrypted(packed: string): {
    ciphertext: Uint8Array;
    salt: Uint8Array;
    iv: Uint8Array;
  } {
    const combined = new Uint8Array(
      atob(packed).split('').map(c => c.charCodeAt(0))
    );
    
    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);
    
    return { ciphertext, salt, iv };
  }

  async encryptPacked(
    plaintext: string,
    password: string
  ): Promise<string> {
    const { ciphertext, salt, iv } = await this.encryptRaw(plaintext, password);
    return this.packEncrypted(ciphertext, salt, iv);
  }

  async decryptPacked(
    packed: string,
    password: string
  ): Promise<string> {
    const { ciphertext, salt, iv } = this.unpackEncrypted(packed);
    return this.decryptRaw(ciphertext, password, salt, iv);
  }

  clearSensitive(data: any): void {
    if (typeof data === 'string') {
      data = '\0'.repeat(data.length);
    } else if (data instanceof Uint8Array) {
      data.fill(0);
    }
  }

  validateEncryptionFormat(data: string): boolean {
    try {
      const decoded = atob(data);
      return decoded.length >= SALT_LENGTH + IV_LENGTH + 1;
    } catch {
      return false;
    }
  }

  // Public API for tests
  async encrypt(data: any, password: string): Promise<string> {
    const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
    return this.encryptPacked(plaintext, password);
  }

  async decrypt(encrypted: string, password: string): Promise<any> {
    const plaintext = await this.decryptPacked(encrypted, password);
    try {
      return JSON.parse(plaintext);
    } catch {
      return plaintext;
    }
  }
}

export const cryptoService = CryptoService.getInstance();