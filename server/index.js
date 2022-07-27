/*
TODO

= Security =
Handle CORS in a safe but functional way when the config hasn't yet been loaded. Maybe don't register most endpoints or register them with default CORS initially? Maybe return early with HTTP error if not fully started, possibly could be narrow timing window due to the preflight
*/

let startTimestamp = performance.now();


require("dotenv").config();
if (process.env.STORAGE == null) {
	throw new Error("The environment variable STORAGE is not set. Bopfall has no way to access its storage without it.");
}

const path = require("sandboxed-path");
const moreFS = require("fs");
const fs = moreFS.promises;

const ipPackage = require("ip");
const IP = ipPackage.address();

const makeExposedPromise = _ => {
	let resolve;
	let promise = new Promise(res => {
		resolve = res;
	});
	promise.resolve = resolve;
	return promise;
};

const express = require("express");
const cors = require("cors");
const app = express();

const state = {
	started: false,
	error: false
};
const tasks = {
	fullStart: makeExposedPromise()
};
let config = {
	storage: JSON.parse(process.env.STORAGE)
};
let storage; // Is set when the storage module is started
const PORT = process.env.PORT?? 8000; // Loaded as part of config or from the environment variable

const loadConfig = async _ => {
	config = JSON.parse(await fs.readFile(path.accessLocal("config.json")));
};

const startStorageModule = async _ => {
	const storageModules = JSON.parse(await fs.readFile(path.accessLocal("storageModules/config.json"))).modules;

	const type = config.storage.type;
	const storageModuleData = storageModules[type];
	if (storageModuleData == null) {
		throw new Error(`There's no storage module with the ID ${JSON.stringify(type)}.`);
	}
	if (storageModuleData.preventUse) {
		throw new Error(`The storage module ${JSON.stringify(type)} can only be used as a base.`);
	}
	
	// TODO: check syntax

	storage = require(`./storageModules/scripts/${storageModuleData.script}`);	
	// TODO: check exports

	if (storage.init) {
		const output = storage.init(config.storage, storageModuleData);
		if (output instanceof Promise) await output;
	}

	if (await storage.exists("info.json")) {
		const text = await storage.readFile("info.json");
		let info;
		try {
			info = JSON.parse(text);
		}
		catch {
			throw new Error("Invalid JSON in the info.json file (in the dynamic storage).");
		}
		if (info.type != "Bopfall") {
			throw new Error(`The dynamic storage seems to be being used by something else. info.json contains:\n\n${text}`);
		}
	}
	else {
		storage.writeFile("info.json", JSON.stringify({
			type: "Bopfall"
		}));
	}
};

const startServer = {
	basic: _ => {
		// Due to the CORS details being stored in the rest of the storage, these 2 have to be allowed for all sites. But it doesn't give really any info so it's fine
		app.use("/info", cors("*"));
		app.get("/info", (req, res) => {
			res.json({
				type: "Bopfall",
				status: state.started? "ready" : "starting"
			});
		});
		app.use("/waitUntilStart", cors("*"));
		app.get("/waitUntilStart", async (req, res) => {
			await tasks.fullStart;
			if (state.error) {
				res.status(500).send();
			}
			else {
				res.send();
			}
		});
	
		let startTime = (performance.now() - startTimestamp) / 1000;
		app.listen(PORT, _ => {
			console.log(
				`Bopfall has basic started and is running on port ${PORT} using IP ${IP} in ${Math.round(startTime * 100) / 100}s.

	For access on the same machine: http://localhost:${PORT}/
	And for other devices on your LAN: http://${IP}:${PORT}/
	`
			);
		});
	},
	full: async _ => {
		try {
			await startStorageModule();
		}
		catch (error) {
			state.error = true;
			throw new Error(error);
		}
	}
}

const start = async _ => {
	startServer.basic();
	await startServer.full();
	state.started = true;
	tasks.fullStart.resolve();

	if (! state.error) {
		let startTime = (performance.now() - startTimestamp) / 1000;
		console.log(`Fully started in ${Math.round(startTime * 100) / 100}s.\n`);
	}
};
start();