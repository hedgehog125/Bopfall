/*
TODO

Register network event listener, display message when offline and disable some things
Prevent slashes on the end of client domains

= Tweaks =

= Optimisations =
Load some modules after initial install

= Security =

*/

let startTimestamp = performance.now();


import dotenv from "dotenv";
dotenv.config();
if (process.env.STORAGE == null) {
	throw new Error("The environment variable \"STORAGE\" is not set. Bopfall has no way to access its storage without it.");
}

import path from "sandboxed-path";
import moreFS from "fs";
const fs = moreFS.promises;

import ipPackage from "ip";
const IP = ipPackage.address();

import express from "express";
import corsAndAuth from "./src/corsAndAuth.js";
import { exit } from "process";
import * as tools from "./src/tools.js";
const {
	makeExposedPromise, loadJSONOrDefault, loadJSON,
	setJSONToDefault
} = tools;
const app = express();
let server;

import * as musicMetadata from "music-metadata";

const state = {
	started: false,
	startError: false,

	persistent: null
};
const tasks = {
	fullStart: makeExposedPromise(),
	anyFullStartResult: makeExposedPromise()
};

let config = {
	storage: JSON.parse(process.env.STORAGE)
};
let storage; // Is set when the storage module is started
let info;

const PORT = process.env.PORT?? 8000; // Loaded as part of config or from the environment variable
const LATEST_VERSIONS = {
	info: 1,
	db: 1,
	config: 1,
	persistentState: 1
};

const startServer = {
	basic: _ => {
		app.use(corsAndAuth({
			wildcardCorsRoutes: [
				"/info",
				"/waitUntilStart"
			],
			initialConfigRoutes: [ // All client domains for these requests are treated as trusted (instead of just CORS wildcard) during some of the initial config, as CORS isn't configured yet
				"/auth/initial",
				"/config/set/clientDomains"
			],
			noAuthRoutes: [
				"/info",
				"/waitUntilStart",
				"/info/passwordSet",
				"/auth"
			],
			mainConfig: config
		}, tasks.fullStart));

		// Due to the CORS details being stored in the rest of the storage, these 2 have to be allowed for all sites. But it doesn't give really any info so it's fine
		app.get("/info", (req, res) => {
			res.json({
				type: "Bopfall",
				status: state.startError? "error" : (state.started? "ready" : "starting")
			});
		});
		app.get("/waitUntilStart", async (req, res) => {
			await tasks.anyFullStartResult;
			if (state.startError) {
				res.status(500).send();
			}
			else {
				res.send();
			}
		});

		app.get("/info/passwordSet", (req, res) => {
			res.send(state.persistent.passwordSet.toString());
		});
	
		let startTime = (performance.now() - startTimestamp) / 1000;
		server = app.listen(PORT, _ => {
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
			await startServer.storageModule();
		}
		catch (error) {
			state.startError = true;
			console.error(error);
			return;
		}

		{
			const load = startServer.load;
			const setup = startServer.setup;
			await load.info();
			await setup.initialFiles();

			await load.config();
			await load.persistentState();
		}

		setInterval(periodicCommit, config.main.commitInterval);
	},

	storageModule: async _ => {
		const storageModules = JSON.parse(
			await fs.readFile(
				path.accessLocal("storageModules/config.json")
			)
		).modules;
	
		const type = config.storage.type;
		const storageModuleData = storageModules[type];
		if (storageModuleData == null) {
			throw new Error(`There's no storage module with the ID ${JSON.stringify(type)}.`);
		}
		if (storageModuleData.preventUse) {
			throw new Error(`The storage module ${JSON.stringify(type)} can only be used as a base.`);
		}
		
		// TODO: check syntax
	
		storage = await import("./storageModules/scripts/" + storageModuleData.script);
		tools.setStorage(storage);
		// TODO: check exports
	
		if (storage.init) {
			const output = storage.init(config.storage, storageModuleData);
			if (output instanceof Promise) await output;
		}
	},
	setup: {
		initialFiles: async _ => {
			if (info.initialFilesMade) return;

			await Promise.all([ // Load all the defaults and store the values in new files, in parrelel
				(async _ => {
					config.main = await setJSONToDefault("config.json");
				})(),
				(async _ => {
					state.persistent = await setJSONToDefault("persistentState.json");
				})()
			]);

			info.initialFilesMade = true;
			await storage.writeFile("info.json", JSON.stringify(info));
		}
	},
	load: {
		info: async _ => {
			info = await loadJSONOrDefault("info.json");
			if (info.type != "Bopfall") {
				throw new Error(`The dynamic storage seems to be being used by something else. The info.json contains:\n\n${text}`);
			}
		},
		config: async _ => {
			if (config.main == null) {
				config.main = await loadJSON("config.json");	
			}

			config.main.commitInterval *= 1000;
		},
		persistentState: async _ => {
			if (state.persistent == null) {
				state.persistent = await loadJSON("persistentState.json");	
			}
		}
	}
}

const periodicCommit = async _ => {
	if (storage.periodicCommit) {
		const output = storage.periodicCommit();
		if (output instanceof Promise) await output;
	}
};
const shutdown = _ => {
	console.log("\nShutting down...");
	
	const onServerStop = async _ => {
		if (storage.shutdown) {
			const output = storage.shutdown();
			if (output instanceof Promise) await output;
		}

		console.log("Successfully shut down.\n");
		exit();
	};

	if (server) {
		server.close(_ => {
			onServerStop();
		});
	}
	onServerStop();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

const start = async _ => {
	startServer.basic();
	await startServer.full();
	
	tasks.anyFullStartResult.resolve();
	if (state.startError) {
		console.log("\nWill stop in a second due to a startup error...\n");
		setTimeout(_ => { // Wait a second before stopping so clients can know there was an error
			exit(1);
		}, 1000);
		return;
	}

	state.started = true;
	tasks.fullStart.resolve();

	let startTime = (performance.now() - startTimestamp) / 1000;
	console.log(`Fully started in ${Math.round(startTime * 100) / 100}s.\n`);
};
start();