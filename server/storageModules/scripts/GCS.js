const { Storage } = require("@google-cloud/storage");
let storage;
let bucket;

module.exports = {
	init: async config => {
		storage = new Storage({
			projectId: config.project,
			keyFilename: "keys.json"
		});
		bucket = storage.bucket(config.bucket);
	},
	exists: async path => (await bucket.file(path).exists())[0],
	writeFile: async (path, data) => {
		const file = bucket.file(path);
		await file.save(data);
	},
	
	readFile: async path => {
		const file = bucket.file(path);
		return (await file.download()).toString();
	},
	
	rename: async (path, newName) => {
		console.log("TODO")
	}
};