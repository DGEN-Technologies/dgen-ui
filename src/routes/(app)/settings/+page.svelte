<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  
  onMount(() => {
    // Redirect to profile settings by default
    goto('/settings/profile');
  });
</script>

<div class="flex items-center justify-center h-full">
  <p class="text-gray-500">Redirecting to settings...</p>
</div>