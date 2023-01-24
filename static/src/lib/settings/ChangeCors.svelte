<script>
	import { request } from "$util/Backend.js";
	import { formatURL } from "$util/Tools.js";
	import { onMount } from "svelte";

	import deleteIcon from "$img/close.svg";
	
	let loading = true;
	const load = async _ => {
		domains = [location.origin];

		loading = false;
	};
	onMount(load);

	let domain;
	let domains = [];
	const addNewDomain = _ => {
		domains.push(formatURL(domain));
		domains = domains;

		domain = "";
	};
	const deleteDomain = id => {
		domains.splice(id, 1);
		domains = domains;
	};

	let lockForm = false;
	const handleCorsChange = async _ => {
		lockForm = true;
		
		let ok = true;
		try {
			await request.cors.change(domains);
		}
		catch {
			ok = false;
		}

		if (ok) {
			handleFinish();
		}
		else {
			lockForm = false;
		}
	};

	export let handleFinish;
</script>

<main>
	{#if loading}
		TODO: use SmoothVisible
	{:else}
		<h2>
			Are you using any other client domains?
		</h2>
		<p>
			By default, other websites can't access your server. This is in order to prevent them from impersonating you. So if you plan on accessing this Bopfall server from any other websites, you'll need to add them here. <br> You'll be able to change these later. The answer is probably no.
		</p>
		<br>
		<br>

		<span class="bold">Domains</span>:
		<div>
			{#each domains as domain, index (index)}
				<p>
					{domain}
					{#if index == 0}
						(the current client domain)
					{:else}
						<button on:click={_ => {deleteDomain(index)}}>
							<img src={deleteIcon} alt="Delete" width=16 height=16>
						</button>
					{/if}
				</p>
			{/each}
		</div>
		<br>
		<form on:submit|preventDefault={addNewDomain} autocomplete="off">
			<section>
				<label for="domain">Add another domain:</label> <br>
				<input type="text" required bind:value={domain} disabled={lockForm} placeholder="Enter a domain..." id="domain">
				<button type="submit" disabled={lockForm}>Add</button>
			</section>
		</form>

		<br>
		<form on:submit|preventDefault={handleCorsChange}>
			<button type="submit" disabled={lockForm}>ok</button>
		</form>
	{/if}
</main>

<style>
	.bold {
		font-weight: bold;
	}

	button > img {
		display: block;
		width: 20px;
		height: 20px;
	}
</style>