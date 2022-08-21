<script>
	import { setToast } from "$util/Backend.js";

	import { fly } from "svelte/transition";
	// TODO: display on connection change. Also use values from tools.connection.check

	let messageQueue = [];
	let currentMessage;

	const nextMessage = _ => {
		messageQueue.splice(0, 1);
		if (messageQueue.length == 0) {
			currentMessage = null;
		}
		else {
			currentMessage = messageQueue[0];
			setTimeout(nextMessage, nextMessage.duration * 1000);
		}
	};


	export const display = (message, duration = 5, isError=false) => {
		messageQueue.push({
			message,
			duration,
			isError
		});
		currentMessage = messageQueue[0];
		setTimeout(nextMessage, duration * 1000);
	};
	setToast(display);
</script>

<main>
	{#if currentMessage != null}
		<div transition:fly={{
			y: 75,
			duration: 750
		}}>
			<span>
				{#if currentMessage.isError}
					<span>Error</span>:
				{/if}
				{currentMessage.message}
			</span>
		</div>
	{/if}
</main>

<style>
	div {
		position: fixed;
		left: 50%;
		bottom: 25px;
		transform: translateX(-50%);

		display: inline-block;
		z-index: 99;
		background-color: #EFEFEF;

		border: 2px solid black;
		border-radius: 5px;
		box-shadow: 2px 2px 4px #000000CC;
	}
	span {
		display: inline-block;
		padding: 5px;

		font-size: 20px;
	}
	span > span {
		font-weight: bold;
		padding-right: 0px;
	}
</style>