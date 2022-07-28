import linkPage from "$util/LinkPage.js";
import { dev } from "$app/env";

export const format = {
	time: (total, count = 3) => {
		let hours = Math.floor(total / (60 * 60));
		total -= hours * (60 * 60);
		let minutes = Math.floor(total / 60);
		total -= minutes * 60;
		let seconds = total;

		let counts = [hours, minutes, seconds];
		counts.splice(0, counts.length - count);
		return counts.map(
			value => value.toString().padStart(2, "0")
		).join(":");
	},
	shorten: (text, limit) => {
		if (text.length < limit) return text;

		return text.slice(0, limit - 3) + "...";
	}
};
export const timing = {
	setTimeoutOrImmediate: (callback, delay, ...params) => {
		if (delay <= 0) callback(...params);
		else return setTimeout(callback, delay, ...params);
	}
};
export const response = {
	mime: res => {
		const typeHeader = res.headers.get("content-type");
		if (typeHeader == null) return "";
		else return typeHeader.split(";")[0];
	}
};
export const connection = {
	check: async _ => {
		if (! navigator.onLine) return false;
		if (dev) return true;

		try {
			await fetch(linkPage("ping"));
		}
		catch {
			return false;
		}
		return true;
	}
};