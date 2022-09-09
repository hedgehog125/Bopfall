import * as tools from "$util/Tools.js";
import { openDB } from "idb";

export class BackendError extends Error {
	constructor (name, isRethrow = false) {
		super(name);
		if (! shouldStopNextDefault) {
			if (! isRethrow) {
				let errorText = ERRORS[name];
				if (errorText == null) errorText = ERRORS.Unknown;
	
				if (errorText == "LoginNeeded") {
					tools.navigateTo.temporaryPage("login");
					return;
				}
				if (errorText != IGNORE_ERROR) {
					toast(errorText, undefined, true);
				}
			}
			shouldStopNextDefault = false;	
		}
	}
};
const initIfNeeded = async (dataNeeded = true) => {
	const hasData = await (tasks.init == null? init() : tasks.init);
	if (dataNeeded && (! hasData)) throw new BackendError("LoginNeeded");
};
const standardFetch = async (path, args, ignoreNonOk = false) => {
	if (serverURL == null) throw new BackendError("NoServerURL");

	let res;
	try {
		res = await fetch(serverURL + path, args);
	}
	catch {
		throw new BackendError("Network");
	}
	if (! (res.ok || ignoreNonOk)) {
		const error = await res.text();
		if (error == "InvalidSessionID") throw new BackendError("LoginNeeded");

		throw new BackendError(error);
	}
	return res;
};
const commandDone = _ => {
	shouldStopNextDefault = false;
};

const INTERNAL_ERROR = "A unhandled error occurred";
const IGNORE_ERROR = "";
const ERRORS = {
	Unknown: "Unknown error",
	Network: "Network error (CORS?)",
	CantConnect: "Unable to connect to the sever (CORS?)",
	NotBopfall: "Not a bopfall server",
	StartFailed: "Server failed to start",
	IncorrectPassword: "Incorrect password",
	IncorrectSetup: "Wrong setup code",
	NoServerURL: INTERNAL_ERROR,
	BoolIsNull: IGNORE_ERROR,
	LoginNeeded: IGNORE_ERROR,
	DirectStorageNotSupported: "Direct storage access isn't supported by this server",
	SomeNotConfigured: "Some of the initial config isn't done. Somehow...?",
	NotFound: INTERNAL_ERROR
};



export const tasks = {
	init: null,
	check: null,
	sync: null
};
export const progress = {
	check: -1
};

let toast;
export const setToast = value => {
	toast = value;
};

let shouldStopNextDefault = false;
export const stopNextDefault = _ => {
	shouldStopNextDefault = true;
};

let serverURL;
export const getServerURL = _ => serverURL;
let newServerURL; // Is a global so it can also be checked against for double sets
let session;
export const changeServerURL = value => {
	if (value.endsWith("/")) value = value.slice(0, -1);
	if (value == serverURL || value == newServerURL) return tasks.check;
	newServerURL = value;

	const promise = (async _ => {
		progress.check = 0;

		let res;
		try {
			res = await fetch(newServerURL + "/info");
		}
		catch {
			throw new BackendError("CantConnect");
		}

		if (tools.response.mime(res) != "application/json") {
			throw new BackendError("NotBopfall");
		}
		try {
			res = await res.json();
		}
		catch {
			throw new BackendError("NotBopfall");
		}
		if (res.type != "Bopfall") {
			throw new BackendError("NotBopfall");
		}
		if (res.status == "error") {
			throw new BackendError("StartFailed");
		}

		progress.check++;

		try {
			res = await fetch(newServerURL + "/waitUntilStart");
		}
		catch {
			throw new BackendError("Network");
		}
		if (res.ok) res.text(); // It makes it look like an error in the console if we don't call one of the methods
		else {
			throw new BackendError("StartFailed");
		}

		serverURL = newServerURL;

		progress.check++;
		commandDone();
	})();
	tasks.check = promise;
	return promise;
};

let db, misc, cached, musicIndex;
export const init = (sessionNeeded = false, specialPage) => {
	const promise = (async _ => {
		const isLoginPage = specialPage == "login";
		const isInitialSetup = specialPage == "initialSetup";

		db = await openDB("bopfall", 1, {
			upgrade: async (db, oldVersion, newVersion, transaction) => {
				db.createObjectStore("files");
				db.createObjectStore("metadata");
				db.createObjectStore("misc");
				db.createObjectStore("cache");
	
				await tools.db.writeParrelel(db, {
					misc: {
						serverURL: null,
						session: null,
	
						metaVersionStored: -1,
						oldMetaVersionStored: -1,
						versionStored: -1,
						wasUpgrading: false, // Set during a sync so if the tab's closed Bopfall knows to delete all the files and resync
						knownVersion: -1
					},
					cache: {
						configDone: null
					},
					metadata: {
						current: null,
						old: null
					}
				}, false, transaction);
			}
		});
		misc = await tools.db.readParrelel(db, {
			misc: [
				"serverURL",
				"session",

				"metaVersionStored",
				"oldMetaVersionStored",
				"versionStored",
				"wasUpgrading",
				"knownVersion"
			]
		});
		serverURL = misc.serverURL;
		session = misc.session;
		cached = await tools.db.readParrelel(db, {
			cache: [
				"configDone"
			]
		});
		musicIndex = await db.get("metadata", "current");

	
		// Because it hasn't initialised yet, the proper functions can't be used
		const isConfigDone = isConfigDoneInternal;
		const isLoggedIn = async _ => {
			const res = await sendRequest.getText("/login/status/check", true);

			if (res == "LoggedIn") return true;
			else if (res == "InvalidSessionID" || res == "NoSessionID") return false;
			else throw new BackendError(res);
		};

		const isUsable = sessionNeeded?
			(misc.session != null && await isLoggedIn())
			: (misc.metaVersionStored != -1 || (misc.session != null && ((! isLoginPage) || await isLoggedIn()))) // If this is the login page, make sure the session is valid
		;
		
		if (! shouldStopNextDefault) {
			const serverNeeded = misc.metaVersionStored == -1;
			
			let changingPage = false;
			if (isUsable) {
				if (isLoginPage) {
					if (await isConfigDone()) {
						tools.navigateTo.originalPage();
					}
					else {
						if (! isInitialSetup) {
							tools.navigateTo.anotherTemporary("initial-setup");
						}
					}
					changingPage = true;
				}
			}
			else {
				if (! isLoginPage) {
					tools.navigateTo.temporaryPage("login");
					changingPage = true;
				}
			}
		
			if (isUsable) {
				if (! changingPage) {
					if (serverNeeded) {
						if (! (await isConfigDone())) {
							if (! isInitialSetup) {
								tools.navigateTo.anotherTemporary("initial-setup");
							}
						}
					}
				}
			}
		
		}

		commandDone();
		return isUsable;
	})();
	tasks.init = promise;
	return promise;

};
export const login = async (password, isSetupCode) => {
	await initIfNeeded(false);

	if (isSetupCode == null) isSetupCode = await request.password.status.set();

	session = (await sendRequest.postJSON("/login", {
		password
	})).session;

	await tools.db.writeParrelel(db, {
		misc: {
			serverURL,
			session
		}
	}, true);

	// It's usable by this point as there's a new session but the cached result of init was probably false (not usable). Instead of doing another initialisation which isn't necessary as things are already loaded, we'll just modify the cached output
	tasks.init = Promise.resolve(true);

	if (! shouldStopNextDefault) {
		if (await request.initialConfig.status.finished()) {
			tools.navigateTo.originalPage();
		}
		else {
			tools.navigateTo.anotherTemporary("initial-setup");
		}
	}

	commandDone();
};
export const isSyncNeeded = async _ => {
	await initIfNeeded();

	return misc.versionStored == -1;
};
export const syncIfNeeded = async _ => {
	await initIfNeeded();

	if (await isSyncNeeded()) await sync()[0];
};
export const sync = _ => {
	const anythingToSync = (async _ => {
		await initIfNeeded();

		// The latest version is fetched again even if a new version is known about since there might be another new version and it won't take long
		const latestVersion = parseInt(await request.file.getText("musicIndexVersion.txt"), 36);
		if (misc.versionStored == latestVersion) return false; // Note that this is comparing to the overall version, not just the meta version

		if (misc.latestVersion != latestVersion) {
			misc.knownVersion = latestVersion;
			db.put("misc", latestVersion, "knownVersion");
		}

		return true;
	})();
	const metaSync = (async _ => {
		if (! (await anythingToSync)) return false;
		if (misc.metaVersionStored == misc.knownVersion) return false; // No newer version to download

		const metadata = await request.file.getJSON("musicIndex.json");
		musicIndex = metadata;
		await db.put("metadata", musicIndex, "current");

		db.put("misc", misc.knownVersion, "metaVersionStored");
		misc.metaVersionStored = misc.knownVersion;

		return true;
	})();
	const syncFiles = (async _ => {
		if (! (await anythingToSync)) return false;
		await metaSync;

		// TODO: download the files depending on the mode
	})();

	return [
		syncFiles, // The last task, so it's equivalent to awaiting all of them

		anythingToSync,
		metaSync,
		syncFiles
	];
};


const updateCache = (id, value) => { // Not async since this can happen in the background
	cached[id] = value;
	db.put("cache", value, id);
};
const isConfigDoneInternal = async _ => {
	if (cached.configDone != null) {
		commandDone();
		return cached.configDone;
	}

	const result = await sendRequest.getBool("/initialConfig/status/finished");
	if (result) updateCache("configDone", true); // Only cache if it's true since it won't change back
	return result;
};
const sendRequest = {
	getText: async (path, ignoreNonOk) => {
		return await (await standardFetch(path, {
			headers: {
				"Authorization": "sessionid " + session
			}
		}, ignoreNonOk)).text();
	},
	getJSON: async (path, ignoreNonOk) => {
		const res = await standardFetch(path, {
			headers: {
				"Authorization": "sessionid " + session
			}
		}, ignoreNonOk);

		if (res.ok) return await res.json();
		return await res.text();
	},
	getBool: async (path, ignoreNonOk, throwIfNull = false) => {
		const res = await sendRequest.getText(path, ignoreNonOk);
		if (res == "null") {
			if (throwIfNull) throw new BackendError("BoolIsNull");
			return null;
		}
		return res === "true";
	},
	getBlob: async (path, ignoreNonOk) => {
		return await (await standardFetch(path, {
			headers: {
				"Authorization": "sessionid " + session
			}
		}, ignoreNonOk)).blob();
	},

	postJSON: async (path, value, responseIsText = false, ignoreNonOk) => {
		const res = await standardFetch(path, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": "sessionid " + session
			},
			body: JSON.stringify(value)
		}, ignoreNonOk);

		if (res.ok && (! responseIsText)) return await res.json();
		return await res.text();
	},
	postText: async (path, value, ignoreNonOk) => {
		const res = await standardFetch(path, {
			method: "POST",
			headers: {
				"Content-Type": "text/plain",
				"Authorization": "sessionid " + session
			},
			body: value
		}, ignoreNonOk);
		return await res.text();
	}
};
export const request = {
	login: {
		status: {
			check: async _ => {
				await initIfNeeded(false); // It's fine if we're not logged in

				// The server will send a non ok if we're not logged in, so the true prevents the usual handling so it doesn't trigger an error the user sees
				const res = await sendRequest.getText("/login/status/check", true);

				let loggedIn;
				if (res == "LoggedIn") loggedIn = true;
				else if (res == "InvalidSessionID" || res == "NoSessionID") loggedIn = false;
				else throw new BackendError(res);

				commandDone();
				return loggedIn;
			}
		}
	},
	password: {
		status: {
			set: async _ => {
				await initIfNeeded(false);
	
				const result = await sendRequest.getBool("/password/status/set");
				commandDone();
				return result;
			}
		},
		change: {
			normal: async (oldPassword, newPassword) => {
				await initIfNeeded(false);

				session = (await sendRequest.postJSON("/password/change", {
					password: oldPassword,
					newPassword
				})).session;
				await db.put("misc", session, "session");
				commandDone();
			},
			initial: async newPassword => {
				await initIfNeeded();

				session = (await sendRequest.postJSON("/password/change/initial", {
					newPassword
				})).session;
				await db.put("misc", session, "session");
				commandDone();
			}
		}
	},
	cors: {
		status: {
			clientDomainsConfigured: async _ => {
				await initIfNeeded();

				const result = await sendRequest.getBool("/cors/status/clientDomainsConfigured");

				commandDone();
				return result;
			}
		},
		change: async domains => {
			await initIfNeeded();

			const result = await sendRequest.postJSON("/cors/change", {
				domains
			}, true);

			commandDone();
			return result; 
		}
	},
	directStorage: {
		status: {
			all: async _ => {
				await initIfNeeded();

				const result = await sendRequest.getJSON("/directStorage/status/all");

				commandDone();
				return result;
			}
		},
		change: async enable => {
			await initIfNeeded();

			const result = await sendRequest.postJSON("/directStorage/change", {
				enable
			}, true);

			commandDone();
			return result;
		}
	},
	initialConfig: {
		status: {
			finished: async _ => {
				await initIfNeeded();
				
				const result = await isConfigDoneInternal();
				commandDone();
				return result;
			}
		},
		finish: async _ => {
			await initIfNeeded();
	
			await sendRequest.postText("/initialConfig/finish", "");
			commandDone();
		}
	},

	file: {
		getURLPath: path => "/file/get/" + path,
		getText: async path => {
			await initIfNeeded();
	
			const result = await sendRequest.getText(request.file.getURLPath(path));
			commandDone();
			return result;
		},
		getJSON: async path => {
			await initIfNeeded();
	
			const result = await sendRequest.getJSON(request.file.getURLPath(path));
			commandDone();
			return result;
		},
		getBlob: async path => {
			await initIfNeeded();

			const result = await sendRequest.getBlob(request.file.getURLPath(path));
			commandDone();
			return result;
		}
	},

	musicIndex: async _ => {
		await syncIfNeeded();

		return musicIndex;
	}
};