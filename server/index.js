/*
TODO

Register network event listener, display message when offline and disable some things
Register error listener to shut down properly. Maybe store files using different names to normal so both are kept?
Prevent slashes on the end of client domains. Also ignore ending slashes on request urls

= Tweaks =

= Optimisations =
Load some modules after initial install

= Security =

= Small features =
Give proper error when the port is already being used
Update credits to include new packages

*/

let startTimestamp = performance.now();


import dotenv from "dotenv";
dotenv.config();
if (process.env.STORAGE == null) {
	throw new Error("The environment variable \"STORAGE\" is not set. Bopfall has no way to access its storage without it.");
}
if (process.env.INITIAL_CODE == null) {
	throw new Error("The environment variable \"INITIAL_CODE\" is not set. Bopfall won't be able to check it's you during the initial config without it.");
}

import path from "sandboxed-path";
import moreFS from "fs";
const fs = moreFS.promises;

import ipPackage from "ip";
const IP = ipPackage.address();

import * as tools from "./src/tools.js";

import express from "express";
import corsAndAuth from "./src/corsAndAuth.js";
import cookieParser from "cookie-parser";
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
	storage: JSON.parse(process.env.STORAGE),
	main: null
};
let storage; // Is set when the storage module is started
const filesUpdated = {
	info: false,
	config: false,
	state: false,
	musicIndex: false,
	login: false
};
let info, musicIndex;

const PORT = process.env.PORT?? 8000; // Loaded as part of config or from the environment variable
const LATEST_VERSIONS = {
	info: 1,
	db: 1,
	config: 1,
	state: 1
};
const MAIN_FILES = [
	["info", _ => info, value => {info = value}],
	["config", _ => config.main, value => {config.main = value}],
	["state", _ => state.persistent, value => {state.persistent = value}],
	["musicIndex", _ => musicIndex, value => {musicIndex = value}]
];
const SECONDS_TO_MS = 1000;
const MINUTES_TO_MS = SECONDS_TO_MS * 60;

const startServer = {
	basic: _ => {
		app.use(cookieParser());
		app.use(corsAndAuth({
			wildcardCorsRoutes: [ // These are here so they can be accessed while the storage is loading
				"/info",
				"/waitUntilStart"
			],
			initialConfigRoutes: [ // All client domains for these requests are treated as trusted (instead of just CORS wildcard) during some of the initial config, as CORS isn't configured yet. Only applies when CORS hasn't been configured yet 
				"/login",
				"/login/check", // TODO: remove
				"/config/set/clientDomains"
			],
			noAuthRoutes: [
				"/info",
				"/waitUntilStart",
				"/info/passwordSet",
				"/login"
			],
			mainConfig: config
		}, tasks.fullStart, state));

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
			res.send(state.persistent.auth.passwordSet.toString());
		});
		app.post("/login", express.json(), (req, res) => {
			const authState = state.persistent.auth;

			let valid = false;
			if (authState.passwordSet) {

			}
			else {
				if (req.body.password == process.env.INITIAL_CODE) {
					valid = true;
				}
			}
			if (! valid) {
				console.log(authState, req.body.password, process.env.INITIAL_CODE);
				res.status(401).send("InvalidPassword");
				return;
			}

			const sessionID = tools.uniqueID(authState.sessions);
			authState.sessions.set(sessionID, {
				isInitial: ! authState.passwordSet,
				lastRenewTime: Date.now()
			});
			filesUpdated.state = true;

			const validFor = config.main.timings.auth.validFor;
			res.cookie("session", sessionID, {
				maxAge: authState.passwordSet? validFor.normal : validFor.initial,
				httpOnly: true,
				secure: true,
				sameSite: "none"
			});
			res.send();
		});
		app.post("/login/check", (req, res) => {
			res.send("LoggedIn");
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
			await load.state();
		}

		setInterval(tick, 1000);
		setInterval(periodicCommit, config.main.timings.commitInterval);
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

			let tasks = [];
			for (let [fileName, _, setValue] of MAIN_FILES) {
				setValue(await setJSONToDefault(fileName + ".json"));
			}
			await Promise.all(tasks);

			info.initialFilesMade = true;
			filesUpdated.info = true;
		}
	},
	load: {
		info: async _ => { // This has to be created based on if it exists, rather than by the value of info.initialFilesMade like the rest of the files
			info = await loadJSONOrDefault("info.json");
			if (info.type != "Bopfall") {
				throw new Error(`The dynamic storage seems to be being used by something else. The info.json contains:\n\n${JSON.stringify(info, undefined, "\t")}`);
			}
		},
		config: async _ => {
			if (config.main == null) {
				config.main = await loadJSON("config.json");	
			}

			{
				const timings = config.main.timings;
				timings.commitInterval *= SECONDS_TO_MS;
				{
					const auth = timings.auth;

					const failedLogin = auth.failedLogin;
					failedLogin.normal *= SECONDS_TO_MS;
					failedLogin.increased *= SECONDS_TO_MS;

					const validFor = auth.validFor;
					validFor.normal *= MINUTES_TO_MS;
					validFor.initial *= MINUTES_TO_MS;
				}
			}
		},
		state: async _ => {
			if (state.persistent == null) {
				state.persistent = await loadJSON("state.json");	
			}

			{
				const auth = state.persistent.auth;
				auth.sessions = new Map(Object.entries(auth.sessions)); // Convert to map
			}
		}
	}
}

const periodicCommit = async _ => {
	await commit();
	if (storage.periodicCommit) {
		const output = storage.periodicCommit();
		if (output instanceof Promise) await output;
	}
};
const commit = async _ => {
	let tasks = [];
	for (let [fileName, value] of MAIN_FILES) {
		if (filesUpdated[fileName]) {
			value = value();
			value = JSON.stringify(value, (key, subValue) => {
				if (subValue instanceof Map) {
					return Object.fromEntries(subValue);
				}
				return subValue;
			});

			tasks.push((async _ => {
				console.log(`Committing ${fileName}.json...`);
				await storage.writeFile(fileName + ".json", value);
				console.log(`Committed ${fileName}.json`);
			})());
			filesUpdated[fileName] = false;
		}
	}
	await Promise.all(tasks);
};
const shutdown = _ => {
	console.log("\nShutting down...");
	
	const onServerStop = async _ => {
		console.log("Server stopped, committing files...");

		await commit();
		if (storage.shutdown) {
			const output = storage.shutdown();
			if (output instanceof Promise) await output;
		}

		console.log("Successfully shut down.\n");
		process.exit();
	};

	if (server) {
		server.close(_ => {
			onServerStop();
		});
	}
	else {
		onServerStop();
	}
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

const tick = _ => {
	{
		const authState = state.persistent.auth;
		const authTimings = config.main.timings.auth;
		const now = Date.now();
		for (let [id, session] of authState.sessions) {
			const validFor = session.isInitial? authTimings.validFor.initial : authTimings.validFor.normal;
			if (now - session.lastRenewTime > validFor) {
				authState.sessions.delete(id);
				filesUpdated.state = true;
			}
		}
	}
};
const start = async _ => {
	startServer.basic();
	await startServer.full();
	
	tasks.anyFullStartResult.resolve();
	if (state.startError) {
		console.log("\nWill stop in a second due to a startup error...\n");
		setTimeout(_ => { // Wait a second before stopping so clients can know there was an error
			process.exit(1);
		}, 1000);
		return;
	}

	state.started = true;
	tasks.fullStart.resolve();

	let startTime = (performance.now() - startTimestamp) / 1000;
	console.log(`Fully started in ${Math.round(startTime * 100) / 100}s.\n`);
};
start();