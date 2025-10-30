<script>
  import { t } from "$lib/translations";
  import { post, success, fail, focus, setCookie } from "$lib/utils";
  import Pinpad from "$comp/Pinpad.svelte";
  import { pin } from "$lib/store";
  import { onMount } from "svelte";

  let { value = $bindable(), title = $t("user.settings.verifyPIN"), cancel = () => (p = ""), notify = true } = $props();

  let p = $state("");

  $effect(() => {
    if (value) {
      p = value;
    }
  });

  $effect(() => {
    if (p && p.toString().length > 5) {
      value = p.toString();
    }
  });

  let loaded = $state(false);
  onMount(() => setTimeout(() => (loaded = true), 500));

  let locktime = $state(5 * 60);
  let checking = $state(false);
  let lastChecked = $state("");

  $effect(() => {
    if (loaded && p && p.length === 6 && p !== lastChecked && !checking) {
      checkPin(p);
    }
  });

  let checkPin = async (pinToCheck) => {
    if (pinToCheck?.length !== 6 || checking) return;

    checking = true;
    lastChecked = pinToCheck;
    let result;

    try {
      result = await post("/pin", { pin: pinToCheck });
    } catch (e) {
      console.log("Pin check failed", e);
    }

    if (result) {
      if (notify) success("Pin confirmed");
      if (locktime) {
        setCookie("pin", pinToCheck, locktime);
        setTimeout(() => ($pin = undefined), locktime * 1000);
      }
      $pin = pinToCheck;
    } else {
      fail("Invalid pin");
      value = "";
      p = "";
      lastChecked = "";
    }

    checking = false;
  };
</script>

{#if loaded}
  <div
    role="dialog"
    class="fixed backdrop-blur-xl bg-black/50 inset-0 h-full w-full z-50 cursor-default flex items-center justify-center p-3 sm:p-4"
    onclick={(e) => { if (e.target === e.currentTarget) cancel(); }}
    aria-labelledby="title"
  >
    <div
      class="w-full max-w-lg p-4 sm:p-6 glass backdrop-blur-xl bg-white/10 border-2 border-white/20 shadow-2xl rounded-2xl space-y-4 sm:space-y-6 animate-scaleIn max-h-[95vh] overflow-y-auto"
    >
      <h1 id="title" class="text-center text-xl sm:text-2xl font-bold gradient-text">{title}</h1>
      <Pinpad bind:v={p} {cancel} />

      <div class="space-y-2">
        <label for="locktime" class="font-bold text-white/80 block text-sm sm:text-base"
          >{$t("user.settings.rememberFor")}</label
        >
        <select
          name="locktime"
          bind:value={locktime}
          class="w-full glass rounded-xl border-2 border-white/20 focus:border-purple-500/50 bg-white/5 p-2.5 sm:p-3 text-white text-sm sm:text-base"
        >
          <option value={30} class="bg-gray-800 text-white">30 {$t("user.settings.seconds")}</option>
          <option value={5 * 60} class="bg-gray-800 text-white">5 {$t("user.settings.minutes")}</option>
          <option value={30 * 60} class="bg-gray-800 text-white">30 {$t("user.settings.minutes")}</option>
          <option value={60 * 60} class="bg-gray-800 text-white">1 {$t("user.settings.hour")}</option>
          <option value={8 * 60 * 60} class="bg-gray-800 text-white">8 {$t("user.settings.hours")}</option>
        </select>
      </div>

      <div class="w-full flex">
        <button
          type="button"
          class="px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 relative overflow-hidden group inline-flex items-center gap-2 w-full justify-center text-sm sm:text-base"
          style="background: linear-gradient(135deg, #6B7280 0%, #4B5563 100%); color: white;"
          onclick={cancel}
        >
          <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
               style="background: linear-gradient(135deg, #4B5563 0%, #6B7280 100%);"></div>
          <iconify-icon
            noobserver
            icon="ph:x-circle-bold"
            width="18"
            class="relative z-10 sm:w-5"
          ></iconify-icon>
          <span class="relative z-10">Cancel</span>
        </button>
      </div>
    </div>
  </div>
{/if}
