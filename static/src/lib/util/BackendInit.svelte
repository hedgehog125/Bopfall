<script>
	import { onMount } from "svelte";
	import { init } from "$util/Backend.js";

	onMount(_ => {
		init(sessionNeeded, specialPage);
	});

	export let sessionNeeded = undefined;
	export let specialPage = undefined;
</script>