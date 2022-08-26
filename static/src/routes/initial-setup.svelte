<script>
	import InitialSetup from "$lib/InitialSetup.svelte";

	import * as backend from "$util/Backend.js";
	import { onMount } from "svelte";
	onMount(_ => {
		backend.init(true, false, true);
	});
</script>

<main>
	<InitialSetup></InitialSetup>
</main>