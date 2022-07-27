<script>
	import { onMount } from "svelte";
	import linkPage from "$util/LinkPage.js";

	onMount(_ => {
		const loggedIn = false; // TODO
		if (! loggedIn) location.href = linkPage("login");
	});
</script>

<main>
	
</main>