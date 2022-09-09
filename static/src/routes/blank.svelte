<script>
	import { test } from "$util/Player.js";
	import BackendInit from "$util/BackendInit.svelte";
	import { onMount } from "svelte";

	onMount(test);
</script>

<main>
	<BackendInit></BackendInit>
</main>