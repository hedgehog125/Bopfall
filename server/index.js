/*
TODO

Register network event listener, display message when offline and disable some things
Prevent slashes on the end of client domains
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
const corsAndAuth = require("./src/corsAndAuth.js");
const { exit } = require("process");
const app = express();
let server;

const state = {
	started: false,
	startError: false,

	persistent: {
		passwordSet: null,
		initialConfigDone: null
	}
};
const tasks = {
	fullStart: makeExposedPromise(),
	anyFullStartResult: makeExposedPromise()
};
let config = {
	storage: JSON.parse(process.env.STORAGE),
	clientDomains: null
};
let storage; // Is set when the storage module is started
const PORT = process.env.PORT?? 8000; // Loaded as part of config or from the environment variable

const loadConfig = async _ => {
	config = JSON.parse(await fs.readFile(path.accessLocal("config.json")));
};

const startServer = {
	basic: _ => {
		app.use(corsAndAuth.middleware({
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

		// TODO
		config.clientDomains = ["http://127.0.0.1:5173"];
		state.persistent.passwordSet = false;
		config.commitDelay = 30;

		setInterval(periodicCommit, config.commitDelay * 1000);
	},

	storageModule: async _ => {
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