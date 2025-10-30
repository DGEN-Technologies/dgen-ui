import { test, expect } from '@playwright/test';

test.describe('SecureStorage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear IndexedDB before each test
    await page.evaluate(() => {
      return new Promise((resolve) => {
        const deleteReq = indexedDB.deleteDatabase('dgen_secure');
        deleteReq.onsuccess = () => resolve(true);
        deleteReq.onerror = () => resolve(false);
      });
    });
  });

  test('should initialize and unlock storage', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { SecureStorage } = await import('/src/lib/secureStorage');
      const storage = SecureStorage.getInstance();
      
      await storage.init();
      const unlocked = await storage.unlock('test-password');
      const isUnlocked = storage.isUnlocked();
      
      return { unlocked, isUnlocked };
    });
    
    expect(result.unlocked).toBe(true);
    expect(result.isUnlocked).toBe(true);
  });

  test('should store and retrieve encrypted data', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { SecureStorage } = await import('/src/lib/secureStorage');
      const storage = SecureStorage.getInstance();
      
      await storage.init();
      await storage.unlock('test-password');
      
      const testData = { mnemonic: 'test seed phrase words here', userId: 'user123' };
      await storage.store('test-key', JSON.stringify(testData));
      const retrievedStr = await storage.retrieve('test-key');
      const retrieved = retrievedStr ? JSON.parse(retrievedStr) : null;
      
      return {
        stored: true,
        matches: JSON.stringify(retrieved) === JSON.stringify(testData)
      };
    });
    
    expect(result.stored).toBe(true);
    expect(result.matches).toBe(true);
  });

  test('should auto-lock after timeout', async ({ page }) => {
    await page.evaluate(async () => {
      const { SecureStorage } = await import('/src/lib/secureStorage');
      const storage = SecureStorage.getInstance();
      
      // Override timeout for testing
      (storage as any).LOCK_TIMEOUT = 100; // 100ms for testing
      
      await storage.init();
      await storage.unlock('test-password');
    });
    
    // Wait for auto-lock
    await page.waitForTimeout(150);
    
    const result = await page.evaluate(async () => {
      const { SecureStorage } = await import('/src/lib/secureStorage');
      const storage = SecureStorage.getInstance();
      return storage.isUnlocked();
    });
    
    expect(result).toBe(false);
  });

  test('should require unlock after lock', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { SecureStorage } = await import('/src/lib/secureStorage');
      const storage = SecureStorage.getInstance();
      
      await storage.init();
      await storage.unlock('test-password');
      await storage.store('data', JSON.stringify({ value: 'secret' }));
      
      storage.lock();
      
      try {
        await storage.retrieve('data');
        return { error: false };
      } catch (error) {
        return { error: true, message: error.message };
      }
    });
    
    expect(result.error).toBe(true);
    expect(result.message).toContain('Storage locked');
  });

  test('should persist data across sessions with same password', async ({ page }) => {
    // First session - store data
    await page.evaluate(async () => {
      const { SecureStorage } = await import('/src/lib/secureStorage');
      const storage = SecureStorage.getInstance();
      
      await storage.init();
      await storage.unlock('persistent-password');
      await storage.store('persistent', JSON.stringify({ data: 'should persist' }));
      storage.lock();
    });
    
    // Second session - retrieve data
    const result = await page.evaluate(async () => {
      const { SecureStorage } = await import('/src/lib/secureStorage');
      const storage = SecureStorage.getInstance();
      
      await storage.init();
      await storage.unlock('persistent-password');
      const dataStr = await storage.retrieve('persistent');
      const data = dataStr ? JSON.parse(dataStr) : null;
      
      return { retrieved: data };
    });
    
    expect(result.retrieved).toEqual({ data: 'should persist' });
  });

  test('should fail to retrieve with wrong password', async ({ page }) => {
    // Store with one password
    await page.evaluate(async () => {
      const { SecureStorage } = await import('/src/lib/secureStorage');
      const storage = SecureStorage.getInstance();
      
      await storage.init();
      await storage.unlock('correct-password');
      await storage.store('secret', JSON.stringify({ value: 'hidden' }));
      storage.lock();
    });
    
    // Try to retrieve with different password
    const result = await page.evaluate(async () => {
      const { SecureStorage } = await import('/src/lib/secureStorage');
      const storage = SecureStorage.getInstance();
      
      await storage.init();
      await storage.unlock('wrong-password');
      
      const data = await storage.retrieve('secret');
      // With wrong password, decryption should fail and return null
      return { data };
    });
    
    expect(result.data).toBe(null);
  });
});