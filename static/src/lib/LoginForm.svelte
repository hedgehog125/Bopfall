<script>
	import MobileNewLine from "$util/MobileNewLine.svelte";
	import { response, ui } from "$util/Tools.js";
import { debug } from "svelte/internal";

	export let handleLogin;

	const DISPLAY_AFTER = 100;
	const MIN_CONNECT_TIME = 750;
	const smoothedConnectVisible = ui.smoothVisible(DISPLAY_AFTER, MIN_CONNECT_TIME);

	let domain;
	let password;
	let step = 0;
	let connectionStep;
	const connectionSteps = [
		"Pinging server",
		"Waiting for the server to start"
	];
	let domainCheckStatus;

	const handleLoginInternal = _ => {
		if (step == 1) {
			//handleLogin();
		}
		else {
			checkServer();
			step = 1;
		}
	};

	const checkServer = async _ => {
		let url = domain.includes("://")? domain : "https://" + domain;

		domainCheckStatus = "checking";
		connectionStep = 0;
		let res;
		try {
			res = await fetch(`${url}/info`);
		}
		catch (error) {
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

		connectionStep = 1;

		res = null;
		try {
			res = await fetch(`${url}/waitUntilStart`);
		}
		catch {
			displayError(0);
			return;
		}
		if (res) {
			if (res.status != 200) {
				displayError(2);
				return;
			}
		}

		await new Promise(resolve => {setTimeout(_ => {
			resolve();
		}, 5000)});

		domainCheckStatus = "ok";
	};

	const displayError = code => {
		debugger;
		domainCheckStatus = "invalid";
		if (code == 0) { // No connection, use a popup instead of going back in the form

		}
		else if (code == 1) { // Invalid server response, not Bopfall server

		}
		else if (code == 2) { // Server failed to properly start

		}

		if (code != 0) {

		}
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
	{#if smoothedConnectVisible(domainCheckStatus == "checking", smoothedConnectVisible.rerender)}
		<div>
			<p>
				{connectionSteps[connectionStep]} ({connectionStep + 1}/2)
			</p>
		</div>
	{/if}
	<form on:submit|preventDefault={handleLoginInternal}>
		{#if step == 0}
			<input type="text" bind:value={domain} aria-label="The domain name to connect to" placeholder="Enter a domain..." name="username" autocomplete="username">
		{:else}
			<input type="password" bind:value={password} aria-label="Your password" placeholder="Enter your password..." name="password" autocomplete="current-password">
		{/if}
		<MobileNewLine></MobileNewLine>
		<button type="submit" disabled={step == 1 && domainCheckStatus != "ok"}>{step == 0? "Next" : "Connect"}</button>
	</form>
</main>

<style>
	div {
		border-top: 5px dotted #EFEFEF;
		border-bottom: 5px dotted #EFEFEF;
	}
</style>