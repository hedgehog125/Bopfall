import { request } from "$util/Backend.js";
import { removeNulls } from "$util/Tools.js";

let audio, audioURL;
export const play = async id => {
	if (audio != null) {
		audio.pause();
		URL.revokeObjectURL(audioURL);

		audio = null;
		audioURL = null;
	}

	const blob = await request.file.getBlob("track/" + id.toString(36));
	audio = new Audio(
		URL.createObjectURL(blob)
	);
	audio.play();
};
export let playing = false;

export const getRecents = async _ => {
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
