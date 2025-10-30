<script>
  import { enhance } from "$app/forms";
  import { send } from "$lib/socket";
  import {
    btc,
    loc,
    post,
    copy,
    f,
    fail,
    get,
    types,
    sat,
    s,
    sats,
  } from "$lib/utils";
  import { tick, onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { last, showQr, amountPrompt } from "$lib/store";
  import Avatar from "$comp/Avatar.svelte";
  import InvoiceData from "$comp/InvoiceData.svelte";
  import InvoiceActions from "$comp/InvoiceActions.svelte";
  import SetAmount from "$comp/SetAmount.svelte";
  import SetMemo from "$comp/SetMemo.svelte";
  import SetType from "$comp/SetType.svelte";
  import Success from "$comp/Success.svelte";
  import { t } from "$lib/translations";
  import { goto, invalidate } from "$app/navigation";
  import { page } from "$app/stores";
  import { paymentReceived } from "$lib/stores/paymentEvents";

  let { data } = $props();

  let showOptions;

  let reading = async ({ message, serialNumber }) => {
    let name = serialNumber.replace(/:/g, "-");
    let result = await post(`/fund/${name}/withdraw`, { amount, hash, name });
  };

  let readingerror = (e) => console.log("nfc error", e);

  let { id, subject, user } = $state(data);
  let { invoice, src } = $derived(data);
  let { aid, amount, rate, tip, hash, text, type } = $derived(invoice);
  let { memo } = $state(invoice);
  let { username, currency } = $derived(invoice.user);
  let locale = loc(user);
  
  let isPaid = $state(invoice?.confirmed || invoice?.paid || false);
  let showingSuccess = $state(false);

  let tipPercent = $derived(tip ? (tip / amount) * 100 : 0);

  // if (browser && !subbed[id])
  //   send("subscribe", invoice)
  //     .then(() => (subbed[id] = true))
  //     .catch((e) => {
  //       console.log("failed to subscribe to invoice notifications", invoice);
  //       console.log(e);
  //     });

  // Subscribe to payment events from SDK
  $effect(() => {
    if ($paymentReceived && browser) {
      const event = $paymentReceived;
      console.log('[Invoice] Payment event received:', event);

      // For incoming payments, show success when we get 'confirmed' or 'complete' status
      // According to Breez SDK UX guide:
      // - 'confirmed' = Display successful payment feedback (claim tx broadcast/transaction seen)
      // - 'complete' = Show payment as complete (transaction confirmed)

      if (event.status === 'confirmed' || event.status === 'complete') {
        console.log('[Invoice] Payment received! Status:', event.status);
        isPaid = true;
        showingSuccess = true;

        // Show success animation for 2.5 seconds, then redirect to paid page
        setTimeout(() => {
          goto(`/invoice/${id}/paid`);
        }, 2500);
      } else if (event.status === 'pending') {
        // Show pending indicator
        console.log('[Invoice] Payment pending...');
        // Could add a pending UI here if desired
      }
    }
  });

  onMount(async () => {
    if (browser) {
      if ($amountPrompt && !amount) toggleAmount();

      // Automatically open options modal if ?options=true is in URL
      if ($page.url.searchParams.get("options") === "true") {
        settingType = true;
      }
    }
  });

  let update = async (keepOptionsOpen = false) => {
    try {
      ({ id } = await post(`/invoice`, {
        invoice,
        user: { username, currency },
      }));

      let url = `/invoice/${id}`;
      if (subject?.prompt) url += "/tip";
      else if (keepOptionsOpen) url += "?options=true";

      goto(url, { invalidateAll: true, noScroll: true });
    } catch (e) {
      fail(e.message);
    }
  };

  let settingType = $state();
  let toggleType = () => (settingType = !settingType);
  let setType = async (type, address_type) => {
    $showQr = true;
    if (type === types.lightning && !amount && typeof newAmount === "undefined")
      goto(`/${username}/receive`, { invalidateAll: true, noScroll: true });
    else {
      if (typeof newAmount !== "undefined") invoice.amount = newAmount;
      invoice.address_type = address_type;
      invoice.type = type;

      // If we're setting a specific Bitcoin address type (from modal), close modal
      // If we're just switching to Bitcoin without address type (from main button), set default
      if (type === types.bitcoin && !address_type) {
        // Just switching to Bitcoin from main button - use default address type
        invoice.address_type = "bech32"; // Default to Segwit
      }

      await update(); // Don't keep options open
    }
    settingType = false;
  };

  let newAmount = $state(0);
  let settingAmount = $state();
  let toggleAmount = () => (settingAmount = !settingAmount);

  let setAmount = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();

    settingAmount = false;

    if (typeof $amountPrompt === "undefined") $amountPrompt = true;
    invoice.amount = newAmount;
    invoice.tip = 0;

    await update(); // Don't keep options open
  };

  let setMemo = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    settingMemo = false;
    invoice.memo = memo;
    // Always preserve amount when setting memo
    if (typeof newAmount !== "undefined" && newAmount > 0) {
      invoice.amount = newAmount;
    } else if (amount) {
      invoice.amount = amount;
    }
    await update(); // Don't keep options open
  };

  let settingMemo = $state();
  let toggleMemo = () => (settingMemo = !settingMemo);

  let fiat = $state(true);
  let amountFiat = $derived(parseFloat(((amount * rate) / sats).toFixed(2)));
  let tipAmount = $derived(((tip * rate) / sats).toFixed(2));
  let link = $derived(
    [types.bitcoin, types.liquid].includes(type) ? text : `lightning:${text}`,
  );

  let txt = $derived(
    [types.bitcoin, types.liquid].includes(type) ? hash : text,
  );
</script>

<div class="min-h-screen relative overflow-hidden bg-gradient-dark">
  <!-- Payment Success Overlay -->
  {#if showingSuccess}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-lg">
      <Success
        {amount}
        {rate}
        tip={tip || 0}
        currency={invoice?.user?.currency || 'USD'}
        {locale}
        title={$t("invoice.paymentSuccessful") || "Payment Received!"}
      />
    </div>
  {/if}

  <!-- Animated background mesh with aurora effect -->
  <div class="absolute inset-0">
    <div class="absolute inset-0 aurora-bg opacity-5"></div>
    <div
      class="absolute top-0 -left-4 w-96 h-96 bg-dgen-aqua rounded-full mix-blend-screen filter blur-3xl opacity-20 blob"
    ></div>
    <div
      class="absolute top-0 -right-4 w-96 h-96 bg-dgen-cyan rounded-full mix-blend-screen filter blur-3xl opacity-20 blob"
      style="animation-delay: 2s;"
    ></div>
    <div
      class="absolute -bottom-8 left-20 w-96 h-96 bg-yellow-500 rounded-full mix-blend-screen filter blur-3xl opacity-20 blob"
      style="animation-delay: 4s;"
    ></div>
  </div>

  <!-- Cyber Grid overlay -->
  <div class="absolute inset-0 cyber-grid opacity-20"></div>

  <!-- Particle System -->
  <div class="particles">
    {#each Array(15) as _, i}
      <div
        class="particle"
        style="left: {Math.random() * 100}%; animation-delay: {Math.random() *
          20}s; animation-duration: {15 + Math.random() * 10}s"
      ></div>
    {/each}
  </div>

  <!-- Content Container -->
  <div class="invoice container mx-auto max-w-xl px-4 py-20 relative z-10">
    <!-- Title with epic glow effect -->
    <div class="text-center mb-8 animate-fadeInUp">
      <h1 class="text-4xl md:text-5xl font-bold mb-2">
        <span class="gradient-text">Payment</span>
        <span class="text-yellow-400 lightning mx-2">⚡</span>
        <span class="gradient-text">Invoice</span>
      </h1>
      <p class="text-xl text-white/70">{isPaid ? 'Payment Received!' : 'Scan, Pay, Done'}</p>
    </div>

    <!-- Main content card with glassmorphism -->
    <div
      class="premium-card backdrop-blur-xl bg-white/5 border-2 transition-all duration-500 space-y-4 animate-scaleIn {isPaid ? 'border-green-400 shadow-lg shadow-green-400/30' : 'border-white/10 hover:border-purple-500/40'}"
    >
      {#if isPaid && !showingSuccess}
        <div class="bg-green-500/20 border border-green-400 rounded-lg p-3 text-center">
          <p class="text-green-400 font-bold flex items-center justify-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            Invoice Paid
          </p>
        </div>
      {/if}
      <InvoiceData
        {src}
        {link}
        {txt}
        {invoice}
        {amount}
        {amountFiat}
        {currency}
        {locale}
        {tip}
        {rate}
        showQr={$showQr}
        t={$t}
      />

      <InvoiceActions
        bind:newAmount
        {setAmount}
        {setType}
        {toggleType}
        {toggleAmount}
        {toggleMemo}
        {user}
        {invoice}
        {copy}
        {link}
        {type}
        {txt}
        t={$t}
        bind:showQr={$showQr}
      />
    </div>

    <!-- Feature badges -->
    <div
      class="flex flex-wrap justify-center gap-3 mt-8 animate-slideInRight"
      style="animation-delay: 0.2s;"
    >
      <div
        class="glass px-4 py-2 rounded-full border border-yellow-400/30 hover:border-yellow-400 transition-all hover:scale-105 hover:shadow-lg hover:shadow-yellow-400/20"
      >
        <span class="text-yellow-400 font-semibold text-sm">⚡ Instant</span>
      </div>
      <div
        class="glass px-4 py-2 rounded-full border border-green-400/30 hover:border-green-400 transition-all hover:scale-105 hover:shadow-lg hover:shadow-green-400/20"
      >
        <span class="text-green-400 font-semibold text-sm">🔒 Secure</span>
      </div>
      <div
        class="glass px-4 py-2 rounded-full border border-purple-400/30 hover:border-purple-400 transition-all hover:scale-105 hover:shadow-lg hover:shadow-purple-400/20"
      >
        <span class="text-purple-400 font-semibold text-sm">🌐 Global</span>
      </div>
    </div>
  </div>
</div>

<SetAmount
  bind:newAmount
  bind:fiat
  {currency}
  {locale}
  {rate}
  {settingAmount}
  {setAmount}
  {toggleAmount}
  amountPrompt={$amountPrompt}
  t={$t}
/>

<SetMemo bind:memo {settingMemo} {setMemo} {toggleMemo} t={$t} />

<SetType
  bind:newAmount
  {setAmount}
  {invoice}
  {user}
  {type}
  {settingType}
  {setType}
  {toggleType}
  t={$t}
/>

