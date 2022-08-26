<script>
	import Toast from "$util/Toast.svelte";
	import LoginForm from "$lib/LoginForm.svelte";

	import * as backend from "$util/Backend.js";
	import { onMount } from "svelte";
	onMount(_ => {
		backend.init(false, true);
	});
</script>

<main>
	<Toast></Toast>
	<LoginForm></LoginForm>
</main>