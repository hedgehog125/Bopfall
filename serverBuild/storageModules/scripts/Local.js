// This module is more complicated than you might expect because it has to recreate a flat file system that also supports any name. Unlike a normal filesystem

import path from "sandboxed-path";
import moreFS from "fs";
const fs = moreFS.promises;

let fileIndex;
let indexUpdated = false;

export const init = async _ => {
	{
		let exists = true;
		let isDir;
		try {
			isDir = (await fs.stat("storage")).isDirectory();
		}
		catch {
			exists = false;
		}

		if (exists && (! isDir)) {
			throw new Error("The name for the required directory \"storage\" for this storage module has been taken by a file.");
		}

		if (! exists) {
			await fs.mkdir(path.accessLocal("storage"));
		}
	}

	{
		let isFile;
		try {
			isFile = (await fs.stat(path.accessLocal("storage/.fileIndex.json"))).isFile();
		}
		catch {
			await fs.writeFile(path.accessLocal("storage/.fileIndex.json"), "{}");
			fileIndex = new Map();
			indexUpdated = true;
			isFile = true;
		}

		if (! isFile) {
			throw new Error("The name for the required file \".fileIndex.json\" (in the \"storage\" folder) for this storage module has been taken by a folder.");
		}
	}

	if (fileIndex == null) {
		fileIndex = new Map(
			Object.entries(
				JSON.parse(
					await fs.readFile(path.accessLocal("storage/.fileIndex.json"))
				)
			)
		);
	}
};
export const exists = async filePath => fileIndex.has(filePath);
export const writeFile = async (filePath, data) => {
	let storedPath;
	if (! fileIndex.has(filePath)) {
		storedPath = fileIndex.size.toString(36);
		fileIndex.set(filePath, storedPath);
		indexUpdated = true;
	}
	if (storedPath == null) storedPath = fileIndex.get(filePath);

	await fs.writeFile(path.accessLocal("storage/" + storedPath), data);
};
export const readFile = async filePath => {
	if (! fileIndex.has(filePath)) {
		throw new Error("The file does not exist.");
	}

	return await fs.readFile(path.accessLocal("storage/" + fileIndex.get(filePath)));
};
export const rename = async (filePath, newName) => {
	console.log("TODO: rename");
};
export const periodicCommit = async _ => {
	await commit();
};
export const shutdown = async _ => {
	await commit();
};


const commit = async _ => {
	await saveIndex();
};

const saveIndex = async _ => {
	if (! indexUpdated) return;
	
	await fs.writeFile(
		path.accessLocal("storage/.fileIndex.json"),

		JSON.stringify(
			Object.fromEntries(
				fileIndex
			)
		)
	);
	indexUpdated = false;
};