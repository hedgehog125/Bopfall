<script>
	import LoadingScreen from "$util/LoadingScreen.svelte";

	import { isSyncNeeded, sync } from "$util/Backend.js";
	import { test, playing } from "$util/Player.js";
	import { onMount } from "svelte";
	
	let loading = true;
	const load = async _ => {
		if (await isSyncNeeded()) await sync();

		//test();
		loading = false;
	};
	onMount(load);
</script>

<main>
	<a href="/blank">{playing}</a>

	{#if loading}
		<LoadingScreen></LoadingScreen>
	{:else}
		Play some music
	{/if}
</main>