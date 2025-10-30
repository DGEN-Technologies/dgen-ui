<script>
  import { copy, f, s, sats } from "$lib/utils";
  import { t } from "$lib/translations";
  import { format } from "date-fns";
  import locales from "$lib/locales";

  let { payment, user } = $props();
  let locale = $derived(user ? locales[user.language] : locales["en"]);

  // Derive payment details - SDK uses tagged union, need to access based on tag
  let details = $derived(payment?.details || {});

  // Check if this is a USDT payment
  let isUSDT = $derived(
    details?.type === 'liquid' &&
    details?.assetId === 'ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2'
  );

  // For USDT, use assetInfo.amount from details
  let displayAmount = $derived(() => {
    if (isUSDT && details?.assetInfo?.amount !== undefined) {
      // SDK provides the actual USDT amount as a decimal in assetInfo.amount
      // Convert to smallest unit (multiply by 10^8)
      return Math.round(details.assetInfo.amount * 100000000);
    }
    return payment?.amountSat || 0;
  });

  // Extract fields based on payment details type (Lightning, Bitcoin, or Liquid)
  // The SDK returns details as a tagged union with a 'tag' field
  let invoice = $derived(
    details?.invoice ||
    details?.data?.invoice ||
    (details?.tag === 'lightning' ? details.invoice : '')
  );
  let paymentHash = $derived(
    details?.paymentHash ||
    details?.data?.paymentHash ||
    (details?.tag === 'lightning' ? details.paymentHash : '')
  );
  let preimage = $derived(
    details?.preimage ||
    details?.data?.preimage ||
    (details?.tag === 'lightning' ? details.preimage : '')
  );
  let destination = $derived(
    details?.destination ||
    details?.destinationPubkey ||
    details?.data?.destination ||
    (details?.tag === 'lightning' ? details.destination : '')
  );
  let swapInfo = $derived(details?.swapInfo || details?.data?.swapInfo);
  let lnurlInfo = $derived(details?.lnurlInfo || details?.data?.lnurlInfo);
  let refundDetails = $derived(details?.refundDetails || details?.data?.refundDetails);

  // Helper to format timestamps
  const formatTime = (timestamp) => {
    if (!timestamp || timestamp === 0) return "--";
    // Handle both seconds and milliseconds timestamps
    const date = timestamp > 10000000000 ? new Date(timestamp) : new Date(timestamp * 1000);
    return format(date, "h:mmaaa MMM d, yyyy", { locale });
  };

  // Helper for copy with toast
  const copyWithToast = async (text, label) => {
    await copy(text);
    // Could add toast notification here
  };
</script>

<div class="space-y-6">
  <!-- Status Section -->
  <div class="card bg-base-200/50 border border-white/10">
    <div class="card-body p-4">
      <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
        <iconify-icon icon="ph:info-bold" width="20"></iconify-icon>
        Status Information
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <span class="text-white/60">Status:</span>
          <div class="flex items-center gap-2 mt-1">
            <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium
              {payment.status === 'complete' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : ''}
              {payment.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : ''}
              {payment.status === 'failed' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : ''}
            ">
              {#if payment.status === 'complete'}
                <iconify-icon icon="ph:check-circle" width="16"></iconify-icon>
              {:else if payment.status === 'pending'}
                <iconify-icon icon="ph:clock" width="16" class="animate-pulse"></iconify-icon>
              {:else if payment.status === 'failed'}
                <iconify-icon icon="ph:x-circle" width="16"></iconify-icon>
              {/if}
              {payment.status}
            </span>
          </div>
        </div>

        <div>
          <span class="text-white/60">Payment Time:</span>
          <div class="font-mono text-sm mt-1">
            {formatTime(payment.paymentTime || payment.timestamp || payment.created)}
          </div>
        </div>

        {#if payment.pendingExpirationBlock}
          <div>
            <span class="text-white/60">Expires at Block:</span>
            <div class="font-mono text-sm mt-1">{payment.pendingExpirationBlock}</div>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Amount Details -->
  <div class="card bg-base-200/50 border border-white/10">
    <div class="card-body p-4">
      <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
        <iconify-icon icon="ph:lightning-bold" width="20" class="text-yellow-400"></iconify-icon>
        Payment Amount
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <span class="text-white/60">Amount:</span>
          {#if isUSDT}
            <div class="text-xl font-bold mt-1">{(displayAmount() / 100000000).toFixed(2)} USDT</div>
            <div class="text-sm text-white/40">
              ${(displayAmount() / 100000000).toFixed(2)}
            </div>
          {:else}
            <div class="text-xl font-bold mt-1">{s(displayAmount())} sats</div>
            <div class="text-sm text-white/40">
              {f((displayAmount() / sats) * (payment.rate || 50000), payment.currency || 'USD', locale)}
            </div>
          {/if}
        </div>

        {#if payment.feesSat > 0}
          <div>
            <span class="text-white/60">Network Fee:</span>
            <div class="font-mono text-sm mt-1">{s(payment.feesSat)} sats</div>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Lightning Details -->
  {#if invoice || paymentHash || preimage}
    <div class="card bg-base-200/50 border border-white/10">
      <div class="card-body p-4">
        <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <iconify-icon icon="ph:lightning-bold" width="20" class="text-yellow-400"></iconify-icon>
          Lightning Details
        </h3>

        <div class="space-y-4 text-sm">
          {#if invoice}
            <div>
              <span class="text-white/60 block mb-1">Invoice:</span>
              <div
                class="group relative font-mono text-xs break-words bg-base-300/50 p-3 rounded-lg max-h-32 overflow-y-auto cursor-pointer hover:bg-base-300 transition-all hover:ring-2 hover:ring-primary/50"
                onclick={() => copyWithToast(invoice, 'Invoice')}
                title="Click to copy"
              >
                <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div class="bg-primary/90 text-primary-content px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                    <iconify-icon icon="ph:copy" width="12"></iconify-icon>
                    Copy
                  </div>
                </div>
                {invoice}
              </div>
            </div>
          {/if}

          {#if paymentHash}
            <div>
              <span class="text-white/60 block mb-1">Payment Hash:</span>
              <div
                class="group relative font-mono text-xs break-words bg-base-300/50 p-3 rounded-lg cursor-pointer hover:bg-base-300 transition-all hover:ring-2 hover:ring-primary/50"
                onclick={() => copyWithToast(paymentHash, 'Payment Hash')}
                title="Click to copy"
              >
                <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div class="bg-primary/90 text-primary-content px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                    <iconify-icon icon="ph:copy" width="12"></iconify-icon>
                    Copy
                  </div>
                </div>
                {paymentHash}
              </div>
            </div>
          {/if}

          {#if preimage}
            <div>
              <span class="text-white/60 block mb-1">Preimage:</span>
              <div
                class="group relative font-mono text-xs break-words bg-base-300/50 p-3 rounded-lg cursor-pointer hover:bg-base-300 transition-all hover:ring-2 hover:ring-primary/50"
                onclick={() => copyWithToast(preimage, 'Preimage')}
                title="Click to copy"
              >
                <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div class="bg-primary/90 text-primary-content px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                    <iconify-icon icon="ph:copy" width="12"></iconify-icon>
                    Copy
                  </div>
                </div>
                {preimage}
              </div>
            </div>
          {/if}

          {#if destination}
            <div>
              <span class="text-white/60 block mb-1">Destination:</span>
              <div
                class="group relative font-mono text-xs break-words bg-base-300/50 p-3 rounded-lg cursor-pointer hover:bg-base-300 transition-all hover:ring-2 hover:ring-primary/50"
                onclick={() => copyWithToast(destination, 'Destination')}
                title="Click to copy"
              >
                <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div class="bg-primary/90 text-primary-content px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                    <iconify-icon icon="ph:copy" width="12"></iconify-icon>
                    Copy
                  </div>
                </div>
                {destination}
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- LNURL Details -->
  {#if lnurlInfo}
    <div class="card bg-base-200/50 border border-white/10">
      <div class="card-body p-4">
        <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <iconify-icon icon="ph:link-bold" width="20"></iconify-icon>
          LNURL Information
        </h3>

        <div class="space-y-3 text-sm">
          {#if lnurlInfo.lightningAddress}
            <div>
              <span class="text-white/60">Lightning Address:</span>
              <div class="font-mono text-sm mt-1">{lnurlInfo.lightningAddress}</div>
            </div>
          {/if}

          {#if lnurlInfo.payDomain}
            <div>
              <span class="text-white/60">Pay Domain:</span>
              <div class="font-mono text-sm mt-1">{lnurlInfo.payDomain}</div>
            </div>
          {/if}

          {#if lnurlInfo.payComment}
            <div>
              <span class="text-white/60">Comment:</span>
              <div class="mt-1">{lnurlInfo.payComment}</div>
            </div>
          {/if}

          {#if lnurlInfo.successAction}
            <div>
              <span class="text-white/60">Success Action:</span>
              <div class="mt-1">
                {#if lnurlInfo.successAction.message}
                  <div class="p-2 bg-base-300 rounded">{lnurlInfo.successAction.message}</div>
                {/if}
                {#if lnurlInfo.successAction.url}
                  <a href={lnurlInfo.successAction.url} target="_blank" class="link link-primary">
                    Open Success URL
                  </a>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- BIP353 Address -->
  {#if details.bip353Address}
    <div class="card bg-base-200/50 border border-white/10">
      <div class="card-body p-4">
        <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <iconify-icon icon="ph:at-bold" width="20"></iconify-icon>
          BIP353 Address
        </h3>

        <div class="flex items-center gap-2 group">
          <div class="font-mono text-sm">{details.bip353Address}</div>
          <button
            onclick={() => copyWithToast(details.bip353Address, 'BIP353 Address')}
            class="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
            title="Copy address"
          >
            <iconify-icon icon="ph:copy" width="16"></iconify-icon>
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Swap Details -->
  {#if swapInfo}
    <div class="card bg-base-200/50 border border-white/10">
      <div class="card-body p-4">
        <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <iconify-icon icon="ph:swap-bold" width="20"></iconify-icon>
          Swap Information
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {#if swapInfo.swapId}
            <div>
              <span class="text-white/60">Swap ID:</span>
              <div class="flex items-center gap-2 mt-1">
                <div class="font-mono text-xs">{swapInfo.swapId.substring(0, 16)}...</div>
                <button
                  onclick={() => copyWithToast(swapInfo.swapId, 'Swap ID')}
                  class="btn btn-ghost btn-sm"
                >
                  <iconify-icon icon="ph:copy" width="16"></iconify-icon>
                </button>
              </div>
            </div>
          {/if}

          {#if swapInfo.bitcoinAddress}
            <div>
              <span class="text-white/60">Bitcoin Address:</span>
              <div class="flex items-center gap-2 mt-1">
                <div class="font-mono text-xs">{swapInfo.bitcoinAddress.substring(0, 16)}...</div>
                <button
                  onclick={() => copyWithToast(swapInfo.bitcoinAddress, 'Bitcoin Address')}
                  class="btn btn-ghost btn-sm"
                >
                  <iconify-icon icon="ph:copy" width="16"></iconify-icon>
                </button>
              </div>
            </div>
          {/if}

          {#if swapInfo.createdAt}
            <div>
              <span class="text-white/60">Created At:</span>
              <div class="font-mono text-xs mt-1">{formatTime(swapInfo.createdAt)}</div>
            </div>
          {/if}

          {#if swapInfo.paidSat}
            <div>
              <span class="text-white/60">Paid Amount:</span>
              <div class="font-mono text-sm mt-1">{s(swapInfo.paidSat)} sats</div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Refund Details -->
  {#if refundDetails || (payment.status === 'failed' && swapInfo)}
    <div class="card bg-warning/10 border-2 border-warning">
      <div class="card-body p-4">
        <h3 class="text-lg font-semibold mb-3 flex items-center gap-2 text-warning">
          <iconify-icon icon="ph:warning-circle-bold" width="20"></iconify-icon>
          Refund Information
        </h3>

        {#if refundDetails}
          <div class="space-y-3 text-sm">
            {#if refundDetails.refundTxId}
              <div>
                <span class="text-white/60">Refund Transaction ID:</span>
                <div class="flex items-center gap-2 mt-1">
                  <div class="font-mono text-xs">{refundDetails.refundTxId}</div>
                  <button
                    onclick={() => copyWithToast(refundDetails.refundTxId, 'Refund TX ID')}
                    class="btn btn-ghost btn-sm"
                  >
                    <iconify-icon icon="ph:copy" width="16"></iconify-icon>
                  </button>
                </div>
              </div>
            {/if}

            {#if refundDetails.refundTxAmountSat}
              <div>
                <span class="text-white/60">Refund Amount:</span>
                <div class="font-mono text-sm mt-1">{s(refundDetails.refundTxAmountSat)} sats</div>
              </div>
            {/if}
          </div>
        {:else if payment.status === 'failed' && swapInfo}
          <div class="text-sm">
            <p class="mb-3">This payment has failed and can be refunded to your Bitcoin address.</p>
            <a href={`/payment/${payment.id}/refund`} class="btn btn-warning btn-sm gap-2">
              <iconify-icon icon="ph:arrow-u-up-left" width="16"></iconify-icon>
              Initiate Refund
            </a>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- On-chain Details -->
  {#if details.txId}
    <div class="card bg-base-200/50 border border-white/10">
      <div class="card-body p-4">
        <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <img src="/images/bitcoin.svg" class="w-5 h-5" alt="Bitcoin" />
          On-chain Details
        </h3>

        <div class="space-y-3 text-sm">
          <div>
            <span class="text-white/60">Transaction ID:</span>
            <div class="flex items-center gap-2 mt-1">
              <div class="font-mono text-xs break-all">{details.txId}</div>
              <button
                onclick={() => copyWithToast(details.txId, 'Transaction ID')}
                class="btn btn-ghost btn-sm"
              >
                <iconify-icon icon="ph:copy" width="16"></iconify-icon>
              </button>
            </div>
          </div>

          {#if details.confirmationTime}
            <div>
              <span class="text-white/60">Confirmation Time:</span>
              <div class="font-mono text-xs mt-1">{formatTime(details.confirmationTime)}</div>
            </div>
          {/if}

          <div>
            <a
              href={`https://mempool.space/tx/${details.txId}`}
              target="_blank"
              class="btn btn-sm btn-primary gap-2"
            >
              <iconify-icon icon="ph:arrow-square-out" width="16"></iconify-icon>
              View on Explorer
            </a>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Description/Memo -->
  {#if details.description}
    <div class="card bg-base-200/50 border border-white/10">
      <div class="card-body p-4">
        <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <iconify-icon icon="ph:note-bold" width="20"></iconify-icon>
          Description
        </h3>

        <div class="text-sm whitespace-pre-wrap">{details.description}</div>
      </div>
    </div>
  {/if}

  <!-- Payer Note -->
  {#if details.payerNote}
    <div class="card bg-base-200/50 border border-white/10">
      <div class="card-body p-4">
        <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <iconify-icon icon="ph:chat-text-bold" width="20"></iconify-icon>
          Payer Note
        </h3>

        <div class="text-sm whitespace-pre-wrap">{details.payerNote}</div>
      </div>
    </div>
  {/if}
</div>