<script lang="ts">
	import { onMount } from 'svelte';
	import { handleCallback } from '$lib/spotify/authorization';

	onMount(async () => {
		handleCallback();
	});
</script>

<svelte:head>
	<title>filtered playlists</title>
</svelte:head>
