<script>
  import PaymentsList from "$comp/PaymentsList.svelte";

  let { data } = $props();
  let { user } = $derived(data);

  // The payments list component handles everything internally:
  // - Pagination with virtual scrolling
  // - Filtering (date, type, status, search)
  // - Real-time updates via SDK events
  // - Automatic refresh every 30 seconds
  // - IndexedDB persistence for offline support
  // - Optimistic UI updates
  // - CSV export
  // - Proper loading/empty/error states
</script>

<!-- Use the payments list component -->
<PaymentsList {user} />
