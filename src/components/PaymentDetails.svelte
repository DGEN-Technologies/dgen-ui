<script>
  import { copy, f, s, sats } from "$lib/utils";
  import { t } from "$lib/translations";
  import { format } from "date-fns";
  import locales from "$lib/locales";
  import { PUBLIC_EXPLORER, PUBLIC_LIQUID_EXPLORER } from "$env/static/public";

  let { payment, user } = $props();
  let locale = $derived(user ? locales[user.language] : locales["en"]);

  // Derive payment details - SDK uses tagged union with 'type' field
  let details = $derived(payment?.details || {});

  // Payment type detection
  let isBitcoinPayment = $derived(details?.type === 'bitcoin');
  let isLightningPayment = $derived(details?.type === 'lightning');
  let isLiquidPayment = $derived(details?.type === 'liquid');

  // Check if this is a USDT payment
  let isUSDT = $derived(
    isLiquidPayment &&
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

  // Top-level transaction ID from Payment object (Liquid tx)
  let txId = $derived(payment?.txId || '');

  // Bitcoin on-chain specific fields
  let lockupTxId = $derived(isBitcoinPayment ? (details?.lockupTxId || '') : '');
  let claimTxId = $derived(
    isBitcoinPayment ? (details?.claimTxId || '') :
    isLightningPayment ? (details?.claimTxId || '') : ''
  );
  let swapId = $derived(
    isBitcoinPayment ? (details?.swapId || '') :
    isLightningPayment ? (details?.swapId || '') : ''
  );
  let refundTxId = $derived(
    isBitcoinPayment ? (details?.refundTxId || '') :
    isLightningPayment ? (details?.refundTxId || '') : ''
  );
  let refundTxAmountSat = $derived(
    isBitcoinPayment ? (details?.refundTxAmountSat || 0) :
    isLightningPayment ? (details?.refundTxAmountSat || 0) : 0
  );

  // Extract fields based on payment details type (Lightning, Bitcoin, or Liquid)
  let invoice = $derived(isLightningPayment ? (details?.invoice || '') : '');
  let paymentHash = $derived(isLightningPayment ? (details?.paymentHash || '') : '');
  let preimage = $derived(isLightningPayment ? (details?.preimage || '') : '');
  let destinationPubkey = $derived(isLightningPayment ? (details?.destinationPubkey || '') : '');
  let destination = $derived(isLiquidPayment ? (details?.destination || '') : '');

  // LNURL info (available on lightning and liquid)
  let lnurlInfo = $derived(
    (isLightningPayment || isLiquidPayment) ? (details?.lnurlInfo || null) : null
  );

  // BIP353 and payer note (available on lightning and liquid)
  let bip353Address = $derived(
    (isLightningPayment || isLiquidPayment) ? (details?.bip353Address || '') : ''
  );
  let payerNote = $derived(
    (isLightningPayment || isLiquidPayment) ? (details?.payerNote || '') : ''
  );

  // Legacy swapInfo support (for backwards compatibility)
  let swapInfo = $derived(details?.swapInfo || null);
  let refundDetails = $derived(details?.refundDetails || null);

  // Explorer URLs
  let bitcoinExplorer = $derived(PUBLIC_EXPLORER || 'https://mempool.space');
  let liquidExplorer = $derived(PUBLIC_LIQUID_EXPLORER || 'https://liquid.network');

  // Unblinding data for Liquid transactions
  let unblindingData = $derived(payment?.unblindingData || '');

  // Format explorer URL with optional unblinding data
  const formatLiquidTxUrl = (txid) => {
    const blinded = unblindingData ? `#blinded=${unblindingData}` : '';
    return `${liquidExplorer}/tx/${txid}${blinded}`;
  };

  const formatBitcoinTxUrl = (txid) => {
    return `${bitcoinExplorer}/tx/${txid}`;
  };

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
              {payment.status === 'pending' || payment.status === 'waitingFeeAcceptance' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : ''}
              {payment.status === 'failed' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : ''}
            ">
              {#if payment.status === 'complete'}
                <iconify-icon icon="ph:check-circle" width="16"></iconify-icon>
              {:else if payment.status === 'pending' || payment.status === 'waitingFeeAcceptance'}
                <iconify-icon icon="ph:clock" width="16" class="animate-pulse"></iconify-icon>
              {:else if payment.status === 'failed'}
                <iconify-icon icon="ph:x-circle" width="16"></iconify-icon>
              {/if}
              {payment.status === 'waitingFeeAcceptance' ? 'Pending' : payment.status}
            </span>
          </div>
          {#if payment.status === 'waitingFeeAcceptance'}
            <div class="text-xs text-yellow-400/80 mt-2">
              Waiting for fee acceptance
            </div>
          {/if}
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
      <h3 class="text-lg font-semibold mb-3">
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
  {#if isLightningPayment && (invoice || paymentHash || preimage || destinationPubkey)}
    <div class="card bg-base-200/50 border border-white/10">
      <div class="card-body p-4">
        <h3 class="text-lg font-semibold mb-3">
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

          {#if destinationPubkey}
            <div>
              <span class="text-white/60 block mb-1">Destination Pubkey:</span>
              <div
                class="group relative font-mono text-xs break-words bg-base-300/50 p-3 rounded-lg cursor-pointer hover:bg-base-300 transition-all hover:ring-2 hover:ring-primary/50"
                onclick={() => copyWithToast(destinationPubkey, 'Destination Pubkey')}
                title="Click to copy"
              >
                <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div class="bg-primary/90 text-primary-content px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                    <iconify-icon icon="ph:copy" width="12"></iconify-icon>
                    Copy
                  </div>
                </div>
                {destinationPubkey}
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
  {#if bip353Address}
    <div class="card bg-base-200/50 border border-white/10">
      <div class="card-body p-4">
        <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <iconify-icon icon="ph:at-bold" width="20"></iconify-icon>
          BIP353 Address
        </h3>

        <div class="flex items-center gap-2 group">
          <div class="font-mono text-sm">{bip353Address}</div>
          <button
            onclick={() => copyWithToast(bip353Address, 'BIP353 Address')}
            class="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
            title="Copy address"
          >
            <iconify-icon icon="ph:copy" width="16"></iconify-icon>
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Transaction Details - matches misty-breez payment_details_sheet.dart -->
  <!-- Primary Transaction ID (Liquid) -->
  {#if txId}
    <div class="card bg-base-200/50 border border-white/10">
      <div class="card-body p-4">
        <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <iconify-icon icon="ph:link-bold" width="20"></iconify-icon>
          Transaction ID
        </h3>

        <div class="space-y-3 text-sm">
          <div>
            <div
              class="group relative font-mono text-xs break-all bg-base-300/50 p-3 rounded-lg cursor-pointer hover:bg-base-300 transition-all hover:ring-2 hover:ring-primary/50"
              onclick={() => copyWithToast(txId, 'Transaction ID')}
              title="Click to copy"
            >
              <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div class="bg-primary/90 text-primary-content px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                  <iconify-icon icon="ph:copy" width="12"></iconify-icon>
                  Copy
                </div>
              </div>
              {txId}
            </div>
          </div>

          <div>
            <a
              href={formatLiquidTxUrl(txId)}
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-sm btn-primary gap-2"
            >
              <iconify-icon icon="ph:arrow-square-out" width="16"></iconify-icon>
              View on Liquid Explorer
            </a>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Bitcoin On-chain Transaction (claimTxId for Bitcoin swaps) -->
  {#if claimTxId && claimTxId !== txId}
    <div class="card bg-base-200/50 border border-white/10">
      <div class="card-body p-4">
        <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <img src="/images/bitcoin.svg" class="w-5 h-5" alt="Bitcoin" />
          {isBitcoinPayment && payment.paymentType === 'send' ? 'On-chain Transaction' : 'Claim Transaction'}
        </h3>

        <div class="space-y-3 text-sm">
          <div>
            <div
              class="group relative font-mono text-xs break-all bg-base-300/50 p-3 rounded-lg cursor-pointer hover:bg-base-300 transition-all hover:ring-2 hover:ring-primary/50"
              onclick={() => copyWithToast(claimTxId, 'Transaction ID')}
              title="Click to copy"
            >
              <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div class="bg-primary/90 text-primary-content px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                  <iconify-icon icon="ph:copy" width="12"></iconify-icon>
                  Copy
                </div>
              </div>
              {claimTxId}
            </div>
          </div>

          <div>
            <a
              href={isBitcoinPayment && payment.paymentType === 'send' ? formatBitcoinTxUrl(claimTxId) : formatLiquidTxUrl(claimTxId)}
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-sm btn-primary gap-2"
            >
              <iconify-icon icon="ph:arrow-square-out" width="16"></iconify-icon>
              View on {isBitcoinPayment && payment.paymentType === 'send' ? 'Bitcoin' : 'Liquid'} Explorer
            </a>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Swap ID (for Bitcoin and Lightning swaps) -->
  {#if swapId}
    <div class="card bg-base-200/50 border border-white/10">
      <div class="card-body p-4">
        <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <iconify-icon icon="ph:swap-bold" width="20"></iconify-icon>
          Swap ID
        </h3>

        <div
          class="group relative font-mono text-xs break-all bg-base-300/50 p-3 rounded-lg cursor-pointer hover:bg-base-300 transition-all hover:ring-2 hover:ring-primary/50"
          onclick={() => copyWithToast(swapId, 'Swap ID')}
          title="Click to copy"
        >
          <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div class="bg-primary/90 text-primary-content px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
              <iconify-icon icon="ph:copy" width="12"></iconify-icon>
              Copy
            </div>
          </div>
          {swapId}
        </div>
      </div>
    </div>
  {/if}


  <!-- Legacy swapInfo support (backwards compatibility) -->
  {#if swapInfo && !swapId}
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
  {#if payerNote}
    <div class="card bg-base-200/50 border border-white/10">
      <div class="card-body p-4">
        <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <iconify-icon icon="ph:chat-text-bold" width="20"></iconify-icon>
          Payer Note
        </h3>

        <div class="text-sm whitespace-pre-wrap">{payerNote}</div>
      </div>
    </div>
  {/if}
</div>