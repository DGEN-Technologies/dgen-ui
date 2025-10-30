<script lang="ts">
  import { lnAddressStore, isUpdating } from '$lib/stores/lightningAddress';
  import { updateLightningAddress, formatUsername, type LnAddressRegistrationResult } from '$lib/walletService';
  import { success, fail } from '$lib/utils';
  import { PUBLIC_DGEN_URL } from '$env/static/public';

  interface Props {
    currentUsername: string;
    userId: string;
    onClose: () => void;
    onSuccess?: (result: LnAddressRegistrationResult) => void;
  }

  let { currentUsername, userId, onClose, onSuccess }: Props = $props();

  let newUsername = $state('');
  let validationError = $state<string | null>(null);
  let showConfirmation = $state(false);

  const domain = 'breez.fun';

  // Validation
  const validateUsername = (value: string): string | null => {
    if (!value) return 'Username is required';
    if (value.length < 3) return 'Username must be at least 3 characters';
    if (value.length > 20) return 'Username must be less than 20 characters';
    if (!/^[a-z0-9_-]+$/.test(value)) {
      return 'Username can only contain lowercase letters, numbers, hyphens, and underscores';
    }
    return null;
  };

  // Auto-sanitize input
  const sanitizeUsername = (value: string): string => {
    return value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  };

  $effect(() => {
    validationError = validateUsername(newUsername);
  });

  const handleInputChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    newUsername = sanitizeUsername(target.value);
  };

  const handleSubmit = async () => {
    const error = validateUsername(newUsername);
    if (error) {
      validationError = error;
      return;
    }

    // Check if username actually changed
    if (newUsername === currentUsername) {
      fail('Username is the same as current');
      onClose();
      return;
    }

    // Show confirmation
    showConfirmation = true;
  };

  const handleConfirm = async () => {
    lnAddressStore.setUpdateLoading();

    try {
      // Get webhook URL
      const serverOrigin = PUBLIC_DGEN_URL;
      const webhookUrl = new URL('/api/v1/notify', serverOrigin);
      webhookUrl.searchParams.set('user', userId);

      // Format username before update
      const formattedUsername = formatUsername(newUsername);
      console.log('[UpdateUsername] Updating username to:', formattedUsername);

      // Use update function which generates new BOLT12 offer and has retry logic
      // This will automatically try with discriminators if username is taken
      const result = await updateLightningAddress(
        formattedUsername,
        webhookUrl.toString()
      );

      console.log('[UpdateUsername] Update successful:', result);

      // Update store
      lnAddressStore.setUpdateSuccess(
        result.lnurl,
        result.lightningAddress || '',
        result.bip353Address
      );

      // Show appropriate success message based on whether discriminator was added
      const finalUsername = result.lightningAddress?.split('@')[0];
      if (finalUsername && finalUsername !== formattedUsername) {
        success(`Username updated to ${result.lightningAddress} (adjusted for uniqueness)`);
      } else {
        success(`Username updated to ${result.lightningAddress}`);
      }

      // Call success callback if provided
      if (onSuccess) {
        onSuccess(result);
      }

      onClose();

    } catch (error) {
      console.error('[UpdateUsername] Update failed:', error);

      let errorMessage = 'Failed to update username';

      // The retry logic handles conflicts internally now
      // If we get here, all retries failed
      if (error instanceof Error && error.name === 'UsernameConflictError') {
        errorMessage = 'All username variations are taken. Please try a different username.';
        validationError = errorMessage;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      lnAddressStore.setUpdateError(
        error instanceof Error ? error : new Error(errorMessage),
        errorMessage
      );

      fail(errorMessage);
      showConfirmation = false;
    }
  };

  const handleCancel = () => {
    showConfirmation = false;
  };
</script>

<div class="modal-backdrop" onclick={onClose} role="button" tabindex="0">
  <div class="modal-content" onclick={(e) => e.stopPropagation()} role="dialog">
    {#if !showConfirmation}
      <!-- Username input form -->
      <div class="modal-header">
        <h2 class="text-xl font-bold">Update Lightning Address</h2>
        <button onclick={onClose} class="close-btn">&times;</button>
      </div>

      <div class="modal-body">
        <p class="text-sm text-white/60 mb-4">
          Current: <span class="text-white font-medium">{currentUsername}@{domain}</span>
        </p>

        <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <div class="form-group">
            <label for="username" class="block text-sm font-medium mb-2">
              New username
            </label>

            <div class="username-input-wrapper">
              <input
                id="username"
                type="text"
                bind:value={newUsername}
                oninput={handleInputChange}
                placeholder="username"
                class="username-input"
                class:error={validationError}
                disabled={$isUpdating}
                maxlength="20"
                autocomplete="off"
              />
              <div class="domain-suffix">@{domain}</div>
            </div>

            {#if validationError}
              <p class="error-message">{validationError}</p>
            {:else if newUsername && !validationError}
              <p class="success-message">✓ Valid format</p>
            {/if}
          </div>

          <div class="modal-actions">
            <button
              type="button"
              onclick={onClose}
              class="btn btn-secondary"
              disabled={$isUpdating}
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              disabled={$isUpdating || !newUsername || !!validationError || newUsername === currentUsername}
            >
              {#if $isUpdating}
                <span class="loading loading-spinner loading-sm"></span>
                Updating...
              {:else}
                Update
              {/if}
            </button>
          </div>
        </form>
      </div>
    {:else}
      <!-- Confirmation dialog -->
      <div class="modal-header">
        <h2 class="text-xl font-bold">Confirm Update</h2>
      </div>

      <div class="modal-body">
        <!-- Big Warning -->
        <div class="bg-red-500/20 border-2 border-red-500/50 rounded-lg p-4 mb-4">
          <div class="flex items-start gap-3">
            <svg class="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div class="flex-1">
              <p class="font-bold text-red-400 mb-2">⚠️ Your old Lightning address will STOP working!</p>
              <p class="text-sm text-white/80 mb-3">
                After this update, payments sent to your old address will NOT reach you.
              </p>
            </div>
          </div>
        </div>

        <!-- Address Change Preview -->
        <div class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
          <div class="text-sm space-y-2">
            <div class="flex items-center gap-2">
              <span class="text-white/60">Old:</span>
              <span class="font-mono text-white font-medium">{currentUsername}@{domain}</span>
              <span class="text-red-400 text-xs">← Will stop working</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-white/60">New:</span>
              <span class="font-mono text-white font-medium">{newUsername}@{domain}</span>
              <span class="text-green-400 text-xs">← New active address</span>
            </div>
          </div>
        </div>

        <!-- Action Required -->
        <div class="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          <p class="text-sm text-amber-400 font-medium mb-1">📢 Tell your friends!</p>
          <p class="text-xs text-white/70">
            Make sure to notify anyone who sends you payments about your new Lightning address.
          </p>
        </div>
      </div>

      <div class="modal-actions">
        <button
          type="button"
          onclick={handleCancel}
          class="btn btn-secondary"
          disabled={$isUpdating}
        >
          Cancel
        </button>
        <button
          type="button"
          onclick={handleConfirm}
          class="btn btn-primary"
          disabled={$isUpdating}
        >
          {#if $isUpdating}
            <span class="loading loading-spinner loading-sm"></span>
            Updating...
          {:else}
            Confirm
          {/if}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: linear-gradient(135deg, rgba(17, 24, 39, 0.95), rgba(31, 41, 55, 0.95));
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .close-btn {
    background: none;
    border: none;
    color: white;
    font-size: 2rem;
    cursor: pointer;
    line-height: 1;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.5rem;
    transition: background-color 0.2s;
  }

  .close-btn:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .modal-body {
    padding: 1.5rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .username-input-wrapper {
    display: flex;
    gap: 0.5rem;
  }

  .username-input {
    flex: 1;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    color: white;
    font-size: 1rem;
  }

  .username-input:focus {
    outline: none;
    border-color: rgb(59, 130, 246);
  }

  .username-input.error {
    border-color: rgb(239, 68, 68);
  }

  .username-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .domain-suffix {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    color: rgba(255, 255, 255, 0.6);
    white-space: nowrap;
    display: flex;
    align-items: center;
  }

  .error-message {
    color: rgb(248, 113, 113);
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }

  .success-message {
    color: rgb(74, 222, 128);
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }

  .modal-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-top: 1.5rem;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: linear-gradient(to right, rgb(59, 130, 246), rgb(147, 51, 234));
  }

  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(to right, rgb(37, 99, 235), rgb(126, 34, 206));
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .btn-secondary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
  }
</style>
