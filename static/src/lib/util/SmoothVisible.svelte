<script>
	import { setTimeoutOrImmediate } from "$util/Tools.js";
	import { onMount } from "svelte";

	export let input;
	export let output = null;

	export let showAfter = 150;
	export let minShowTime = 500;

	let showTask, lastShownTime, hideTask, lastInput;

	onMount(_ => {
		lastInput = input;
	});

	const inputChanged = _ => {
		if (input == lastInput) return;
		lastInput = input;

		if (input) {
			if (showTask == null) {
				if (hideTask != null) clearTimeout(hideTask);
				showTask = setTimeout(_ => {
					output = true;
					lastShownTime = new Date();
				}, showAfter);
			}
		}
		else {
			if (hideTask == null) {
				if (showTask != null) clearTimeout(showTask);
				hideTask = setTimeoutOrImmediate(_ => {
					output = false;
				}, minShowTime - (new Date() - lastShownTime));
			}
		}
	};

	$: inputChanged(input);
</script>

{#if output != null}
	{#if output}
		<slot name="main"></slot>
	{:else}
		<slot name="else"></slot>
	{/if}
{/if}