<script>
  export let password = "";
  export let onDecision; // callback: (true | false) => void

  let confirmPassword = "";
  let step = 1; // 1 = confirm password, 2 = yes/no

  function next() {
    if (confirmPassword !== password) {
      alert("Passwords do not match");
      return;
    }
    step = 2;
  }

  function yes() {
    onDecision(true);
  }

  function no() {
    onDecision(false);
  }
</script>

<div class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
  <div class="glass p-6 rounded-2xl w-full max-w-sm">
    {#if step === 1}
      <h2 class="text-xl font-bold mb-4">Confirm Password</h2>
      <input
        type="password"
        placeholder="Re-enter new password"
        class="w-full p-3 rounded-xl mb-4 bg-black/40 text-white"
        bind:value={confirmPassword}
      />

      <div class="flex gap-3">
        <button
          class="w-full py-2 rounded-xl bg-white/10"
          on:click={() => onDecision(false)}
        >
          Cancel
        </button>

        <button
          class="w-full py-2 rounded-xl bg-dgen-aqua text-black font-bold"
          on:click={next}
        >
          Continue
        </button>
      </div>
    {:else}
      <h2 class="text-xl font-bold mb-4">Are you sure?</h2>
      <p class="text-white/70 mb-4">
        Changing your password will log you out from other devices.
      </p>

      <div class="flex gap-3">
        <button class="w-full py-2 rounded-xl bg-white/10" on:click={no}>
          No
        </button>
        <button
          class="w-full py-2 rounded-xl bg-red-500 text-white font-bold"
          on:click={yes}
        >
          Yes, Change Password
        </button>
      </div>
    {/if}
  </div>
</div>
