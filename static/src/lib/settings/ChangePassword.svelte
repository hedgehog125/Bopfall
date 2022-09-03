<script>
	import { request, getServerURL } from "$util/Backend.js";
	import { onMount } from "svelte";

	import passwordImage from "$img/passwordStrength.png";

	let loading = true;
	const load = async _ => {
		if (passwordSet == null) passwordSet = await request.password.status.set();

		loading = false;
	};
	onMount(load);

	let lockForm = false;
	let oldPassword;
	let newPassword, newPasswordAgain;
	const handlePasswordChange = async _ => {
		if (newPassword != newPasswordAgain) {
			toast("Confirm password doesn't match");
			return;
		}
		if (newPassword.length < 8) {
			toast("Password needs at least 8 characters");
			return;
		}
		if (newPassword.length > 128) {
			toast("Bruh, 128 characters in a password is more than enough");
			return;
		}

		lockForm = true;
		
		let ok = true;
		try {
			if (passwordSet) {
				await request.password.change.normal(oldPassword, newPassword);
			}
			else {
				await request.password.change.initial(newPassword);
			}
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

	export let passwordSet = null;
	export let handleFinish;
	export let toast;
</script>

<main>
	{#if loading}
		TODO: use SmoothVisible
	{:else}
	
		<h2>
			Choose a password
		</h2>

		<form on:submit|preventDefault={handlePasswordChange} autocomplete="on">
			<section>
			</section>

			{#if passwordSet}
				<section>
					<label for="oldPassword">Old password:</label> <br>
					<input type="password" required bind:value={oldPassword} disabled={lockForm} placeholder="Enter your current password..." name="password" autocomplete="current-password" id="oldPassword">
					<br><br>
				</section>
			{/if}
			<section>
				<label for="newPassword">New password:</label> <br>
				<input type="password" required bind:value={newPassword} disabled={lockForm} placeholder="Enter your new password..." autocomplete="new-password" id="newPassword">
				<br>
				<label for="newPasswordAgain">And repeated:</label> <br>
				<input type="password" required bind:value={newPasswordAgain} disabled={lockForm} placeholder="Your new password again..." autocomplete="new-password" id="newPasswordAgain">
			</section>

			<br>
			<section>
				<button type="submit" disabled={lockForm}>{passwordSet? "Change password" : "Set password"}</button>
			</section>
		</form>

		<br>
		<br>
		<p>
			Tip: if you're not using a password manager to generate a password for this, use the "correct horse battery staple" method. Think of 3-4 random common words, ideally make one uncommon (e.g use an acronym in its short form) and try and link them in your head.
		</p>
		<div class="imgDiv">
			<img src={passwordImage} alt="The xkcd comic illustrating the method">
			<span>
				Credit: <a href="https://xkcd.com/936/" rel="external">xkcd</a>.
			</span>
		</div>

	{/if}
</main>

<style>
	.imgDiv > img {
		display: block;
		width: 50%;
		height: auto;
	}
</style>