<script>
	import { request } from "$util/Backend.js";
	import { navigateTo } from "$util/Tools.js";
	import { onMount } from "svelte";

	import ChangePassword from "$set/ChangePassword.svelte";
	import ChangeCors from "$set/ChangeCors.svelte";
	import DirectStorage from "$set/DirectStorage.svelte";

	import backIcon from "$img/back.svg";
	import editIcon from "$img/pencil.svg";

	let step = 0;
	let stepsCompleted = 0;
	const stepCount = 3;
	let revisit = false;

	$: completeRevisit = revisit && stepsCompleted == stepCount;
	$: backLocked = step == 0;

	const findStep = _ => {
		step = stepCount;
		if (corsSet) { // These only have valid data if CORS is configured
			if (directStorageStatus.enabledByConfig == null) {
				step = 2;
			}
		}
		else {
			step = 1;
		}
		if (! passwordSet) {
			step = 0;
		}

		stepsCompleted = step;
	};

	let loading = true;
	let afterCorsLoaded = false;
	let passwordSet, corsSet, directStorageStatus;
	const load = async _ => {
		{
			const promises = [
				request.password.status.set(),
				request.cors.status.clientDomainsConfigured()
			];
			passwordSet = await promises[0];
			corsSet = await promises[1];
		}
		if (corsSet) { // These can only be loaded if CORS has been configured already
			await loadAfterCorsData();
		}

		findStep();
		
		loading = false;
	};
	onMount(load);
	const loadAfterCorsData = async _ => {
		const promises = [
			request.directStorage.status.all()
		];
		directStorageStatus = await promises[0];

		afterCorsLoaded = true;
	};

	const back = _ => {
		step--;

		revisit = true;
		updateStepCache();
	};
	const updateStepCache = _ => {
		// Update or invalidate the cached server state for each of the steps
		if (step == 0) passwordSet = true;
		else if (step == 1) corsSet = true;
		else if (step == 2) directStorageStatus = null;
	};
	const next = async _ => { // Going ahead without completing steps is prevented with the button locking as opposed to something in here
		if (step == stepCount) return;

		if (completeRevisit) {
			ok();
		}
		else if (step == stepsCompleted) { // The first step that hasn't been completed yet
			revisit = false;
		}
		else if (step == 1) { // CORS has just been configured
			if (afterCorsLoaded) {
				loading = true;
				await loadAfterCorsData();
				loading = false;
			}

			step = 2;
		}
		else {
			step++;
		}
	};
	const stepComplete = _ => {
		stepsCompleted++;
		next();
	};

	let initialConfigDone = false;
	const finishConfig = async _ => {
		if (! initialConfigDone) {
			loading = true;
			
			let ok = true;
			try {
				await request.initialConfig.finish();
			}
			catch {
				ok = false;
			}

			loading = false;
			if (! ok) return;
			initialConfigDone = true;
		}
	};
	const revisitStep = async _step => {
		await finishConfig();

		step = _step;
		revisit = true;
		updateStepCache();
	};
	const ok = async _ => {
		await finishConfig();

		if (revisit) {
			step = stepCount;
			revisit = false;
		}
		else {
			navigateTo.originalPage();
		}
	};

	export let toast;
</script>

<main>
	{#if loading}
		TODO: loading symbol with SmoothVisible
	{:else}

		{#if completeRevisit || step == stepCount}
			{#if step == stepCount}
				<h1>
					Does that all look good?
				</h1> <br> <br>
			{/if}
			<button class="ok bottomRow" on:click={ok}>
				<div>
					<span>Ok</span>
				</div>
			</button>
		{:else}
			<button class="back bottomRow" on:click={back} disabled={backLocked}>
				<div>
					<img src={backIcon} alt="" width=16 height=16> <!-- Alt attribute would just be repeating the span -->
					<span>Back</span>
				</div>
			</button>
			<button class="next bottomRow" on:click={next} disabled={step >= stepsCompleted}>
				<div>
					<span>Next</span>
					<img src={backIcon} class="flipped" alt="" width=16 height=16>
				</div>
			</button>

			<span class="progress">
				Step {step + 1} of {stepCount}
			</span>
		{/if}

		{#if step == stepCount}
			{#each [
				"Password",
				"Client domains",
				"Direct storage access"
			] as stepName, index}
				<span>{stepName}</span>
				<button on:click={_ => {revisitStep(index)}}>
					<img src={editIcon} alt="Edit" width=16 height=16>
				</button>
				<br>
			{/each}
		{:else}
			{#if step == 0}
				<ChangePassword {toast} {passwordSet} handleFinish={stepComplete}></ChangePassword>
			{:else if step == 1}
				<ChangeCors handleFinish={stepComplete}></ChangeCors>
			{:else}
				<DirectStorage {directStorageStatus} handleFinish={stepComplete}></DirectStorage>
			{/if}
		{/if}

	{/if}
</main>

<style>
	button {
		background-color: #EFEFEF;

		border: 2px solid black;
		border-radius: 5px;
		box-shadow: 1.5px 1.5px 3px #000000BB;
	}
	.bottomRow {
		position: absolute;
		bottom: 15px;
	}
	button > div {
		display: flex;
		align-items: center;
		justify-content: center;

		padding-top: 7.5px;
		padding-bottom: 7.5px;
		padding-left: 2.5px;
		padding-right: 2.5px;
	}
	button > div > img {
		height: 20px;
		width: auto;
	}
	button > div > span {
		font-size: 17.5px;
	}
	.flipped {
		transform: scaleX(-1);
	}
	.back {
		left: 15px;
	}
	.back > div > span {
		padding-left: 10px;
	}
	.next {
		right: 15px;
	}
	.next > div > span {
		padding-right: 10px;
	}

	.progress {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		bottom: 15px;
	}


	.ok {
		left: 50%;
		transform: translateX(-50%);

		background-color: rgb(0, 200, 0);
	}
	.ok > div {
		padding-top: 5px;
		padding-bottom: 5px;

		font-weight: bold;
	}
	h1 {
		text-align: center;
	}
</style>