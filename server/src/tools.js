const path = require("sandboxed-path"); // Annoyingly, this is shared with the main file
const moreFS = require("fs");
const fs = moreFS.promises;

let storage;

module.exports = {
	makeExposedPromise: _ => {
		let resolve;
		let promise = new Promise(res => {
			resolve = res;
		});
		promise.resolve = resolve;
		return promise;
	},

	setStorage: value => {
		storage = value;
	},
	loadJSON: async filePath => {
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
	},
	setJSONToDefault: async (filePath, defaultValuePath=filePath) => {
		let defaultValue = JSON.parse(
			await fs.readFile(
				path.accessLocal(
					"default/" + defaultValuePath
				)
			)
		);
		await storage.writeFile(filePath, JSON.stringify(defaultValue));
		return defaultValue;
	},
	loadJSONOrDefault: async (filePath, defaultValuePath=filePath) => {
		if (! (await storage.exists(filePath))) {
			return await module.exports.setJSONToDefault(filePath, defaultValuePath);
		}
	
		return module.exports.loadJSON(filePath);
	}
};