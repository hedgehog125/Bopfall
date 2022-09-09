<script>
	import SmoothVisible from "$util/SmoothVisible.svelte";

	export let loading;
</script>

<SmoothVisible input={loading}>
	<p slot="main">
		TODO: loading animation
	</p>
	<slot slot="else"></slot>
</SmoothVisible>