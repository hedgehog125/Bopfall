<script>
	import LoadingScreen from "$util/LoadingScreen.svelte";
	import MusicOverview from "$lib/MusicOverview.svelte";
	import FileUpload from "$util/FileUpload.svelte";

	import { syncIfNeeded } from "$util/Backend.js";
	import { getRecents } from "$util/Player.js";
	import { onMount } from "svelte";
	
	let recent;
	let loading = true;
	const load = async _ => {
		await syncIfNeeded();
		recent = await getRecents();

		loading = false;
	};
	onMount(load);
</script>

<main>
	<LoadingScreen {loading}>
		<MusicOverview {recent}></MusicOverview>

		<FileUpload></FileUpload>
	</LoadingScreen>
</main>