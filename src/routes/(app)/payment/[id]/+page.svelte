<script>
  import { browser } from "$app/environment";
  import { onMount, tick } from "svelte";
  import { t, loading } from "$lib/translations";
  import {
    copy,
    f,
    s,
    loc,
    toFiat,
    post,
    sats,
    fail,
    success,
    types,
  } from "$lib/utils";
  import Avatar from "$comp/Avatar.svelte";
  import Icon from "$comp/Icon.svelte";
  import PaymentDetails from "$comp/PaymentDetails.svelte";
  import { format } from "date-fns";
  import { PUBLIC_EXPLORER, PUBLIC_LIQUID_EXPLORER } from "$env/static/public";
  import locales from "$lib/locales";
  import { goto } from "$app/navigation";

  let { data } = $props();
  let { user, payment: initialPayment } = $state(data);
  let p = $state(initialPayment);
  let isLoading = $state(!initialPayment);
  let locale = user ? locales[user.language] : locales["en"];
  let userLocale = loc(user);

  let {
    id,
    hash,
    amount,
    created,
    confirmed,
    memo,
    rate,
    type,
    ref,
    path,
    tip,
    ourfee,
    fee = 0,
    currency,
    status,
    swapId,
  } = $derived(p || {});
  let [txid, vout] = $derived(amount > 0 && ref ? ref.split(":") : [hash]);
  let a = $derived(Math.abs(amount));

  let expl = $derived(
    {
      bitcoin: PUBLIC_EXPLORER,
      liquid: PUBLIC_LIQUID_EXPLORER,
    }[type],
  );

  let print = async () => {
    await post(`/payment/${id}/print`, { id });
    success("Printing!");
  };

  let bump = async () => {
    try {
      await post(`/payment/${id}/bump`, { id });
    } catch (e) {
      fail(e.message);
    }
  };

  let direction = $state("");

  onMount(async () => {
    // If no payment initially, wait for SDK and try to load
    if (!p && browser) {
      isLoading = true;
      try {
        // Wait for SDK to be ready
        const walletService = await import('$lib/walletService');
        let attempts = 0;
        while (!walletService.isConnected() && attempts < 30) {
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
        }

        if (walletService.isConnected()) {
          // Get all transactions
          const transactions = await walletService.getTransactions();

          // Extract payment ID from URL
          const urlParts = window.location.pathname.split('/');
          const paymentId = urlParts[urlParts.length - 1];

          // Find the payment - check all possible ID formats
          const payment = transactions.find(tx => {
            const txTime = tx.paymentTime || tx.timestamp || 0;
            return tx.txId === paymentId ||
                   tx.id === paymentId ||
                   tx.paymentHash === paymentId ||
                   tx.details?.paymentHash === paymentId ||
                   `payment_${txTime}_${tx.amountSat}_${tx.paymentType}` === paymentId;
          });

          if (payment) {
            // Get rate
            let rate = 50000;
            try {
              const fiatRates = await walletService.fetchFiatRates();
              const usdRate = fiatRates.find(r => r.coin.toUpperCase() === (user?.currency || 'USD').toUpperCase());
              if (usdRate) rate = usdRate.value;
            } catch (e) {
              console.warn('Failed to fetch fiat rates:', e);
            }

            // Set payment data
            p = {
              ...payment,
              id: payment.txId || payment.id || payment.paymentHash || paymentId,
              rate,
              currency: user?.currency || 'USD',
              created: payment.timestamp ? payment.timestamp * 1000 : payment.paymentTime * 1000,
              amount: payment.paymentType === 'receive' ? payment.amountSat : -payment.amountSat,
            };
          }
        }
      } catch (error) {
        console.error('[Payment] Failed to load payment:', error);
      } finally {
        isLoading = false;
      }
    }

    // Set direction
    let a = amount;
    if (type === types.fund) a = 0 - a;
    direction = a > 0 ? $t("payments.from") : $t("payments.to");

    if (direction)
      direction =
        direction[0].toUpperCase() + direction.substr(1, direction.length);
  });
</script>

{#snippet field(title, amount)}
  <div>
    <span class="text-lg text-secondary">{$t(title)}</span>
    <div class="flex gap-2 items-end">
      <div class="flex items-center">
        <iconify-icon
          noobserver
          icon="ph:lightning-fill"
          class="text-yellow-300"
        ></iconify-icon>{s(amount, userLocale)}
      </div>
      <span class="text-secondary text-lg">
        {f(toFiat(amount, rate), currency, userLocale)}
      </span>
    </div>
  </div>
{/snippet}

{#if p && p.id}
<div class="container mx-auto max-w-4xl px-4 py-6">
  <!-- Back Button -->
  <div class="flex items-center justify-between mb-6">
    <button
      onclick={() => goto('/payments')}
      class="btn btn-ghost gap-2"
    >
      <iconify-icon icon="ph:arrow-left" width="24"></iconify-icon>
      <span>Back to Payments</span>
    </button>
  </div>

  <!-- Use payment details component if we have SDK payment data -->
  {#if p.details || p.paymentType}
    <PaymentDetails payment={p} {user} />
  {:else}
    <!-- Fallback to original display for legacy payments -->
    <div class="space-y-8 break-all text-2xl">
  
  <h1 class="px-3 md:px-0 text-center text-3xl md:text-4xl font-semibold mb-4">
    {$t(amount < 0 ? "payments.sent" : "payments.received")}
  </h1>
  
  <!-- Status Badge -->
  {#if status}
    <div class="text-center mb-8">
      <span class="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
        {status === 'complete' || status === 'confirmed' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : ''}
        {status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : ''}
        {status === 'failed' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : ''}
      ">
        {#if status === 'complete' || status === 'confirmed'}
          <iconify-icon icon="ph:check-circle" width="20"></iconify-icon>
          <span>Completed</span>
        {:else if status === 'pending'}
          <iconify-icon icon="ph:clock" width="20" class="animate-pulse"></iconify-icon>
          <span>Pending</span>
        {:else if status === 'failed'}
          <iconify-icon icon="ph:x-circle" width="20"></iconify-icon>
          <span>Failed</span>
        {:else}
          <span>{status}</span>
        {/if}
      </span>
    </div>
  {/if}

  {#if p.with}
    <a href={`/${p.with.username}`}>
      <span class="text-lg text-secondary my-auto mr-2">{direction}</span>
      <div class="flex">
        <div class="my-auto">
          <Avatar user={p.with} size={20} disabled={true} />
        </div>
        <div class="my-auto ml-1">{p.with.username}</div>
      </div>
    </a>
  {/if}

  {@render field("payments.amount", a)}

  {#if tip}
    {@render field("invoice.tip", tip)}
    {@render field("payments.total", a + (tip || 0))}
  {/if}

  {@render field("payments.networkFee", fee)}

  {#if ourfee > 0}
    {@render field("payments.platformFee", ourfee)}
  {/if}

  <div>
    <span class="text-lg text-secondary">{$t("payments.exchangeRate")}</span>
    <div class="flex justify-left gap-2">
      <div class="text-secondary flex">
        <div class="flex mr-1">
          <div class="my-auto mr-1">1</div>
          <img src="/images/bitcoin.svg" class="w-5 my-auto" alt="Bitcoin" />
        </div>
        <div>&#61; {f(rate, currency, userLocale, 0, 0)}</div>
      </div>
      <div class="text-secondary flex">
        <div class="flex items-center">
          <iconify-icon
            noobserver
            icon="ph:lightning-fill"
            class="text-yellow-300"
          ></iconify-icon>
          {s((1 * sats) / rate)} =
          {f(1, currency, userLocale, 0, 0)}
        </div>
      </div>
    </div>
  </div>

  <div>
    <span class="text-lg text-secondary">{$t("payments.date")}</span>
    <div>
      {format(new Date(created), "h:mmaaa", { locale })}
      {format(new Date(created), "MMM d, yyyy", { locale })}
    </div>
  </div>

  {#if type === types.ecash && amount < 0}
    <a href={`/ecash/${memo}`} class="btn">
      <img src="/images/cash.png" class="w-8" alt="Cash" />
      <div>{$t("payments.ecashToken")}</div>
    </a>
  {:else if type === types.fund}
    <a href={`/fund/${memo}`} class="btn btn-accent">
      <iconify-icon noobserver icon="ph:lightning-fill" class="text-yellow-300"
      ></iconify-icon>{$t("payments.viewFund")}
    </a>
  {:else if memo?.includes("9734")}
    {@const eid = JSON.parse(memo).tags.find((t) => t[0] === "e")[1]}
    <a href={`/e/${eid}`} class="btn btn-accent">
      <img src="/images/nostr.png" class="w-8" />
      <iconify-icon noobserver icon="ph:lightning-fill" class="text-yellow-300"
      ></iconify-icon>{$t("payments.zappedEvent")}
    </a>
  {:else if memo}
    <div>
      <span class="text-lg text-secondary">{$t("payments.memo")}</span>
      <div>
        {#if memo.includes("text/plain")}
          {JSON.parse(memo)[0][1]}
        {:else}
          {memo}
        {/if}
      </div>
    </div>
  {/if}

  {#if type === types.lightning || type === types.bolt12 || type === "lightning"}
    {#if ref}
      <div>
        <span class="text-lg text-secondary">{$t("payments.preimage")}</span>
        <div class="flex items-center gap-2">
          <div class="break-all text-sm font-mono">{ref}</div>
          <button
            class="flex font-bold hover:opacity-80 mb-auto my-auto"
            onclick={() => copy(ref)}
          >
            <Icon icon="copy" style="ml-2 w-12 my-auto" />
          </button>
        </div>
      </div>
    {/if}
    
    {#if hash && hash !== id}
      <div>
        <span class="text-lg text-secondary">Payment Hash</span>
        <div class="flex items-center gap-2">
          <div class="break-all text-sm font-mono">{hash}</div>
          <button
            class="flex font-bold hover:opacity-80 mb-auto my-auto"
            onclick={() => copy(hash)}
          >
            <Icon icon="copy" style="ml-2 w-12 my-auto" />
          </button>
        </div>
      </div>
    {/if}
  {/if}

  {#if type === "bitcoin" || type === "liquid"}
    <div>
      <span class="text-lg text-secondary">Txid</span>
      <div class="flex">
        <div>
          <a
            href={`${expl}/tx/${txid}${vout ? "#vout=" + vout : ""}`}
            target="_blank"
            rel="noreferrer">{txid}</a
          >
        </div>
        <button
          class="flex font-bold hover:opacity-80 mb-auto my-auto"
          onclick={() => copy(txid)}
        >
          <Icon icon="copy" style="ml-2 w-12 my-auto" />
        </button>
      </div>
    </div>
  {/if}

  {#if path}
    <div>
      <span class="text-lg text-secondary">Path</span>
      <div class="flex">
        <div>{path}</div>
        <button
          class="flex font-bold hover:opacity-80 mb-auto my-auto"
          onclick={() => copy(path)}
        >
          <Icon icon="copy" style="ml-2 w-12 my-auto" />
        </button>
      </div>
    </div>
  {/if}

  {#if type === "bitcoin" && (status === "failed" || status === "refundable") && swapId}
    <div class="mt-8 space-y-4">
      <div class="card bg-warning/10 border-2 border-warning">
        <div class="card-body p-4">
          <div class="flex items-start gap-3">
            <div class="text-warning mt-1">
              <iconify-icon icon="ph:warning-circle" width="28"></iconify-icon>
            </div>
            <div class="flex-1">
              <h3 class="font-semibold text-lg text-warning mb-1">
                {$t("payments.refundAvailable") || "Refund Available"}
              </h3>
              <p class="text-sm opacity-90 leading-relaxed">
                {$t("payments.refundDescription") || "This on-chain payment failed and the funds can be refunded to your Bitcoin address."}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <button 
        class="btn btn-warning btn-lg w-full gap-2"
        onclick={() => goto(`/payment/${id}/refund`)}
      >
        <iconify-icon icon="ph:arrow-u-up-left" width="24"></iconify-icon>
        <span>{$t("payments.refund") || "Refund Payment"}</span>
      </button>
    </div>
  {/if}
    </div>
  {/if}
</div>
{:else if isLoading}
<div class="container mx-auto max-w-lg px-4 py-20 text-center">
  <div class="space-y-4">
    <div class="loading loading-spinner loading-lg"></div>
    <h2 class="text-2xl font-semibold">Loading Payment</h2>
    <p class="text-white/60">Please wait while we load your payment details...</p>
  </div>
</div>
{:else}
<div class="container mx-auto max-w-lg px-4 py-20 text-center">
  <div class="space-y-4">
    <iconify-icon icon="ph:warning-circle" class="text-yellow-500" width="64"></iconify-icon>
    <h2 class="text-2xl font-semibold">Payment Not Found</h2>
    <p class="text-white/60">This payment could not be found or is still being processed.</p>
    <a href="/payments" class="btn btn-primary">
      <iconify-icon icon="ph:arrow-left" width="20"></iconify-icon>
      <span class="ml-2">Back to Payments</span>
    </a>
  </div>
</div>
{/if}
