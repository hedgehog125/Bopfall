<script>
	import { request } from "$util/Backend.js";

	import passwordImage from "$img/passwordStrength.png";

	let passwordSet;
	const load = async _ => {
		passwordSet = await request.password.status.set();

		handleStateKnown?.(passwordSet);
	};

	let lockForm = false;
	let oldPassword;
	let newPassword, newPasswordAgain;
	const handlePasswordChange = async _ => {
		if (newPassword != newPasswordAgain) {
			toast("Confirm password doesn't match", undefined, true);
			return;
		}
		if (newPassword.length < 8) {
			toast("Password needs at least 8 characters", undefined, true);
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

	export let handleStateKnown = null;
	export let handleFinish;
	export let toast;
</script>

<main>
	{#await load()}
		TODO: use SmoothVisible
	{:then}
		<form on:submit|preventDefault={handlePasswordChange} autocomplete="on">
			{#if passwordSet}
				<section>
					<label for="oldPassword">Old password:</label> <br>
					<input type="password" required bind:value={oldPassword} placeholder="Enter your current password..." name="password" autocomplete="current-password" id="oldPassword">
					<br><br>
				</section>
			{/if}
			<section>
				<label for="newPassword">New password:</label> <br>
				<input type="password" required bind:value={newPassword} placeholder="Enter your new password..." autocomplete="new-password" id="newPassword">
				<br>
				<label for="newPasswordAgain">And repeated:</label> <br>
				<input type="password" required bind:value={newPasswordAgain} placeholder="Your new password again..." autocomplete="new-password" id="newPasswordAgain">
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
	{/await}
</main>

<style>
	.imgDiv > img {
		display: block;
		width: 50%;
		height: auto;
	}
</style>