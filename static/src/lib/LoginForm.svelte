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