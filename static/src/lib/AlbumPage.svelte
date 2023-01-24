<script>
	import LoadingScreen from "$util/LoadingScreen.svelte";

	import { requireURLParam } from "$util/Tools.js";
	import { syncIfNeeded } from "$util/Backend.js";
	import { getTracks, play } from "$util/Player.js";
	import { onMount } from "svelte";
	
	let tracks;
	let loading = true;
	const load = async _ => {
		await syncIfNeeded();
		tracks = await getTracks.inAlbum(requireURLParam("id", "number"));

		loading = false;
	};
	onMount(load);
</script>

<main>
	<LoadingScreen {loading}>
		{#each tracks as track}
			<button on:click={_ => {play(track.id)}}>
				{track.name}
			</button>
		{/each}
	</LoadingScreen>
</main>