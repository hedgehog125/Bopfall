<script>
	import { onMount } from "svelte";
	import * as backend from "$util/Backend.js";
	onMount(_ => {
		backend.init(false, true);
	});

	import Toast from "$util/Toast.svelte";
	import LoginForm from "$lib/LoginForm.svelte";
</script>

<main>
	<Toast></Toast>
	<LoginForm></LoginForm>
</main>