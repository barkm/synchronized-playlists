<script lang="ts">
	import { getPlaylists, type Playlist } from '$lib/spotify/api';
	import { onMount } from 'svelte';
	import SynchronizedPlaylists from './ListSynchronizedPlaylists.svelte';
	import CreateSynchronizedPlaylist from './CreateSynchronizedPlaylist.svelte';
	import {
		filterSychronizedPlaylists,
		synchronize,
		type SynchronizedPlaylist
	} from '$lib/synchronized';
	import Loading from './Loading.svelte';
	import { RequestCacher } from '$lib/spotify/cache';
	import { authorizedRequest } from '$lib/spotify/authorization';
	import { logged_in_guard } from '$lib/login';
	import NoPlaylists from './NoPlaylists.svelte';

	let synchronized_playlists: SynchronizedPlaylist[] | null = $state(null);
	let playlists: Playlist[] | null = $state(null);
	let disable_synchronization = $state(false);

	onMount(
		logged_in_guard(async () => {
			playlists = await getPlaylists();
			const request_cacher = new RequestCacher(authorizedRequest);
			synchronized_playlists = await filterSychronizedPlaylists(
				request_cacher.makeRequest,
				playlists
			);
		})
	);

	const synchronize_all = logged_in_guard(async () => {
		if (synchronized_playlists !== null) {
			disable_synchronization = true;
			const request_cacher = new RequestCacher(authorizedRequest);
			await Promise.all(
				synchronized_playlists.map((p) => synchronize(p, request_cacher.makeRequest))
			);
			disable_synchronization = false;
		}
	});
</script>

{#if synchronized_playlists === null || playlists === null}
	<Loading />
{:else if playlists.length === 0}
	<NoPlaylists />
{:else}
	{#if synchronized_playlists.length !== 0}
		<button onclick={synchronize_all} disabled={disable_synchronization}>synchronize all</button>
	{/if}
	<CreateSynchronizedPlaylist {playlists} bind:synchronized_playlists />
	<SynchronizedPlaylists {playlists} bind:synchronized_playlists />
{/if}
