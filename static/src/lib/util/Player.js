import { request } from "$util/Backend.js";
import { removeNulls } from "$util/Tools.js";
import { browser } from "$app/environent";

let swProxyActive;
function init() {
	swProxyActive = navigator.serviceWorker.controller != null;
};

let audio, audioBlobURL;
export async function play(id) {
	if (audio != null) {
		audio.pause();
		if (audioBlobURL) URL.revokeObjectURL(audioBlobURL);

		audioBlobURL = null;
	}

	audio = new Audio(audioBlobURL);
	if (swProxyActive) {
		audio.src = `bopfall-sw-proxy/track/${id.toString()}`;
	}
	else {
		const blob = await request.file.getBlob("track/" + id.toString(36));
		audioBlobURL = URL.createObjectURL(blob);
		audio.src = audioBlobURL;
	}

	audio.play();
};
export let playing = false;

export async function getRecents() {
	console.log("TODO: sort by most recent");

	const musicIndex = await request.musicIndex();
	const processCollection = items => {
		items = removeNulls(
			items.map((item, index) => item == null? null : ({
				id: index,
				...item
			}))
		);

		const max = 8;
		if (items.length <= max) return [items, false];
		else return [items.slice(0, max), true];
	};

	return [ // These keys are displayed in the UI so the first letters are capitalised
		["Artists", processCollection(musicIndex.artists), "artist"],
		["Playlists", processCollection(musicIndex.playlists), "playlist"],
		["Albums", processCollection(musicIndex.albums), "album"]
	];
};
export const getTracks = {
	inAlbum: async id => {
		const musicIndex = await request.musicIndex();
		return musicIndex.tracks.map((item, index) => item == null? null : ({
			id: index,
			...item
		})).filter(track => track && track.album == id);
	}
};

if (browser) {
	init();
}