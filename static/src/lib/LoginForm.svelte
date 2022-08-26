<script>
	import * as backend from "$util/Backend.js";
	const { request } = backend;

	let domain;
	$: domainChanged = domain == domain;
	let password;
	let checkServerTask;

	let displayAsSetupCode = false;
	let lockForm = false;

	const handleLogin = async _ => {
		console.log("A")
		lockForm = true;
		
		let ok = true;
		if (checkServerTask) {
			console.log("D")
			try {
				await checkServerTask;
			}
			catch {
				ok = false;
			}
			console.log("E")
		}
		if (domainChanged) {
			console.log("C")
			ok = true;
			try {
				await changeDomain(false);
			}
			catch {
				ok = false;
			}
			console.log("F")
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
		console.log("=", checkServerTask)
		checkServerTask = backend.changeServerURL(domain.includes("://")? domain : "https://" + domain);
		console.log("+", checkServerTask)
		if (shouldCheckDisplayMode) checkPasswordDisplayMode();
		return checkServerTask;
	};

	const checkPasswordDisplayMode = async _ => {
		let ok = true;
		try {
			console.log("-", checkServerTask)
			await checkServerTask;
			console.log("G")
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
		<label for="domain">
			Domain:
		</label>
		<input type="text" required bind:value={domain} on:focusout={changeDomain} disabled={lockForm} aria-label="The domain name to connect to" placeholder="Enter a domain..." name="username" autocomplete="username" id="domain"> <br>

		<label for="password">
			{displayAsSetupCode? "Setup code" : "Password"}:
		</label>
		<input type="password" required bind:value={password} disabled={lockForm} aria-label={displayAsSetupCode? "Your setup code" : "Your password"} placeholder={displayAsSetupCode? "Enter your setup code..." : "Enter your password..."} name="password" autocomplete="current-password" id="password">
		<br>
		<button type="submit" disabled={lockForm}>Connect</button>
	</form>
</main>

<style>

</style>