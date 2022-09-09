<script>
	import linkPage from "$util/LinkPage.js";

	export let items;
	export let rowType;

	const getItemURL = id => {
		let url = new URL(linkPage(rowType), document.baseURI);
		url.searchParams.set("id", id);

		return url.toString();
	};
</script>

<main>
	<div>
		{#each items[0] as item}
			<a href={getItemURL(item.id)}>
				{item.name}
			</a>
		{/each}
		{#if items[1]}
			<button>
				View more...
			</button>
		{/if}
	</div>
</main>

<style>
	div {
		max-width: 100%;
		border-radius: 7.5px;
		border: 2px solid #EFEFEF;

		padding: 7.5px;
	}
</style>