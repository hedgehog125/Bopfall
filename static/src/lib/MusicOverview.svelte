<script>
	import MusicRow from "$sub/MusicRow.svelte";

	export let recent;
</script>

<main>
	{#each recent as [title, items, rowType]}
		<h2>
			{title}
		</h2>
		<MusicRow {items} {rowType}></MusicRow>
	{/each}
</main>