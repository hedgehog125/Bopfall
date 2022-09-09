<script>	
	import BackendInit from "$util/BackendInit.svelte";
	import Toast from "$util/Toast.svelte";
	import InitialSetup from "$lib/InitialSetup.svelte";

	let toast;
</script>

<main>
	<BackendInit sessionNeeded={true} specialPage="initialSetup"></BackendInit>
	<Toast bind:display={toast}></Toast>
	<InitialSetup {toast}></InitialSetup>
</main>