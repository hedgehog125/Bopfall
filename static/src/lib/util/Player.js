import testFile from "$snd/test/meow.wav";
import { writable } from "svelte/store";

const audioStore = writable(null);
let audio;

audioStore.subscribe(value => {audio = value});

export const test = _ => {
	if (audio != null) return;

	const testAudio = new Audio();
	testAudio.src = testFile;
	testAudio.play();
	testAudio.volume = 0.2;
	testAudio.loop = true;

	playing = true;

	audioStore.set(testAudio);
};
export let playing = false;
