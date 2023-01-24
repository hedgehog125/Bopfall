<script>
	import { RegisterWorker } from "sveltekit-plugin-versioned-worker/components";
</script>

<style>
	::global(*) {
		font-family: sans-serif;
	}
	:global(body) {
		background-color: #2F2F2F;
	}
	:global(button) {
		cursor: pointer;
	}
</style>

<RegisterWorker></RegisterWorker>
<slot></slot>