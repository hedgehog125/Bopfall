<script>
	import * as backend from "$util/Backend.js";
	const { request } = backend;
	import { formatURL } from "$util/Tools.js";

	let domain;
	$: domainChanged = domain == domain;
	let password;
	let checkServerTask;

	let displayAsSetupCode = false;
	let lockForm = false;

	const handleLogin = async _ => {
		lockForm = true;
		
		let ok = true;
		if (checkServerTask) {
			try {
				await checkServerTask;
			}
			catch {
				ok = false;
			}
		}
		if (domainChanged) {
			ok = true;
			try {
				await changeDomain(false);
			}
			catch {
				ok = false;
			}
		}
		if (ok) {
			backend.login(password, displayAsSetupCode).catch(_ => {
				lockForm = false;
			});
		}
		else {
			lockForm = false;
		}
	};

	const changeDomain = (shouldCheckDisplayMode = true) => {
		if (domain == "" || domain == null) return;

		domainChanged = false;
		checkServerTask = backend.changeServerURL(formatURL(domain));
		if (shouldCheckDisplayMode) checkPasswordDisplayMode();
		return checkServerTask;
	};

	const checkPasswordDisplayMode = async _ => {
		let ok = true;
		try {
			await checkServerTask;
		}
		catch {
			ok = false;
		}
		if (ok) {
			displayAsSetupCode = ! (await request.password.status.set());
		}
	};
</script>

<main>
	<h2>
		Welcome!
	</h2>

	<form on:submit|preventDefault={handleLogin} autocomplete="on">
		<section>
			<label for="domain">
				Domain to connect to:
			</label> <br>
			<input type="text" required bind:value={domain} on:focusout={changeDomain} disabled={lockForm} placeholder="Enter a domain..." name="username" autocomplete="username" id="domain">
		</section> <br>

		<section>
			<label for="password">
				{displayAsSetupCode? "Setup code" : "Password"}:
			</label> <br>
			<input type="password" required bind:value={password} disabled={lockForm} placeholder={displayAsSetupCode? "Enter your setup code..." : "Enter your password..."} name="password" autocomplete="current-password" id="password">
		</section> <br>

		<section>
			<button type="submit" disabled={lockForm}>Connect</button>
		</section>
	</form>
</main>

<style>

</style>