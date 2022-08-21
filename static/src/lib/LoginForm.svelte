<script>
	import * as backend from "$util/Backend.js";
	const { request } = backend;

	import MobileNewLine from "$util/MobileNewLine.svelte";

	let domain;
	let password;
	let step = 0;
	let checkServerTask;
	let displayAsSetupCode = false;

	const handleLogin = async _ => {
		if (step == 1) {
			await checkServerTask;
			if (step != 1 || backend.status.check != "ok") return;
			
			backend.login(password, displayAsSetupCode).catch(_ => {}); // Ignore any errors, it displays a message by itelf and changes page if it's all good
		}
		else {
			step = 1;
			checkServerTask = backend.changeServerURL(domain.includes("://")? domain : "https://" + domain);
			checkPasswordDisplayMode();
		}
	};

	const checkPasswordDisplayMode = async _ => {
		await checkServerTask;
		if (backend.status.check == "ok") {
			displayAsSetupCode = ! (await request.info.passwordSet());
		}
		else {
			step = 0;
		}
	};
</script>

<main>
	<h2>
		{#if step == 0}
			Enter the domain of your server...
		{:else}
			{#if displayAsSetupCode}
				Now enter your setup code...
			{:else}
				Now enter your password...
			{/if}
		{/if}
	</h2>

	<form on:submit|preventDefault={handleLogin}>
		{#if step == 0}
			<input type="text" bind:value={domain} aria-label="The domain name to connect to" placeholder="Enter a domain..." name="username" autocomplete="username">
		{:else}
			{#if displayAsSetupCode}
				<input type="text" bind:value={password} aria-label="Your setup code" placeholder="Enter your setup code..." autocomplete="one-time-code">
			{:else}
				<input type="password" bind:value={password} aria-label="Your password" placeholder="Enter your password..." name="password" autocomplete="current-password">
			{/if}
		{/if}
		<MobileNewLine></MobileNewLine>
		<button type="submit">{step == 0? "Next" : "Connect"}</button>
	</form>
</main>

<style>

</style>