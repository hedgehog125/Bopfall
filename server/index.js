/*
TODO

Cache some server info on the client, keep both in memory and in db. Rely on assumptions about how it'll change like initialConfigDone won't change back to false

Use input.setCustomValidity when errors are known about the form. Clear all with input.setCustomValidity("") when it changes
Register network event listener, display message when offline and disable some things
Register error listener to shut down properly. Maybe store files using different names to normal so both are kept?
Prevent slashes on the end of client domains. Also ignore ending slashes on request urls

= Bugs =
Prevent the timeout from counting when there's an active connection
Initial autofill gets cleared on page load in login form
Commit the previous state of files using a backup/prefix on error, then set something in persistent state so the server won't start again until it's reset. Also log the error I guess?
Does the server reject requests when the origin is the same as its origin?

Handle some or all of the metadata being missing for an upload, a lot of things will be expecting it which can cause errors. e.g toLowerCase being called on a property
Add backendErrorCaught function that sets shouldStopNextDefault back to its previous value. Should be called every time a BackendError is caught internally in the Backend module

Files seem to be made in a random order? Check the fileIndex and compare with the order of MAIN_FILES

Service worker will prevent ping from working properly

= Stability =
Delete idb on server change, and prompt if there's more than a few files cached
Catch file errors and handle them where possible
Send server version in /info and have client check it in the background on connect, then error if incompatible. Maybe have syntax version?
Handle wasUpgradingTo not being -1
Handle active upload during shutdown. Set some state so it can be continued or restarted once the server is running again
Add "ready" property to music index which is only set to true when the upload has finished
Does uploading files without a valid session or server state still fill up RAM?

Fallback to accessing via server on 404. A music file might have been deleted but the new metadata hasn't been saved yet
Checks and recovery logic on sync
Handle upload errors, cancel sometimes and retry otherwise
Only allow an upload at once

= Tweaks =
Only check for updates when the sync button is clicked, or silently fail if network error
Display toast on network change

Make the buttons in the initial setup a component and remove the inner div somehow?
Move parts of the code into tools.js
Port Bagel.js' check function, remove some parts of it and make it part of jsonPlus
Create separate routes.js file
Await any start result then stop handling request if invalid
writeParrelel should create a transaction for all the writes. Maybe for readParrelel as well?

Rename to SoundDrop. The logo/loading animation is a stream that fills up because of the drops, until it's full which is 100%. The stream is continuous throughout

= Optimisations =
Preload images

Load some node.js modules after load - Not really worth it

= Security =
Implement the fail counter and fail delays. Measure from when the check started as it can take a second
Make sure the upload session system is actually preventing uploads

= Small features =
Add shaking animation on error in forms
Give proper error when the port is already being used
Update credits to include new packages

ChangeCors should load existing domains if configured

= Features =
Album, artist and track art. Artist will have to be set manually, or could be generated from the albums

*/

let startTimestamp = performance.now();
console.log("");


import dotenv from "dotenv";
if (process.env.STORAGE == null) dotenv.config();
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
const {
	makeExposedPromise, loadJSONOrDefault, loadJSON,
	setFileToDefault
} = tools;

import express from "express";
import jsonPlus from "./src/jsonPlus.js";
import corsAndAuth from "./src/corsAndAuth.js";
import fileUpload from "express-fileupload";
const app = express();
let server;

import * as bcrypt from "bcrypt";
import { parseBuffer, selectCover } from "music-metadata";
import * as mime from "mime-types";
import { createTerminus } from "@godaddy/terminus";
import { randomUUID } from "crypto";

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
let storageInfo;
const filesUpdated = {
	info: false,
	config: false,
	state: false,
	musicIndex: false,
	login: false
};
let info, musicIndex, musicIndexVersion;

const PORT = process.env.PORT?? 8000; // Loaded as part of config or from the environment variable
const LATEST_VERSIONS = {
	info: 1,
	db: 1,
	config: 1,
	state: 1
};
const MAIN_FILES = [
	["info", "json", _ => info, value => {info = value}],
	["config", "json", _ => config.main, value => {config.main = value}],
	["state", "json", _ => state.persistent, value => {state.persistent = value}],
	["musicIndex", "json", _ => musicIndex, value => {musicIndex = value}],
	["musicIndexVersion", "txt", _ => musicIndexVersion, value => {musicIndexVersion = value}]
];
const SECONDS_TO_MS = 1000;
const MB_TO_BYTES = 1000 * 1000;

const startServer = {
	basic: _ => {
		app.use(corsAndAuth({
			wildcardCorsRoutes: [ // These are here so they can be accessed while the storage is loading
				"/info",
				"/waitUntilStart"
			],
			initialConfigRoutes: [ // All client domains for these requests are treated as trusted (instead of just CORS wildcard) during some of the initial config, as CORS isn't configured yet. Only applies when CORS hasn't been configured yet 
				"/login",
				"/login/status/check",

				"/password/change/initial",
				"/password/status/set",

				"/cors/change",
				"/cors/status/clientDomainsConfigured",

				"/initialConfig/status/finished"
			],
			allowedBeforeInitialConfig: [ // Like initialConfigRoutes but for after CORS has been configured. Any remaining routes for the initial config go here
				"/directStorage/change",
				"/directStorage/status/supported",
				"/directStorage/status/enabledByModule",
				"/directStorage/status/enabledByConfig",
				"/directStorage/status/active",
				"/directStorage/status/all",

				"/initialConfig/finish"
			],
			noAuthRoutes: [
				"/info",
				"/initialConfig/status/finished",
				"/waitUntilStart",
				"/password/status/set",
				"/login",
				"/password/change" // Has it's own authentication like /login
			],
			mainConfig: config
		}, tasks.fullStart, state));
		app.use(express.json());
		app.use(jsonPlus({
			"/login": {
				password: String
			},
			"/password/change": {
				password: String,
				newPassword: String
			},
			"/password/change/initial": {
				newPassword: String
			},
			"/cors/change": {
				domains: [String]
			},
			"/directStorage/change": {
				enable: Boolean
			},
			"/file/upload/request": {
				count: Number
			}
		}));

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
				if (req.body.newPassword.length > 128) {
					res.status(400).send("PasswordTooLong");
					return;
				}

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
					if (config.main.log.security) {
						console.log("Login failed due to incorrect password or initial code.");
					}
					return;
				}
	
				createAndSendSession(res);
			});
			app.get("/login/status/check", (req, res) => {
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

		app.post("/cors/change", (req, res) => {
			config.main.clientDomains = req.body.domains;
			filesUpdated.config = true;
			corsAndAuth.update.clientDomains();

			res.send();
		});
		app.get("/cors/status/clientDomainsConfigured", (req, res) => {
			res.send((config.main.clientDomains.length != 0).toString());
		});
		app.post("/directStorage/change", (req, res) => {
			const enable = req.body.enable;
			if (enable && (! storageInfo.directStorage.supported)) {
				res.send(409).send("DirectStorageNotSupported");
				return;
			}

			config.main.directStorage = enable;
			filesUpdated.config = true;

			res.send();
		});
		{
			const isActive = _ => storageInfo.directStorage.enabled && config.main.directStorage;
			app.get("/directStorage/status/supported", (req, res) => {
				res.send(storageInfo.directStorage.supported.toString());
			});
			app.get("/directStorage/status/enabledByModule", (req, res) => {
				res.send(storageInfo.directStorage.enabled.toString());
			});
			app.get("/directStorage/status/enabledByConfig", (req, res) => {
				res.send(tools.stringifyNullableBool(config.main.directStorage));
			});
			app.get("/directStorage/status/active", (req, res) => {
				res.send(isActive().toString());
			});
			app.get("/directStorage/status/all", (req, res) => {
				const { supported, enabled, secured } = storageInfo.directStorage;
				res.json({
					supported,
					enabled,
					enabledByConfig: config.main.directStorage,
					active: isActive()
				});
			});
		}

		app.post("/initialConfig/finish", (req, res) => {
			const passwordSet = state.persistent.auth.passwordSet;
			const corsConfigured = config.main.clientDomains.length != 0;
			const directStorageConfigured = config.main.directStorage != null;

			if (! (passwordSet && corsConfigured && directStorageConfigured)) {
				res.status(409).send("SomeNotConfigured");
			}

			state.persistent.initialConfigDone = true;
			filesUpdated.state = true;
			res.send();
		});
		app.get("/initialConfig/status/finished", (req, res) => {
			res.send(state.persistent.initialConfigDone.toString());
		});



		{
			const DENY = tools.indexArray(["state.json"]);
			const IN_MEMORY = (_ => {
				const index = Object.create(null, {});
				for (let [name, extension, value] of MAIN_FILES) {
					let fileName = name + "." + extension;
					index[fileName] = value;
				}
				return index;
			})();
			app.use("/file/get/", async (req, res, next) => {
				if (req.method != "GET") return next();

				const path = req.path.slice(1);
				if (DENY[path]) {
					res.status(403).send("ServerOnly");
					return;
				}

				{
					const mainFileValue = IN_MEMORY[path];
					if (mainFileValue) {
						res.setHeader("Content-Type", mime.contentType(path));
						res.send(mainFileValue());
						return;
					}
				}

				let data;
				try {
					data = await storage.readFile(path);
				}
				catch {
					res.status(404).send("NotFound");
					return;
				}

				let mimeType;
				if (path.startsWith("track/")) {
					const trackID = path.slice(6); // 6 is the length of the prefix
					const info = musicIndex.tracks[trackID];
					if (info) {
						mimeType = info.mime;
					}
				}

				if (mimeType == null) {
					mimeType = mime.contentType(path) || "text/plain; charset=utf-8"
				}

				res.setHeader("Content-Type", mimeType);
				res.send(data);
			});
		}
		app.post("/file/upload/request", (req, res) => {
			if (state.persistent.upload != null) {
				res.status(503).send("AlreadyUploading");
				return;
			}

			const session = randomUUID();
			state.persistent.upload = {
				token: session,
				expected: req.body.count,
				uploaded: 0,
				lastRequest: Date.now(),
				fileStatuses: new Array(req.body.count).fill("pending")
			};
			filesUpdated.state = true;

			res.json({
				uploadSession: session
			});
		});
		{
			const handleFail = (req, resetStatus) => { // Only handles errors that happen after the form is passed, so there's some state to reset
				if (resetStatus) {
					const fileID = parseInt(req.params.fileID);
					state.persistent.upload.finishedFiles[fileID] = "pending";
				}
			};

			app.post("/file/upload/id/:fileID", (req, res, next) => {
				// Before decoding the form data and filling up the RAM, first we'll check that the upload session is valid
				if (state.persistent.upload == null) {
					res.status(403).send("NoActiveSession").end();
					return;
				}

				let session = tools.parseHeaderPairs(req.headers.authorization, res);
				if (session == null) {
					res.end();
					return;
				}
				session = session.uploadid;
				if (session == null) {
					res.status(403).send("NoUploadID").end();
					return;
				}

				if (state.persistent.upload.token != session) {
					res.status(403).send("InvalidUploadSession").end();
					return;
				}
	
				state.persistent.upload.lastRequest = Date.now();
				filesUpdated.state = true;
				next();
			}, fileUpload({
				limits: {
					fileSize: 50 * MB_TO_BYTES,
					files: 1,
					parts: 1,
					fields: 0
				},
				abortOnLimit: true,
				responseOnLimit: "UploadTooBig",
				limitHandler: (req, res, next) => {
					handleFail(req, false);
					next();
				},
				uploadTimeout: 5000
			}), async (req, res) => {
				state.persistent.upload.lastRequest = Date.now();
				filesUpdated.state = true;

				if (req.files == null || req.files.upload == null) {
					res.status(400).send("MissingUpload");
					handleFail(req, false);
					return;
				}
				
				const fileID = parseInt(req.params.fileID);
				const status = state.persistent.upload.fileStatuses[fileID];
				if (status == "processing" || status == "done") {
					res.status(409).send("AlreadyUploadedFile");
					handleFail(req, false);
					return;
				}
				state.persistent.upload.fileStatuses[fileID] = "processing";

				const upload = req.files.upload;
				let metadata;
				try {
					metadata = await parseBuffer(upload.data, upload.mimetype);
				}
				catch {
					res.status(400).send("UnableToParse");
					handleFail(req, true);
					return;
				}

				const common = metadata.common;
				let imageID = -1;
				{
					const image = selectCover(common.picture);
					if (image != null) {
						console.log("TODO: check hash and create file and update index if different. Then set imageID");
					}
				}

				let artistID;
				{
					const artistName = common.artist;
					let lower = artistName == null? null : artistName.toLowerCase();
					artistID = lower == null?
						-1
						: musicIndex.artists.findIndex(info => info && info.name.toLowerCase() == lower)
					;

					if (artistID == -1) {
						artistID = musicIndex.artists.length;
						musicIndex.artists.push({
							name: artistName,
							image: -1 // TODO
						});
					}
				}
				let albumID;
				{
					const albumName = common.album;
					let lower = albumName == null? null : albumName.toLowerCase();
					albumID =  lower == null?
						-1
						: musicIndex.albums.findIndex(info => info && info.artist == artistID && info.name.toLowerCase() == lower)
					;

					if (albumID == -1) {
						albumID = musicIndex.albums.length;
						musicIndex.albums.push({
							name: albumName,
							image: -1, // TODO
							artist: artistID
						});
					}
				}

				const trackID = musicIndex.tracks.length;
				musicIndex.tracks.push({
					name: common.title,
					fileName: upload.name,
					artist: artistID,
					album: albumID,
					duration: metadata.format.duration,
					lossless: metadata.format.lossless,
					image: imageID,
					genres: common.genre,
					year: common.year,
					track: common.track, // { no: _, of: _ }

					metaManuallyChanged: false,
					hash: upload.md5,
					mime: upload.mimetype
				});

				filesUpdated.musicIndex = true;
				state.persistent.upload.lastRequest = Date.now();

				await storage.writeFile("track/" + trackID.toString(36), upload.data);

				state.persistent.upload.fileStatuses[fileID] = "done";
				res.send();
			});
		}
		app.get("/file/status/anyUploading", (req, res) => {
			res.send((state.persistent.upload != null).toString());
		});
	
		app.use((req, res, next) => { // Sends a 200 code for preflights with no endpoints to reduce confusion as that request should be fine (it passed CORS checks earlier)
			if (req.method == "OPTIONS") res.send();
			else next();
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

			await Promise.all([
				load.config(),
				load.state(),
				load.musicIndex()
			]);
		}

		tick();
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
		storageInfo = {
			directStorage: {
				supported: false,
				enabled: false
			}
		}
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
			for (let [name, extension, _, setValue] of MAIN_FILES) {
				const fileName = name + "." + extension;
				tasks.push((async _ => {
					setValue(await setFileToDefault(fileName, extension == "json"));
				})());
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
		},
		state: async _ => {
			if (state.persistent == null) {
				state.persistent = await loadJSON("state.json");	
			}

			{
				const auth = state.persistent.auth;
				auth.sessions = new Map(Object.entries(auth.sessions)); // Convert to map
			}
		},
		musicIndex: async _ => {
			if (musicIndex == null) {
				musicIndex = await loadJSON("musicIndex.json");
			}
			if (musicIndexVersion == null) {
				musicIndexVersion = await storage.readFile("musicIndexVersion.txt");
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
	for (let [name, extension, value] of MAIN_FILES) {
		const fileName = name + "." + extension;
		if (filesUpdated[name]) {
			value = value();
			value = JSON.stringify(value, (key, subValue) => {
				if (subValue instanceof Map) {
					return Object.fromEntries(subValue);
				}
				return subValue;
			});

			tasks.push((async _ => {
				await storage.writeFile(fileName, value);
				if (config.main.log.debug) {
					console.log(`Committed ${fileName}.json`);
				}
			})());
			filesUpdated[name] = false;
		}
	}
	await Promise.all(tasks);
};
const shutdown = async _ => {
	const numberToCommit = MAIN_FILES.filter(([ name ]) => filesUpdated[name]).length;
	if (numberToCommit == 0) {
		console.log("No files to commit.");	
	}
	else if (numberToCommit == 1) {
		console.log("Committing 1 file...\n");
	}
	else {
		console.log(`Committing ${numberToCommit} files...\n`);	
	}
	await commit();

	if (storage.shutdown) {
		console.log(
			(numberToCommit == 0? "" : "\n")
			+ "Shutting down storage module..."
		);
		const output = storage.shutdown();
		if (output instanceof Promise) await output;
	}
};

const tick = _ => {
	const now = Date.now();
	{
		const authState = state.persistent.auth;
		const authTimings = config.main.timings.auth;
		for (let [id, session] of authState.sessions) {
			const validFor = session.isInitial? authTimings.validFor.initial : authTimings.validFor.normal;
			if (now - session.lastRenewTime > validFor) {
				authState.sessions.delete(id);
				filesUpdated.state = true;
			}
		}
	}
	{
		const uploadState = state.persistent.upload;
		if (uploadState != null) {
			if (now - uploadState.lastRequest > config.main.timings.upload.timeout) {
				console.log("TODO: handle timed out upload depending on what's uploaded");
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