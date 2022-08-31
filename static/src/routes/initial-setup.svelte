<script>
	import Toast from "$util/Toast.svelte";
	import InitialSetup from "$lib/InitialSetup.svelte";

	import * as backend from "$util/Backend.js";
	import { onMount } from "svelte";
	onMount(_ => {
		backend.init(true, false, true);
	});

	let toast;
</script>

<main>
	<Toast bind:display={toast}></Toast>
	<InitialSetup {toast}></InitialSetup>
</main>