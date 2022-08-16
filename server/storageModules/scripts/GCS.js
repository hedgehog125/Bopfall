const { Storage } = require("@google-cloud/storage");
let storage;
let bucket;

export const init = async config => {
	storage = new Storage({
		projectId: config.project,
		keyFilename: "keys.json"
	});
	bucket = storage.bucket(config.bucket);
};
export const exists = async path => (await bucket.file(path).exists())[0];
export const writeFile = async (path, data) => {
	const file = bucket.file(path);
	await file.save(data);
};
export const readFile = async path => {
	const file = bucket.file(path);
	return (await file.download()).toString();
};
export const rename = async (path, newName) => {
	console.log("TODO: rename")
};