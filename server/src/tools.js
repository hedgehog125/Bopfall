import path from "sandboxed-path";
import moreFS from "fs";
const fs = moreFS.promises;

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
export const setJSONToDefault = async (filePath, defaultValuePath=filePath) => {
	let defaultValue = JSON.parse(
		await fs.readFile(
			path.accessLocal(
				"default/" + defaultValuePath
			)
		)
	);
	await storage.writeFile(filePath, JSON.stringify(defaultValue));
	return defaultValue;
};
export const loadJSONOrDefault = async (filePath, defaultValuePath=filePath) => {
	if (! (await storage.exists(filePath))) {
		return await setJSONToDefault(filePath, defaultValuePath);
	}

	return loadJSON(filePath);
};