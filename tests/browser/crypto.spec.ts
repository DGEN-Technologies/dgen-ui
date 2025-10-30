import { test, expect } from '@playwright/test';

test.describe('CryptoService', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should encrypt and decrypt data correctly', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { CryptoService } = await import('/src/lib/cryptoService');
      const crypto = CryptoService.getInstance();
      
      const password = 'test-password-123';
      const data = { test: 'data', number: 42 };
      
      const encrypted = await crypto.encrypt(data, password);
      const decrypted = await crypto.decrypt(encrypted, password);
      
      return {
        encrypted: typeof encrypted === 'string' && encrypted.length > 0,
        decrypted: JSON.stringify(decrypted) === JSON.stringify(data)
      };
    });
    
    expect(result.encrypted).toBe(true);
    expect(result.decrypted).toBe(true);
  });

  test('should fail decryption with wrong password', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { CryptoService } = await import('/src/lib/cryptoService');
      const crypto = CryptoService.getInstance();
      
      const password = 'correct-password';
      const wrongPassword = 'wrong-password';
      const data = { secret: 'value' };
      
      const encrypted = await crypto.encrypt(data, password);
      
      try {
        await crypto.decrypt(encrypted, wrongPassword);
        return { failed: false };
      } catch (error) {
        return { failed: true, error: error.message };
      }
    });
    
    expect(result.failed).toBe(true);
  });

  test('should generate different encrypted values for same data', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { CryptoService } = await import('/src/lib/cryptoService');
      const crypto = CryptoService.getInstance();
      
      const password = 'test-password';
      const data = { test: 'data' };
      
      const encrypted1 = await crypto.encrypt(data, password);
      const encrypted2 = await crypto.encrypt(data, password);
      
      return {
        different: encrypted1 !== encrypted2,
        bothWork: JSON.stringify(await crypto.decrypt(encrypted1, password)) === JSON.stringify(data) &&
                  JSON.stringify(await crypto.decrypt(encrypted2, password)) === JSON.stringify(data)
      };
    });
    
    expect(result.different).toBe(true);
    expect(result.bothWork).toBe(true);
  });
});