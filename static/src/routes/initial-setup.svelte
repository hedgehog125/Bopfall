<script>
	import * as backend from "$util/Backend.js";
	
	import Toast from "$util/Toast.svelte";
	import InitialSetup from "$lib/InitialSetup.svelte";
	import BackendInit from "$util/BackendInit.svelte";

	let toast;
</script>

<main>
	<BackendInit sessionNeeded={true} specialPage="initialSetup"></BackendInit>
	<Toast bind:display={toast}></Toast>
	<InitialSetup {toast}></InitialSetup>
</main>