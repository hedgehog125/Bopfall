<script>
	import Toast from "$util/Toast.svelte";
	import LoginForm from "$lib/LoginForm.svelte";
	import BackendInit from "$util/BackendInit.svelte";
</script>

<main>
	<BackendInit specialPage="login"></BackendInit>
	<Toast></Toast>
	<LoginForm></LoginForm>
</main>