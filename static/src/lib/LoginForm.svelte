<script>
	import { response, connection } from "$util/Tools.js";

	import MobileNewLine from "$util/MobileNewLine.svelte";
	import SmoothVisible from "$util/SmoothVisible.svelte";

	export let onLoginSuccess;

	let smoothedConnectVisible;
	$: connectVisible = checkServerStatus == "checking";

	let domain;
	let password;
	let step = 0;
	let connectionStep;
	const connectionSteps = [
		"Pinging server",
		"Waiting for the server to start"
	];
	let checkServerStatus, checkServerTask;

	const handleLogin = async _ => {
		if (step == 1) {
			await checkServerTask;
			if (step != 1 || checkServerStatus != "ok") return;
			
			if (! await authenticate(domain, password)) return;

			onLoginSuccess();
		}
		else {
			step = 1;
			checkServerTask = checkServer();
		}
	};

	const checkServer = async _ => {
		let url = domain.includes("://")? domain : "https://" + domain;

		checkServerStatus = "checking";
		connectionStep = 0;
		let res;
		try {
			res = await fetch(`${url}/info`);
		}
		catch {
			displayError(0);
			return;
		}

		if (response.mime(res) != "application/json") {
			displayError(1);
			return;
		}
		try {
			res = await res.json();
		}
		catch {
			displayError(1);
			return;
		}
		if (res.type != "Bopfall") {
			displayError(1);
			return;
		}
		if (res.status == "error") {
			displayError(2);
			return;
		}

		connectionStep = 1;

		try {
			res = await fetch(`${url}/waitUntilStart`);
		}
		catch (error) {
			displayError(0);
			return;
		}
		if (res.ok) res.text(); // It makes it look like an error in the console if we don't call one of the methods
		else {
			displayError(2);
			return;
		}

		checkServerStatus = "ok";
	};

	const displayError = async code => {
		checkServerStatus = "invalid";
		if (code == 0) { // No connection or an invalid domain
			if (! (await connection.check())) return; // Don't go back if it's just a connection issue
		}
		else if (code == 1) { // Invalid server response, not Bopfall server

		}
		else if (code == 2) { // Server failed to properly start
			
		}
		else if (code == 3) { // Invalid login
			password = "";
			return; // Only clear the password as that's probably what's wrong
		}

		step = 0;
		domain = "";
	};

	const authenticate = async (domain, password) => {

	};
</script>

<main>
	<h2>
		{#if step == 0}
			Enter the domain of your server...
		{:else}
			Now enter your password...
		{/if}
	</h2>

	<SmoothVisible input={connectVisible} bind:output={smoothedConnectVisible}></SmoothVisible>
	{#if smoothedConnectVisible}
		<div>
			<p>
				{connectionSteps[connectionStep]}... ({connectionStep + 1}/2)
			</p>
		</div>
	{/if}
	<form on:submit|preventDefault={handleLogin}>
		{#if step == 0}
			<input type="text" bind:value={domain} aria-label="The domain name to connect to" placeholder="Enter a domain..." name="username" autocomplete="username">
		{:else}
			<input type="password" bind:value={password} aria-label="Your password" placeholder="Enter your password..." name="password" autocomplete="current-password">
		{/if}
		<MobileNewLine></MobileNewLine>
		<button type="submit">{step == 0? "Next" : "Connect"}</button>
	</form>
</main>

<style>
	div {
		border-top: 2px dotted #EFEFEF;
		border-bottom: 2px dotted #EFEFEF;
	}
</style>