<script>
  import { run } from "svelte/legacy";
  import { theme, unitPreference } from "$lib/store";

  import { onMount, tick } from "svelte";
  import { browser } from "$app/environment";
  import Numpad from "$comp/Numpad.svelte";
  import LocaleSelector from "$comp/LocaleSelector.svelte";
  import Toggle from "$comp/Toggle.svelte";
  import { locale, t } from "$lib/translations";
  import { post, success, fail, info } from "$lib/utils";
  import { page } from "$app/stores";
  import { buildLogsBlob, getLogs, clearLogs } from "$lib/logStorage";
  // import { PUBLIC_VAPID_PUBKEY } from "$env/static/public";

  let { data } = $props();
  let { user } = $state(data);
  let { connect, rates, subscriptions } = data;
  let { currency, email, tip, verified } = $state(user);
  let rate = rates[currency];

  let fiats = Object.keys(rates).sort((a, b) => a.localeCompare(b));
  let keypress = (e) => e.key === "Enter" && (e.preventDefault() || el.click());

  let editingReserve = $state(),
    editingThreshold = $state(),
    doneReserve = $state(),
    doneThreshold;
  let doneEditing = () => {
    editingReserve = false;
    editingThreshold = false;
  };

  let editReserve = async () => {
    editingReserve = true;
    await tick();
    reserveEl.focus();
  };

  let editThreshold = async () => {
    editingThreshold = true;
    await tick();
    thresholdEl.focus();
  };

  if (!user.threshold) user.threshold = 1000000;
  if (!user.reserve) user.reserve = 100000;
  let reserveEl = $state(),
    thresholdEl = $state();

  let push = $state(),
    pm,
    subscription;

  let notificationsEnabled = $state(false);
  let permission = $state();
  let showNotificationHelp = $state(false);
  let showClearConfirm = $state(false)
  let isExporting = $state(false);

  onMount(async () => {
    if (!browser) return;

    // Check browser notification permission
    const { getNotificationPermission } = await import('$lib/notifications');
    permission = getNotificationPermission();

    // Load saved preference from localStorage
    const savedPref = localStorage.getItem('notifications_enabled');
    notificationsEnabled = savedPref === 'true';

    // Push notifications (VAPID) disabled for now - using browser Notification API instead
    // try {
    //   const registration = navigator?.serviceWorker &&
    //     await navigator.serviceWorker.getRegistration();
    //
    //   pm = registration?.pushManager;
    //
    //   if (!pm) return;
    //
    //   const pushPermission = await pm.permissionState({
    //     userVisibleOnly: true,
    //     applicationServerKey: PUBLIC_VAPID_PUBKEY,
    //   });
    //
    //   if (pushPermission === "granted") {
    //     subscription = await pm.getSubscription();
    //     if (subscriptions.includes(JSON.stringify(subscription))) push = true;
    //   }
    // } catch (e) {
    //   console.log("Push notifications not available:", e.message);
    // }
  });

  // Handle notification permission toggle - called manually from Toggle onclick
  async function handleNotificationToggle() {
    if (!browser) return;

    const { requestNotificationPermission } = await import('$lib/notifications');

    if (notificationsEnabled) {
      // Request permission
      permission = await requestNotificationPermission();
      if (permission === 'granted') {
        localStorage.setItem('notifications_enabled', 'true');
        success('Browser notifications enabled');
      } else {
        // Permission denied, revert toggle
        notificationsEnabled = false;
        localStorage.setItem('notifications_enabled', 'false');
        fail('Permission denied. Check your browser settings.');
      }
    } else {
      // Disable notifications
      localStorage.setItem('notifications_enabled', 'false');
      success('Browser notifications disabled');
    }
  }

  async function exportLogs() {
    if (isExporting) return;   // prevent double clicks
    isExporting = true;

    try {
      const blob = await buildLogsBlob();
      if (!blob) {
        info("No logs to export");
        return;
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      const now = new Date()
      const date = now.toISOString()       
        .replace(/T/, '_')                  
        .replace(/:/g, '-')                 
        .replace(/\..+/, '');
      a.download = `dgen-logs_${date}.log`;
      a.click();
      
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      fail("Failed to export logs");
    } finally {
      isExporting = false;
    }
  }

  async function handleClearLogs() {
    try {
      await clearLogs();
      success("Logs cleared on this device");
    } catch (err) {
      console.error("Clear logs failed:", err);
      fail("Failed to clear logs");
    } finally {
      showClearConfirm = false;
    }
  }

  // Push notifications (VAPID) disabled for now - using browser Notification API instead
  // let updateNotifications = async (push) => {
  //   if (!browser || !pm) return (push = false);
  //
  //   if (subscription && !push) {
  //     return post("/subscription/delete", { subscription });
  //   }
  //
  //   if (push && permission !== "denied") {
  //     subscription = await pm.subscribe({
  //       userVisibleOnly: true,
  //       applicationServerKey: PUBLIC_VAPID_PUBKEY,
  //     });
  //   }
  //
  //   if (subscription) {
  //     await post("/subscription", { subscription });
  //   }
  // };
  run(() => {
    user.language = $locale;
  });
  // run(() => {
  //   updateNotifications(push);
  // });

  $effect(() => {
    if (email !== user.email) verified = false;
  });

  let revoke = () => {};
</script>

<div class="space-y-6">
  <!-- Language Settings -->
  <div
    class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-purple-500/40 transition-all duration-500 animate-scaleIn"
  >
    <label for="language" class="font-bold block mb-2 text-lg gradient-text"
      >{$t("user.settings.locale")}</label
    >
    <LocaleSelector
      style="select-styles block py-3 w-full glass rounded-2xl border-2 border-white/20 focus:border-purple-500/50"
    />
  </div>

  <!-- Currency Settings -->
  <div
    class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-green-500/40 transition-all duration-500 animate-scaleIn"
    style="animation-delay: 0.1s;"
  >
    <label for="currency" class="font-bold block mb-2 text-lg gradient-text"
      >{$t("user.settings.localCurrency")}</label
    >
    <select
      name="currency"
      value={currency}
      class="glass rounded-2xl border-2 border-white/20 focus:border-green-500/50 bg-white/5"
    >
      {#each fiats as fiat}
        <option value={fiat} class="bg-gray-800 text-white">{fiat}</option>
      {/each}
    </select>
  </div>

  <!-- Bitcoin Unit Settings -->
  <div
    class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-orange-500/40 transition-all duration-500 animate-scaleIn"
    style="animation-delay: 0.2s;"
  >
    <label for="unit" class="font-bold block mb-2 text-lg gradient-text">
      Bitcoin Display Unit
    </label>
    <p class="text-white/60 mb-3 text-sm">
      Choose how to display your Bitcoin balance throughout the app
    </p>
    <div class="flex gap-3">
      <button
        type="button"
        class="flex-1 p-4 rounded-xl border-2 transition-all duration-300 {$unitPreference === 'btc' ? 'border-orange-500 bg-orange-500/20' : 'border-white/20 hover:border-orange-500/40'}"
        onclick={() => $unitPreference = 'btc'}
      >
        <div class="flex items-center justify-center gap-2">
          <iconify-icon icon="cryptocurrency:btc" class="text-orange-400" width="24"></iconify-icon>
          <span class="font-semibold">BTC</span>
        </div>
        <p class="text-xs text-white/60 mt-1">e.g., 0.00003824</p>
      </button>
      <button
        type="button"
        class="flex-1 p-4 rounded-xl border-2 transition-all duration-300 {$unitPreference === 'sats' ? 'border-dgen-aqua bg-dgen-aqua/20' : 'border-white/20 hover:border-dgen-aqua/40'}"
        onclick={() => $unitPreference = 'sats'}
      >
        <div class="flex items-center justify-center gap-2">
          <iconify-icon icon="ph:lightning-fill" class="text-dgen-aqua" width="24"></iconify-icon>
          <span class="font-semibold">Sats</span>
        </div>
        <p class="text-xs text-white/60 mt-1">e.g., 3,824</p>
      </button>
    </div>
  </div>

  <!-- Email Settings (temporarily disabled) -->
  <!-- <div
    class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-blue-500/40 transition-all duration-500 space-y-2 animate-scaleIn"
    style="animation-delay: 0.2s;"
  >
    <label for="email" class="font-bold block text-lg gradient-text"
      >{$t("user.settings.email")}</label
    >
    <p class="text-white/60">
      {$t("user.settings.emailDescription")}
    </p>

    <div class="relative">
      <input
        type="text"
        name="email"
        class="w-full p-4 border rounded-xl text-xl bg-transparent text-white placeholder-white/40"
        bind:value={email}
        placeholder={$t("user.settings.emailPlaceholder") || "Enter your email"}
      />
      {#if verified}
        <iconify-icon
          noobserver
          icon="ph:check-bold"
          class="absolute right-4 top-1/2 transform -translate-y-1/2 text-green-400"
          width="32"
        ></iconify-icon>
      {:else if email}
        <iconify-icon
          noobserver
          icon="ph:clock-bold"
          class="absolute right-4 top-1/2 transform -translate-y-1/2 text-yellow-400 animate-pulse"
          width="32"
        ></iconify-icon>
      {/if}
    </div>
  </div> -->

  <!-- Browser Notifications -->
  <div
    class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-yellow-500/40 transition-all duration-500 animate-scaleIn"
    style="animation-delay: 0.3s;"
  >
    <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
      <div>
        <span class="font-bold text-lg gradient-text">Browser Notifications</span>
        <p class="text-white/60 mt-1">
          {#if permission === "denied"}
            Notifications are blocked. Enable them in your browser settings.
          {:else}
            Get notified when you receive payments
          {/if}
        </p>
      </div>
      {#if permission !== "denied"}
        <Toggle id="notifications" bind:value={notificationsEnabled} onclick={handleNotificationToggle} />
      {:else}
        <button
          type="button"
          class="px-4 py-2 rounded-lg bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 text-sm hover:bg-yellow-500/30 transition-all flex items-center justify-center gap-2 w-full md:w-auto"
          onclick={() => showNotificationHelp = !showNotificationHelp}
        >
          {showNotificationHelp ? 'Hide' : 'Show'} Instructions
          <iconify-icon icon={showNotificationHelp ? 'ph:caret-up-bold' : 'ph:caret-down-bold'} width="16"></iconify-icon>
        </button>
      {/if}
    </div>

    {#if permission === "denied" && showNotificationHelp}
      <div class="mt-4 space-y-3 border-t border-white/10 pt-4">
        <!-- Chrome Instructions -->
        <details class="group">
          <summary class="cursor-pointer p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all flex items-center justify-between">
            <div class="flex items-center gap-2">
              <iconify-icon icon="logos:chrome" width="20"></iconify-icon>
              <span class="font-semibold">Google Chrome</span>
            </div>
            <iconify-icon icon="ph:caret-down-bold" width="16" class="group-open:rotate-180 transition-transform"></iconify-icon>
          </summary>
          <ol class="mt-2 ml-8 space-y-1 text-sm text-white/80 list-decimal list-inside">
            <li>Click the <span class="inline-flex items-center gap-1 whitespace-nowrap">lock icon <iconify-icon icon="ph:lock-fill" width="14"></iconify-icon></span> in the address bar</li>
            <li>Find "Notifications" in the permissions list</li>
            <li>Change it from "Block" to "Allow"</li>
            <li>Refresh this page and toggle notifications on</li>
          </ol>
        </details>

        <!-- Edge Instructions -->
        <details class="group">
          <summary class="cursor-pointer p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all flex items-center justify-between">
            <div class="flex items-center gap-2">
              <iconify-icon icon="logos:microsoft-edge" width="20"></iconify-icon>
              <span class="font-semibold">Microsoft Edge</span>
            </div>
            <iconify-icon icon="ph:caret-down-bold" width="16" class="group-open:rotate-180 transition-transform"></iconify-icon>
          </summary>
          <ol class="mt-2 ml-8 space-y-1 text-sm text-white/80 list-decimal list-inside">
            <li>Click the <span class="inline-flex items-center gap-1 whitespace-nowrap">lock icon <iconify-icon icon="ph:lock-fill" width="14"></iconify-icon></span> in the address bar</li>
            <li>Click "Permissions for this site"</li>
            <li>Find "Notifications" and change to "Allow"</li>
            <li>Refresh this page and toggle notifications on</li>
          </ol>
        </details>

        <!-- Firefox Instructions -->
        <details class="group">
          <summary class="cursor-pointer p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all flex items-center justify-between">
            <div class="flex items-center gap-2">
              <iconify-icon icon="logos:firefox" width="20"></iconify-icon>
              <span class="font-semibold">Firefox</span>
            </div>
            <iconify-icon icon="ph:caret-down-bold" width="16" class="group-open:rotate-180 transition-transform"></iconify-icon>
          </summary>
          <ol class="mt-2 ml-8 space-y-1 text-sm text-white/80 list-decimal list-inside">
            <li>Click the <span class="inline-flex items-center gap-1 whitespace-nowrap">lock icon <iconify-icon icon="ph:lock-fill" width="14"></iconify-icon></span> in the address bar</li>
            <li>Click the arrow next to "Blocked" under Permissions</li>
            <li>Find "Receive Notifications" and click the X to remove the block</li>
            <li>Refresh this page and toggle notifications on</li>
          </ol>
        </details>

        <!-- Safari Instructions -->
        <details class="group">
          <summary class="cursor-pointer p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all flex items-center justify-between">
            <div class="flex items-center gap-2">
              <iconify-icon icon="logos:safari" width="20"></iconify-icon>
              <span class="font-semibold">Safari</span>
            </div>
            <iconify-icon icon="ph:caret-down-bold" width="16" class="group-open:rotate-180 transition-transform"></iconify-icon>
          </summary>
          <ol class="mt-2 ml-8 space-y-1 text-sm text-white/80 list-decimal list-inside">
            <li>Go to Safari → Settings → Websites</li>
            <li>Click "Notifications" in the left sidebar</li>
            <li>Find this website and change to "Allow"</li>
            <li>Refresh this page and toggle notifications on</li>
          </ol>
        </details>
      </div>
    {/if}
  </div>

  <!-- Logs Export -->
  <div
    class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-blue-500/40 transition-all duration-500 animate-scaleIn"
    style="animation-delay: 0.4s;"
  >
    <div class="flex flex-col gap-4">
      <div>
        <span class="font-bold text-lg gradient-text">Application Logs</span>
        <p class="text-white/60 mt-1 text-sm">
          Export technical logs from this device to share with support when troubleshooting issues.
        </p>
      </div>

      <div class="flex gap-3 items-center">
        <!-- Export Logs -->
        <button
          type="button"
          class="flex-1 p-4 rounded-xl border-2 transition-all duration-300 border-blue-500/40 bg-blue-500/20 hover:border-blue-400"
          onclick={exportLogs}
          disabled={isExporting}
        >
          <div class="flex items-center justify-center gap-2">
            <iconify-icon icon="ph:export-bold" class="text-blue-300" width="24"></iconify-icon>
            <span class="font-semibold">
              {#if isExporting}
                Exporting…
              {:else}
                Export Logs
              {/if}
            </span>
          </div>
        </button>

        <!-- Clear Logs -->
        <button
          type="button"
          class="px-4 p-4 rounded-xl border border-red-500/50 bg-red-500/10 
                text-red-300 text-xs md:text-sm 
                hover:bg-red-500/20 hover:border-red-400 
                transition-all flex items-center justify-center gap-2 flex-none"
          onclick={() => showClearConfirm = true}
        >
          <iconify-icon icon="ph:trash-bold" class="text-red-300" width="18"></iconify-icon>
          <span>Clear Logs</span>
        </button>
      </div>

      {#if showClearConfirm}
        <div class="mt-2 p-3 rounded-xl border border-red-500/40 bg-red-500/10 text-xs text-red-100 space-y-2">
          <p class="font-semibold">Clear all logs from this device?</p>
          <p class="text-[11px] text-red-200/80">
            This only deletes logs stored in this browser. It cannot be undone.
          </p>
          <div class="flex justify-end gap-2 mt-1">
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg border border-white/20 text-xs hover:bg-white/5"
              onclick={() => showClearConfirm = false}
            >
              Cancel
            </button>
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg border border-red-500/60 bg-red-500/40 text-xs font-semibold hover:bg-red-500/60"
              onclick={handleClearLogs}
            >
              Confirm clear
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Tip Prompt Settings (temporarily disabled) -->
  <!-- <div
    class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-orange-500/40 transition-all duration-500 animate-scaleIn"
    style="animation-delay: 0.5s;"
  >
    <div class="flex justify-between items-center">
      <div>
        <span class="font-bold text-lg gradient-text"
          >{$t("user.settings.tipPrompt")}</span
        >
        <p class="text-white/60 mt-1">
          {$t("user.settings.tipPromptDescription")}
        </p>
      </div>
      <Toggle id="prompt" bind:value={user.prompt} />
    </div>
  </div> -->

  <!-- Default Tip Settings (temporarily disabled) -->
  <!-- <div
    class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-purple-500/40 transition-all duration-500 space-y-2 animate-scaleIn"
    style="animation-delay: 0.6s;"
  >
    <label for="tip" class="font-bold block text-lg gradient-text"
      >{$t("user.settings.tip")}</label
    >
    <p class="text-white/60">
      {$t("user.settings.tipDesc")}
    </p>

    <label
      class="glass rounded-2xl border-2 border-white/20 focus-within:border-purple-500/50 transition-all flex items-center gap-2 p-4"
    >
      <input
        type="text"
        name="tip"
        class="clean flex-1 bg-transparent text-white placeholder-white/40"
        bind:value={tip}
      />
    </label>
  </div> -->

  <!-- Auto Withdraw Settings (temporarily disabled) -->
  <!-- <div
    class="premium-card backdrop-blur-xl bg-white/5 border-2 border-white/10 hover:border-green-500/40 transition-all duration-500 animate-scaleIn"
    style="animation-delay: 0.7s;"
  >
    <div class="flex justify-between items-center">
      <div>
        <span class="font-bold text-lg gradient-text"
          >{$t("user.settings.autoWithdraw")}</span
        >
        <p class="text-white/60 mt-1">
          {$t("user.settings.autoWithdrawDescription")}
        </p>
      </div>
      <Toggle id="autowithdraw" bind:value={user.autowithdraw} />
    </div>
  </div> -->

  <!-- Auto Withdraw Configuration (temporarily disabled) -->
  <!-- <div
    class="space-y-4 {!user.autowithdraw ? 'hidden' : ''}"
    style="animation-delay: 0.8s;"
  >
    <div class="mb-2">
      <label for="display" class="font-bold mb-1 block"
        >{$t("user.settings.destination")}</label
      >
      <textarea
        name="destination"
        placeholder={$t("user.settings.destinationPlaceholder")}
        onkeypress={keypress}
        class="w-full p-4 border rounded-xl h-48"
        bind:value={user.destination}
      ></textarea>
    </div>

    <div>
      <label for="display" class="font-bold mb-1 block"
        >{$t("user.settings.threshold")}</label
      >
      <button type="button" class="flex w-full" onclick={editThreshold}>
        <div
          class="p-4 border rounded-2xl rounded-r-none border-r-0 bg-base-200"
        >
          <iconify-icon
            noobserver
            icon="ph:lightning-fill"
            class="text-yellow-300"
          ></iconify-icon>
        </div>
        <div
          class="border-l-0 rounded-l-none pl-2 w-full p-4 border rounded-2xl text-left"
        >
          {user.threshold}
        </div>
        <input type="hidden" name="threshold" bind:value={user.threshold} />
      </button>
      <p class="text-secondary mt-1">
        {$t("user.settings.thresholdDesc")}
      </p>
    </div>

    <div>
      <label for="display" class="font-bold mb-1 block"
        >{$t("user.settings.reserve")}</label
      >
      <button type="button" class="flex w-full" onclick={editReserve}>
        <div
          class="p-4 border rounded-2xl rounded-r-none border-r-0 bg-base-200"
        >
          <iconify-icon
            noobserver
            icon="ph:lightning-fill"
            class="text-yellow-300"
          ></iconify-icon>
        </div>
        <div
          class="border-l-0 rounded-l-none pl-2 w-full p-4 border rounded-2xl text-left"
        >
          {user.reserve}
        </div>
        <input type="hidden" name="reserve" bind:value={user.reserve} />
      </button>
      <p class="text-secondary mt-1">
        {$t("user.settings.reserveDesc")}
      </p>
    </div>
  </div> -->

  {#if editingThreshold}
    <div
      class="fixed backdrop-blur-xl bg-black/30 inset-0 overflow-y-auto h-full w-full z-50 max-w-lg mx-auto"
    >
      <div
        class="relative p-5 border shadow-lg rounded-md glass backdrop-blur-xl bg-white/5 border-white/10 space-y-5"
      >
        <h1 class="text-center text-2xl font-semibold">
          {$t("user.settings.threshold")}
        </h1>
        <Numpad
          bind:amount={user.threshold}
          {currency}
          bind:rate
          bind:submit={doneReserve}
          bind:element={thresholdEl}
        />

        <button
          bind:this={doneReserve}
          type="button"
          onclick={doneEditing}
          class="btn">Ok</button
        >
      </div>
    </div>
  {/if}

  {#if editingReserve}
    <div
      class="fixed backdrop-blur-xl bg-black/30 inset-0 overflow-y-auto h-full w-full z-50 mx-auto max-w-lg"
    >
      <div
        class="relative mx-auto p-5 border shadow-lg rounded-md glass backdrop-blur-xl bg-white/5 border-white/10 space-y-5 text-center"
      >
        <h1 class="text-2xl font-semibold">
          {$t("user.settings.reserve")}
        </h1>
        <Numpad
          bind:amount={user.reserve}
          bind:currency
          bind:rate
          bind:submit={doneReserve}
          bind:element={reserveEl}
        />
        <button
          bind:this={doneReserve}
          type="button"
          onclick={doneEditing}
          class="btn">Ok</button
        >
      </div>
    </div>
  {/if}

</div>
