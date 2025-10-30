import { browser } from '$app/environment';

export async function load({ params, parent }) {
  // Get the user from parent layout
  const parentData = await parent();
  
  if (browser) {
    try {
      // Import wallet service
      const walletService = await import('$lib/walletService');
      
      // Check if SDK is connected before fetching
      if (!walletService.isConnected()) {
        console.warn('[Payment] SDK not connected, skipping SDK fetch');
        // Fall through to server fetch
      } else {
        // Get all transactions from SDK
        const transactions = await walletService.getTransactions();

        // Get current fiat rates
        let rate = 50000; // Default
        try {
          const fiatRates = await walletService.fetchFiatRates();
          const usdRate = fiatRates.find(r => r.coin.toUpperCase() === 'USD');
          if (usdRate) rate = usdRate.value;
        } catch (e) {
          console.warn('Failed to fetch fiat rates:', e);
        }

        // Find the payment by ID
        const payment = transactions.find(tx =>
          tx.txId === params.id ||
          tx.id === params.id ||
          tx.paymentHash === params.id ||
          `payment_${tx.paymentTime}_${tx.amountSat}` === params.id
        );

        if (payment) {
          // Return payment with all SDK fields intact
          return {
            payment: {
              ...payment,
              id: payment.txId || payment.id || payment.paymentHash || params.id,
              rate,
              currency: parentData.user?.currency || 'USD',
              // Ensure these fields exist for compatibility
              created: payment.timestamp ? payment.timestamp * 1000 : payment.paymentTime * 1000,
              amount: payment.paymentType === 'receive' ? payment.amountSat : -payment.amountSat,
            },
            user: parentData.user
          };
        }
      }
    } catch (error) {
      console.error('[Payment] Failed to load payment from SDK:', error);
    }
  }
  
  // No payment found - SDK only, no backend fallback
  return {
    payment: null,
    user: parentData.user
  };
}