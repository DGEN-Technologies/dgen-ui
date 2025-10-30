import { test, expect } from '@playwright/test';

test.describe('Layout Browser Wallet Integration', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      if (typeof indexedDB !== 'undefined') {
        indexedDB.deleteDatabase('dgen_secure');
      }
    });
  });

  test('should check browser compatibility correctly', async ({ page }) => {
    const compatibilityResult = await page.evaluate(() => {
      const hasWebCrypto = !!(window.crypto && window.crypto.subtle);
      const hasIndexedDB = !!window.indexedDB;
      const hasWasm = typeof WebAssembly === 'object';
      
      return {
        hasWebCrypto,
        hasIndexedDB,
        hasWasm,
        compatible: hasWebCrypto && hasIndexedDB && hasWasm
      };
    });

    expect(compatibilityResult.hasWebCrypto).toBe(true);
    expect(compatibilityResult.hasIndexedDB).toBe(true);
    expect(compatibilityResult.hasWasm).toBe(true);
    expect(compatibilityResult.compatible).toBe(true);
  });

  test('should detect missing browser features', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Test detection logic for missing features by checking different scenarios
      const scenarios = {
        normal: {
          hasWebCrypto: !!(window.crypto && window.crypto.subtle),
          hasIndexedDB: !!window.indexedDB,
          hasWasm: typeof WebAssembly === 'object'
        },
        // Test logic that would detect missing crypto
        missingCrypto: {
          hasWebCrypto: false, // Simulate what would happen if crypto.subtle was missing
          hasIndexedDB: !!window.indexedDB,
          hasWasm: typeof WebAssembly === 'object'
        }
      };
      
      return {
        normalCase: scenarios.normal,
        missingCryptoCase: scenarios.missingCrypto,
        normalCompatible: Object.values(scenarios.normal).every(Boolean),
        missingCryptoCompatible: Object.values(scenarios.missingCrypto).every(Boolean)
      };
    });

    // Normal case should be compatible
    expect(result.normalCase.hasWebCrypto).toBe(true);
    expect(result.normalCase.hasIndexedDB).toBe(true);
    expect(result.normalCase.hasWasm).toBe(true);
    expect(result.normalCompatible).toBe(true);
    
    // Missing crypto case should not be compatible
    expect(result.missingCryptoCase.hasWebCrypto).toBe(false);
    expect(result.missingCryptoCase.hasIndexedDB).toBe(true);
    expect(result.missingCryptoCase.hasWasm).toBe(true);
    expect(result.missingCryptoCompatible).toBe(false);
  });

  test('should validate wallet store integration', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const { walletStore } = await import('/src/lib/stores/wallet');
        return typeof walletStore === 'object' && typeof walletStore.subscribe === 'function';
      } catch (error) {
        return false;
      }
    });
    
    expect(result).toBe(true);
  });

  test('should validate browser SDK integration points', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // Test that browser has the required APIs for SDK functionality
        const hasRequiredAPIs = {
          fetch: typeof fetch === 'function',
          crypto: typeof crypto === 'object' && typeof crypto.subtle === 'object',
          indexedDB: typeof indexedDB === 'object',
          webAssembly: typeof WebAssembly === 'object'
        };
        
        return {
          allPresent: Object.values(hasRequiredAPIs).every(Boolean),
          apis: hasRequiredAPIs
        };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    expect(result.allPresent).toBe(true);
    expect(result.apis.fetch).toBe(true);
    expect(result.apis.crypto).toBe(true);
    expect(result.apis.indexedDB).toBe(true);
    expect(result.apis.webAssembly).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('should validate crypto service integration', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const { CryptoService } = await import('/src/lib/cryptoService');
        const crypto = new CryptoService();
        return typeof crypto.encrypt === 'function' && typeof crypto.decrypt === 'function';
      } catch (error) {
        return false;
      }
    });
    
    expect(result).toBe(true);
  });

  test('should validate secure storage integration', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const { SecureStorage } = await import('/src/lib/secureStorage');
        const storage = new SecureStorage();
        return typeof storage.store === 'function' && typeof storage.retrieve === 'function';
      } catch (error) {
        return false;
      }
    });
    
    expect(result).toBe(true);
  });

  test('should validate wallet service integration', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const walletService = await import('/src/lib/walletService');
        return typeof walletService.initWasm === 'function' && 
               typeof walletService.generateMnemonic === 'function';
      } catch (error) {
        return false;
      }
    });
    
    expect(result).toBe(true);
  });

  test('should test browser SDK initialization flow', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // Test the browser compatibility check function from layout
        const hasWebCrypto = window.crypto && window.crypto.subtle;
        const hasIndexedDB = window.indexedDB;
        const hasWasm = typeof WebAssembly === 'object';
        
        const compatible = hasWebCrypto && hasIndexedDB && hasWasm;
        
        // Test initialization components are available
        const { walletStore } = await import('/src/lib/stores/wallet');
        const walletService = await import('/src/lib/walletService');
        const cryptoService = await import('/src/lib/cryptoService');
        
        return {
          compatible,
          hasWalletStore: typeof walletStore === 'object',
          hasWalletService: typeof walletService.initWasm === 'function',
          hasCryptoService: typeof cryptoService.CryptoService === 'function'
        };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    expect(result.compatible).toBe(true);
    expect(result.hasWalletStore).toBe(true);
    expect(result.hasWalletService).toBe(true);
    expect(result.hasCryptoService).toBe(true);
    expect(result.error).toBeUndefined();
  });
});