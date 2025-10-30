import { test, expect } from '@playwright/test';

test.describe('WalletStore', () => {
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

  test('should provide reactive wallet state', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { walletStore, isWalletUnlocked, walletError } = await import('/src/lib/stores/wallet');
      const { generateMnemonic } = await import('/src/lib/walletService');
      
      let stateChanges: any[] = [];
      let unlockChanges: boolean[] = [];
      let errorChanges: (string | null)[] = [];
      
      // Subscribe to stores
      const unsubState = walletStore.subscribe(state => stateChanges.push(state));
      const unsubUnlock = isWalletUnlocked.subscribe(unlocked => unlockChanges.push(unlocked));
      const unsubError = walletError.subscribe(error => errorChanges.push(error));
      
      const password = 'test-password-123';
      const mnemonic = await generateMnemonic();
      
      // Save mnemonic to secure storage
      await walletStore.saveMnemonic(mnemonic, password);
      
      // Try to init wallet (will fail due to missing Breez API key but should update state)
      try {
        await walletStore.init(password);
      } catch (e) {
        // Expected to fail due to missing API key
      }
      
      // Cleanup subscriptions
      unsubState();
      unsubUnlock();
      unsubError();
      
      return {
        stateChangeCount: stateChanges.length,
        unlockChangeCount: unlockChanges.length,
        errorChangeCount: errorChanges.length,
        finalState: stateChanges[stateChanges.length - 1],
        finalUnlocked: unlockChanges[unlockChanges.length - 1],
        hasError: errorChanges.some(e => e !== null)
      };
    });
    
    expect(result.stateChangeCount).toBeGreaterThan(0);
    expect(result.unlockChangeCount).toBeGreaterThan(0);
    expect(result.finalState).toBeDefined();
    expect(result.hasError).toBe(true); // Expected due to missing API key
  });

  test('should handle wallet operations with state updates', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { walletOperations } = await import('/src/lib/stores/wallet');
      
      // Test mnemonic operations
      const mnemonic = await walletOperations.generateMnemonic();
      const isValid = await walletOperations.validateMnemonic(mnemonic);
      
      return {
        mnemonicGenerated: mnemonic.split(' ').length >= 12,
        mnemonicValid: isValid
      };
    });
    
    expect(result.mnemonicGenerated).toBe(true);
    expect(result.mnemonicValid).toBe(true);
  });

  test('should integrate with existing store', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { mnemonic, password } = await import('/src/lib/store');
      const { createWalletStore } = await import('/src/lib/stores/wallet');
      const { generateMnemonic } = await import('/src/lib/walletService');
      
      let mnemonicValue: string | null = null;
      let passwordValue: string | undefined = undefined;
      
      // Subscribe to existing stores
      const unsubMnemonic = mnemonic.subscribe(m => mnemonicValue = m);
      const unsubPassword = password.subscribe(p => passwordValue = p);
      
      const testPassword = 'integration-test-password';
      const testMnemonic = await generateMnemonic();
      
      // Create wallet store with existing stores
      const walletStore = createWalletStore(mnemonic, password);
      
      // Save mnemonic via wallet store
      await walletStore.saveMnemonic(testMnemonic, testPassword);
      
      // Cleanup
      unsubMnemonic();
      unsubPassword();
      
      return {
        mnemonicUpdated: mnemonicValue === testMnemonic
      };
    });
    
    expect(result.mnemonicUpdated).toBe(true);
  });

  test('should clear error state', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { walletStore, walletError } = await import('/src/lib/stores/wallet');
      
      let errorValue: string | null = null;
      const unsubError = walletError.subscribe(error => errorValue = error);
      
      // Try to init without password (should cause error)
      try {
        await walletStore.init();
      } catch (e) {
        // Expected to fail
      }
      
      const hasErrorAfterInit = errorValue !== null;
      
      // Clear error
      walletStore.clearError();
      
      // Error should be cleared
      const errorClearedAfterClear = errorValue === null;
      
      unsubError();
      
      return {
        hasErrorAfterInit,
        errorClearedAfterClear
      };
    });
    
    expect(result.hasErrorAfterInit).toBe(true);
    expect(result.errorClearedAfterClear).toBe(true);
  });
});