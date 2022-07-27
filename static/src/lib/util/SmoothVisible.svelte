<script>
	import { timing } from "$util/Tools.js";

	export let input;
	export let output;

	export let showAfter = 150;
	export let minShowTime = 500;

	let showTask, lastShownTime, hideTask, lastInput;

	const inputChanged = _ => {
		if (output == null) {
			output = input;
			lastInput = input;
		}
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
				hideTask = timing.setTimeoutOrImmediate(_ => {
					output = false;
				}, minShowTime - (new Date() - lastShownTime));
			}
		}
	};

	$: inputChanged(input);
</script>