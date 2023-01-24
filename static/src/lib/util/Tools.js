import { base } from "$app/paths";
import { goto } from "$app/navigation";
import { dev } from "$app/environment";

export function linkPage(href) {
	if (href.endsWith("/")) href = href.slice(0, -1);

    return base + "/" + href;
};

export function formatTime(total, count = 3) {
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
};
export const formatURL = url => url.includes("://")? url : "https://" + url;

export function setTimeoutOrImmediate(callback, delay, ...params) {
	if (delay <= 0) callback(...params);
	else return setTimeout(callback, delay, ...params);
};
export function makeExposedPromise() {
	let resolve;
	let promise = new Promise(res => {
		resolve = res;
	});
	promise.resolve = resolve;
	return promise;
};

export const navigateTo = {
	url: url => {
		goto(url);
	},
	originalPage: _ => {
		const url = new URL(location.href);

		let returnPage = url.searchParams.get("returnTo");
		if (returnPage == null || returnPage == url.pathname) returnPage = "";
		else if (returnPage[0] == "/") returnPage = returnPage.slice(1);

		goto(linkPage(returnPage));
	},
	temporaryPage: path => {
		const url = new URL(location.href);
		url.searchParams.set("returnTo", url.pathname);
		url.pathname = linkPage(path);

		goto(url);
	},
	anotherTemporary: path => {
		const url = new URL(location.href);
		url.pathname = linkPage(path);

		goto(url);
	}
};

export function requireURLParam(name, type = "string") {
	const url = new URL(location.href);

	let valid = true;
	let param;
	if (url.searchParams.has(name)) {
		param = url.searchParams.get(name);
		if (type == "number") {
			param = parseFloat(param);
			if (isNaN(param)) valid = false;
		}
	}
	else valid = false;

	if (! valid) {
		goto(linkPage(""));
		throw new Error("Missing or invalid search parameter, going to homepage...");
	}
	return param;
};
export function getResponseMime(res) {
	const typeHeader = res.headers.get("content-type");
	if (typeHeader == null) return "";
	else return typeHeader.split(";")[0];
};
export async function checkConnection() {
	if (! navigator.onLine) return false;
	if (dev) return true;

	try {
		await fetch(linkPage("ping"));
	}
	catch {
		return false;
	}
	return true;
};

export const db = {
	readParrelel: async (db, allProperties) => {
		let read = {};
		let promises = [];
		for (let [store, properties] of Object.entries(allProperties)) {
			for (let property of properties) {
				promises.push((async _ => {
					read[property] = await db.get(store, property);
				})());
			}
		}
	
		await Promise.all(promises);
		return read;
	},
	writeParrelel: async (db, allPropertiesAndValues, replace = false, transaction) => {
		let promises = [];
		for (let [store, properties] of Object.entries(allPropertiesAndValues)) {
			for (let [property, value] of Object.entries(properties)) {
				promises.push((async _ => {
					if (transaction) {
						let storeOb = transaction.objectStore(store);
						if (replace) {
							await storeOb.put(value, property);
						}
						else {
							await storeOb.add(value, property);
						}
					}
					else {
						if (replace) {
							await db.put(store, value, property);
						}
						else {
							await db.add(store, value, property);
						}
					}
				})());
			}
		}
	
		if (transaction) promises.push(transaction.done);
		await Promise.all(promises);
	}
};
export const removeNulls = arr => arr.filter(value => value != null);