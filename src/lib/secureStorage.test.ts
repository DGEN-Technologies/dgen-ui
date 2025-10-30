import { describe, it, expect, beforeEach } from 'vitest';
import { secureStorage } from './secureStorage';

describe('SecureStorage', () => {
  beforeEach(async () => {
    await secureStorage.init();
  });

  it('should lock and unlock with password', async () => {
    expect(secureStorage.isUnlocked()).toBe(false);
    await secureStorage.unlock('test-password');
    expect(secureStorage.isUnlocked()).toBe(true);
    await secureStorage.lock();
    expect(secureStorage.isUnlocked()).toBe(false);
  });

  it('should encrypt and decrypt data', async () => {
    await secureStorage.unlock('test-password');
    const testData = 'test mnemonic phrase here';
    await secureStorage.store('mnemonic', testData);
    const retrieved = await secureStorage.retrieve('mnemonic');
    expect(retrieved).toBe(testData);
  });

  it('should throw when accessing locked storage', async () => {
    await expect(secureStorage.store('test', 'data')).rejects.toThrow('Storage locked');
    await expect(secureStorage.retrieve('test')).rejects.toThrow('Storage locked');
  });

  it('should return null for non-existent keys', async () => {
    await secureStorage.unlock('test-password');
    const result = await secureStorage.retrieve('non-existent');
    expect(result).toBeNull();
  });

  it('should clear data on remove', async () => {
    await secureStorage.unlock('test-password');
    await secureStorage.store('temp', 'data');
    await secureStorage.remove('temp');
    const result = await secureStorage.retrieve('temp');
    expect(result).toBeNull();
  });
});