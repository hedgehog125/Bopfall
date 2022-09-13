import path from "sandboxed-path";
import moreFS from "fs";
const fs = moreFS.promises;

import { randomUUID } from "crypto";

let storage;

export const makeExposedPromise = _ => {
	let resolve;
	let promise = new Promise(res => {
		resolve = res;
	});
	promise.resolve = resolve;
	return promise;
};
export const setStorage = value => {
	storage = value;
};
export const loadJSON = async filePath => {
	let text;
	try {
		text = await storage.readFile(filePath);
	}
	catch (error) {
		throw new Error(`Unable to read the ${filePath} file (in the dynamic storage). Error:\n\n${error}`);
	}

	try {
		return JSON.parse(text);
	}
	catch {
		throw new Error(`Invalid JSON in the ${filePath} file (in the dynamic storage).`);
	}
};
export const setFileToDefault = async (filePath, isJSON, defaultValuePath = filePath) => {
	let defaultValue = await fs.readFile(
		path.accessLocal(
			"default/" + defaultValuePath
		)
	);

	if (isJSON) {
		defaultValue = JSON.parse(defaultValue);
		await storage.writeFile(filePath, JSON.stringify(defaultValue));
		return defaultValue;
	}
	else {
		await storage.writeFile(filePath, defaultValue);
		return defaultValue;
	}
};
export const loadJSONOrDefault = async (filePath, defaultValuePath = filePath) => {
	if (! (await storage.exists(filePath))) {
		return await setFileToDefault(filePath, true, defaultValuePath);
	}

	return loadJSON(filePath);
};

export const indexArray = arr => {
	let indexed = Object.create(null, {});
	for (let item of arr) {
		indexed[item] = true;
	}
	return indexed;
};
export const uniqueID = existing => {
	while (true) {
		let id = randomUUID();
		if (! existing.has(id)) return id;
	}
};
export const stringifyNullableBool = value => value == null? "null" : value.toString();
export const waitDelay = delay => {
	return new Promise(resolve => {setTimeout(_ => {resolve()}, delay)});
};

export const parseHeaderPairs = (header, res, isAuth = true) => {
	if (isAuth) {
		if (header == null || header == "") {
			res.status(401).send("NoSessionID");
			return null;
		}
	}
	const headersList = header.split(";");

	const headers = Object.create(null, {});
	for (let pair of headersList) {
		pair = (pair[0] == " "? pair.slice(1) : pair).split(" ");

		if (pair.length != 2) {
			res.status(400).send("InvalidHeaderPair");
			return null;
		}

		headers[pair[0].toLowerCase()] = pair[1];
	}
	return headers;
};