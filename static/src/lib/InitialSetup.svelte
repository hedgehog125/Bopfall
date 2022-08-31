<script>
	import { request } from "$util/Backend.js";

	import ChangePassword from "$util/ChangePassword.svelte";

	import backIcon from "$img/back.svg";

	let step = 0;
	let stepsCompleted = 0;
	const stepCount = 3;
	let revisit = false;

	$: completeRevisit = revisit && stepsCompleted == stepCount;
	$: backLocked = step == 0;

	const load = async _ => {
		let passwordSet;
		await Promise.all([
			(async _ => {
				passwordSet = await request.password.status.set();
			})()
		]);

		step = stepCount;
		if (true) {
			step = 2;
		}
		if (true) {
			step = 1;
		}
		if (! passwordSet) {
			step = 0;
		}

		stepsCompleted = step;
	};
	const back = _ => {
		step--;
		revisit = true;
	};
	const next = _ => { // Going ahead without completing steps is prevented with the button locking as opposed to something in here
		if (step == stepCount) {

		}
		else if (step == stepsCompleted) { // The first step that hasn't been completed yet
			revisit = false;
		}
		else {
			step++;
		}
	};
	const stepComplete = _ => {
		stepsCompleted++;
		next();
	};
	const ok = _ => {

	};

	const handlePasswordStateKnown = passwordSet => {
		if (passwordSet && (! revisit)) {
			stepComplete();
		}
	};

	export let toast;
</script>

<main>
	{#await load()}
		TODO: loading symbol with SmoothVisible
	{:then}

		{#if completeRevisit || step == stepCount}
			{#if step == stepCount}
				<h1>
					Does that all look good?
				</h1> <br> <br>
			{/if}
			<button class="ok" on:click={ok}>
				<div>
					<span>Ok</span>
				</div>
			</button>
		{:else}
			<button class="back" on:click={back} disabled={backLocked}>
				<div>
					<img src={backIcon} alt="" width=16 height=16> <!-- Alt attribute would just be repeating the span -->
					<span>Back</span>
				</div>
			</button>
			<button class="next" on:click={next} disabled={step >= stepsCompleted}>
				<div>
					<span>Next</span>
					<img src={backIcon} class="flipped" alt="" width=16 height=16>
				</div>
			</button>
		{/if}

		{#if step != stepCount}
			{#if step == 0}
				<ChangePassword {toast} handleStateKnown={handlePasswordStateKnown} handleFinish={stepComplete}></ChangePassword>
			{:else if step == 1}
				Step 2
			{:else}
				Step 3
			{/if}

			<span class="progress">
				Step {step + 1} of {stepCount}
			</span>
		{/if}

	{/await}
</main>

<style> 
	button {
		position: absolute;
		bottom: 15px;

		background-color: #EFEFEF;

		border: 2px solid black;
		border-radius: 5px;
		box-shadow: 1.5px 1.5px 3px #000000BB;
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