const { Storage } = require("@google-cloud/storage");
let storage;
let bucket;

module.exports.init = async config => {
	storage = new Storage({
		projectId: config.project,
		keyFilename: "keys.json"
	});
	bucket = storage.bucket(config.bucket);
};

module.exports.exists = async path => (await bucket.file(path).exists())[0];

module.exports.writeFile = async (path, data) => {
	const file = bucket.file(path);
	await file.save(data);
};

module.exports.readFile = async path => {
	const file = bucket.file(path);
	return (await file.download()).toString();
};

module.exports.rename = async (path, newName) => {

};