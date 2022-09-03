<script>
	import { request } from "$util/Backend.js";
	import { onMount } from "svelte";

	let loading = true;
	const load = async _ => {
		if (directStorageStatus == null) directStorageStatus = await request.directStorage.status.all();

		loading = false;
	};
	onMount(load);

	let lockButtons = false;
	const handleAnswer = async enable => {
		lockButtons = true;

		let ok = true;
		try {
			await request.directStorage.change(enable);
		}
		catch {
			ok = false;
		}

		if (ok) {
			handleFinish();
		}
		else {
			lockButtons = false;
		}
	};

	export let directStorageStatus = null;
	export let handleFinish;
</script>

<main>
	{#if loading}
		TODO: use SmoothVisible
	{:else}
	
		<h2>
			{#if directStorageStatus.supported}
				Do you want to allow direct storage access?
			{:else}
				Your storage module doesn't support direct storage access
			{/if}
		</h2>
		<p>
			Direct storage access exposes the files stored on the server (except a few internal ones), meaning you can sync or stream your music without starting up your server. This can save you money depending on how your server is hosted. There'll also be lower latency and likely quicker speeds. The files will be secured with a token to prevent unauthorised access, just note that the token won't expire unless you change your password, so it's a bit higher risk than simply logging in if you're on a shared device. But you can disable direct storage access for the current device when you log in.
		</p>

		<br>
		<br>
		{#if directStorageStatus.supported}
			<button on:click={_ => {handleAnswer(false)}} disabled={lockButtons} class="no">No</button>
			<button on:click={_ => {handleAnswer(true)}} disabled={lockButtons} class="yes">Yes</button>
		{:else}
			<button on:click={_ => {handleAnswer(false)}} disabled={lockButtons}>ok</button>
		{/if}
	{/if}
</main>

<style>
	.no {
		background-color: red;
	}
	.yes {
		background-color: green;
	}
</style>