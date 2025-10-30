<script>
  import { onMount } from 'svelte';
  import { tabSync } from '$lib/tabSync';

  let { onTakeover = () => {}, onRefresh = () => {} } = $props();

  let showDetails = $state(false);
  let showConfirm = $state(false);
  let lockHolder = $state(null);
  let lockTime = $state(null);
  let hasSeenMessage = $state(false);

  onMount(() => {
    // Check if user has seen this message before
    const seen = localStorage.getItem('tab_lock_message_seen');
    hasSeenMessage = !!seen;

    // Get lock holder info
    updateLockInfo();

    // Update lock info every 5 seconds
    const interval = setInterval(updateLockInfo, 5000);

    return () => clearInterval(interval);
  });

  function updateLockInfo() {
    lockHolder = tabSync.getLockHolder();
    const lockKey = localStorage.getItem('breez_wallet_lock');
    if (lockKey) {
      lockTime = new Date(parseInt(lockKey));
    }
  }

  function handleTakeover() {
    showConfirm = true;
  }

  async function confirmTakeover() {
    // Mark as seen so user doesn't get educated message again
    localStorage.setItem('tab_lock_message_seen', 'true');

    showConfirm = false;
    await onTakeover();
  }

  function cancelTakeover() {
    showConfirm = false;
  }

  async function handleRefresh() {
    await onRefresh();
    updateLockInfo();
  }

  function dismissEducation() {
    localStorage.setItem('tab_lock_message_seen', 'true');
    hasSeenMessage = true;
  }

  function getRelativeTime() {
    if (!lockTime) return '';
    const seconds = Math.floor((Date.now() - lockTime.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }
</script>

<div class="fixed top-0 left-0 right-0 z-[100] border-b border-cyan-600/30 bg-gradient-to-r from-cyan-500/95 to-blue-500/95 backdrop-blur-sm shadow-lg">
  <div class="max-w-7xl mx-auto px-3 sm:px-4 py-3">
    {#if !showConfirm}
      <!-- Main Banner Content -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <!-- Icon and Main Message -->
        <div class="flex items-start gap-2 flex-1">
          <div class="flex-shrink-0 mt-0.5">
            <iconify-icon icon="mdi:alert-circle" width="20" class="text-white"></iconify-icon>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-white font-semibold text-sm sm:text-base">
              Wallet is Active in Another Tab
            </div>
            <div class="text-white/90 text-xs sm:text-sm mt-0.5">
              {#if lockTime}
                Started {getRelativeTime()}
              {:else}
                Another browser tab is using the wallet
              {/if}
              • This tab is in <strong>view-only mode</strong>
            </div>

            {#if !hasSeenMessage}
              <div class="mt-2 text-xs text-white/80 bg-white/10 rounded p-2">
                <strong>Why?</strong> The wallet can only run in one tab at a time to prevent payment conflicts and ensure security.
                <button
                  onclick={() => dismissEducation()}
                  class="ml-2 underline hover:text-white"
                  type="button"
                >
                  Got it
                </button>
              </div>
            {/if}
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2 ml-6 sm:ml-0">
          <button
            onclick={handleRefresh}
            class="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5"
            type="button"
          >
            <iconify-icon icon="mdi:refresh" width="14"></iconify-icon>
            Check Status
          </button>
          <button
            onclick={handleTakeover}
            class="px-3 py-1.5 bg-white hover:bg-white/90 text-cyan-700 rounded text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
            type="button"
          >
            <iconify-icon icon="mdi:swap-horizontal" width="14"></iconify-icon>
            Use This Tab
          </button>
          <button
            onclick={() => showDetails = !showDetails}
            class="p-1.5 hover:bg-white/20 rounded transition-colors"
            type="button"
            aria-label="Toggle details"
          >
            <iconify-icon
              icon={showDetails ? "mdi:chevron-up" : "mdi:chevron-down"}
              width="16"
              class="text-white"
            ></iconify-icon>
          </button>
        </div>
      </div>

      <!-- Expandable Details -->
      {#if showDetails}
        <div class="mt-3 pt-3 border-t border-white/20 text-xs sm:text-sm">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-white/90">
            <div>
              <div class="font-semibold mb-1">What you can do in this tab:</div>
              <ul class="space-y-1 text-xs">
                <li class="flex items-center gap-1.5">
                  <iconify-icon icon="mdi:check" width="14" class="text-green-300"></iconify-icon>
                  View balance and transactions
                </li>
                <li class="flex items-center gap-1.5">
                  <iconify-icon icon="mdi:check" width="14" class="text-green-300"></iconify-icon>
                  Copy receive addresses
                </li>
                <li class="flex items-center gap-1.5">
                  <iconify-icon icon="mdi:close" width="14" class="text-red-300"></iconify-icon>
                  Send payments (active tab only)
                </li>
              </ul>
            </div>
            <div>
              <div class="font-semibold mb-1">To use this tab:</div>
              <ul class="space-y-1 text-xs">
                <li>1. Close the other wallet tab, or</li>
                <li>2. Click "Use This Tab" to take over</li>
                <li>3. The other tab will become view-only</li>
              </ul>
            </div>
          </div>
          {#if lockHolder}
            <div class="mt-2 text-xs text-white/70">
              Active tab ID: <code class="bg-white/10 px-1 rounded">{lockHolder.slice(0, 16)}...</code>
            </div>
          {/if}
        </div>
      {/if}
    {:else}
      <!-- Confirmation Dialog -->
      <div class="flex flex-col gap-3">
        <div class="flex items-start gap-2">
          <iconify-icon icon="mdi:alert" width="20" class="text-white flex-shrink-0 mt-0.5"></iconify-icon>
          <div class="flex-1">
            <div class="text-white font-semibold text-sm sm:text-base">
              Switch to This Tab?
            </div>
            <div class="text-white/90 text-xs sm:text-sm mt-1">
              This will make the other tab view-only. Any pending actions in that tab may be interrupted.
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 ml-6 sm:ml-0">
          <button
            onclick={cancelTakeover}
            class="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded text-xs sm:text-sm font-medium transition-colors"
            type="button"
          >
            Cancel
          </button>
          <button
            onclick={confirmTakeover}
            class="px-3 py-1.5 bg-white hover:bg-white/90 text-cyan-700 rounded text-xs sm:text-sm font-semibold transition-colors shadow-sm"
            type="button"
          >
            Yes, Use This Tab
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Spacer to prevent content from being hidden under fixed banner -->
<div class="h-20 sm:h-16"></div>
