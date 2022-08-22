/*
TODO

Use temporary variable in changeServerURL, only update it if it's valid. Maybe set to null during it?
Wrap init, login and changeServerURL in synchronous function and store promise returned for the task. Make init throw on error
Redirect to /initialSetup if it's not done yet
Use input.setCustomValidity when errors are known about the form. Clear all with input.setCustomValidity("") when it changes

Register network event listener, display message when offline and disable some things
Register error listener to shut down properly. Maybe store files using different names to normal so both are kept?
Prevent slashes on the end of client domains. Also ignore ending slashes on request urls

= Bugs =
Check content-type is JSON when req.json is read
Initial autofill gets cleared on page load in login form
Commit the previous state of files using a backup/prefix on error, then set something in persistent state so the server won't start again until it's reset. Also log the error I guess?

= Stability =
Catch file errors and handle them where possible
Send server version in /info and have client check it in the background on connect, then error if incompatible. Maybe have syntax version?
Handle wasUpgradingTo not being -1

= Tweaks =
Rename info/initialConfigDone to status/initialConfigDone and rename request.info to request.status
Move parts of the code into tools.js
Create separate routes.js file
Await any start result then stop handling request if invalid
writeParrelel should create a transaction for all the writes. Maybe for readParrelel as well?

= Optimisations =
Load some modules after initial install
Cache backend values between pages

= Security =
Implement the fail counter and fail delays. Measure from when the check started as it can take a second

= Small features =
Add shaking animation on error in forms
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
const {
	makeExposedPromise, loadJSONOrDefault, loadJSON,
	setJSONToDefault
} = tools;
const app = express();
let server;

import * as bcrypt from "bcrypt";
import * as musicMetadata from "music-metadata";
import { createTerminus } from "@godaddy/terminus";

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
		app.use(express.json());
		app.use(corsAndAuth({
			wildcardCorsRoutes: [ // These are here so they can be accessed while the storage is loading
				"/info",
				"/waitUntilStart"
			],
			initialConfigRoutes: [ // All client domains for these requests are treated as trusted (instead of just CORS wildcard) during some of the initial config, as CORS isn't configured yet. Only applies when CORS hasn't been configured yet 
				"/login",
				"/login/status/check",
				"/config/set/clientDomains",
				"/password/change/initial",
				"/password/status/set",
				"/info/initialConfigDone"
			],
			allowedBeforeInitialConfig: [ // Like initialConfigRoutes but for after CORS has been configured. Any remaining routes for the initial config go here

			],
			noAuthRoutes: [
				"/info",
				"/info/initialConfigDone",
				"/waitUntilStart",
				"/password/status/set",
				"/login",
				"/password/change" // Has it's own authentication like /login
			],
			mainConfig: config
		}, tasks.fullStart, state));

		app.get("/info", (req, res) => {
			res.json({
				type: "Bopfall",
				status: state.startError? "error" : (state.started? "ready" : "starting")
			});
		});
		app.get("/info/initialConfigDone", (req, res) => {
			res.send(state.persistent.initialConfigDone.toString());
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

		{
			const createAndSendSession = res => {
				const authState = state.persistent.auth;

				const sessionID = tools.uniqueID(authState.sessions);
				authState.sessions.set(sessionID, {
					isInitial: ! authState.passwordSet,
					lastRenewTime: Date.now()
				});
				filesUpdated.state = true;

				res.json({
					session: sessionID
				});
			};
			const isPasswordCorrect = async req => await bcrypt.compare(req.body.password, state.persistent.auth.hash);
			const changePassword = async (req, res) => {
				const authState = state.persistent.auth;

				const sessions = authState.sessions;
				sessions.clear();
				filesUpdated.state = true;
				
				authState.hash = await bcrypt.hash(req.body.newPassword, 10);
				authState.passwordSet = true;
				filesUpdated.state = true;

				createAndSendSession(res);
			};

			app.post("/login", async (req, res) => {
				const authState = state.persistent.auth;
	
				let valid = false;
				if (authState.passwordSet) {
					if (await isPasswordCorrect(req)) {
						valid = true;
					}
				}
				else {
					if (req.body.password == process.env.INITIAL_CODE) {
						valid = true;
					}
				}
				if (! valid) {
					res.status(401).send("IncorrectPassword");
					return;
				}
	
				createAndSendSession(res);
			});
			app.post("/login/status/check", (req, res) => {
				res.send("LoggedIn");
			});
			app.post("/password/change", async (req, res) => {
				const authState = state.persistent.auth;
				if (! authState.passwordSet) {
					res.status(409).send("PasswordNotSet");
					return;
				}
				if (! (await isPasswordCorrect(req))) {
					res.status(401).send("IncorrectPassword");
					return;
				}

				await changePassword(req, res);
			});
			app.post("/password/change/initial", async (req, res) => { // The normal authentication is used for this instead of requiring the password again, as the user will have just logged in and the security is already weak during this state anyway
				const authState = state.persistent.auth;
				if (authState.passwordSet) {
					res.status(409).send("PasswordAlreadySet");
					return;
				}
	
				await changePassword(req, res);
			});
		}
		app.get("/password/status/set", (req, res) => {
			res.send(state.persistent.auth.passwordSet.toString());
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
		createTerminus(server, {
			signals: ["SIGTERM", "SIGINT"],
			beforeShutdown: _ => {
				console.log("\n\nShutting down...");
				console.log("Finishing requests... (Connection: Keep-Alive might mean this takes a second)");
			},
			onSignal: shutdown,
			onShutdown: _ => {
				console.log("\nSuccessfully shut down.\n");
			},

			timeout: 10 * SECONDS_TO_MS
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
				await storage.writeFile(fileName + ".json", value);
				console.log(`Committed ${fileName}.json`);
			})());
			filesUpdated[fileName] = false;
		}
	}
	await Promise.all(tasks);
};
const shutdown = async _ => {
	console.log("Committing files...\n");	
	await commit();

	if (storage.shutdown) {
		console.log("\nShutting down storage module...");
		const output = storage.shutdown();
		if (output instanceof Promise) await output;
	}
};

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