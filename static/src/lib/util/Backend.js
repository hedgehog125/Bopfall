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

		throw new BackendError(error, true);
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
	Network: "Network error",
	CantConnect: "Unable to connect to the sever (CORS?)",
	NotBopfall: "Not a bopfall server",
	StartFailed: "Server failed to start",
	IncorrectPassword: "Incorrect password",
	IncorrectSetup: "Wrong setup code",
	NoServerURL: INTERNAL_ERROR,
	BoolIsNull: IGNORE_ERROR
};



export const tasks = {
	init: null,
	check: null
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
		catch (error) {
			console.log(error)
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

		console.log("B")
		progress.check++;
		commandDone();
	})();
	tasks.check = promise;
	return promise;
};

let db;
export const init = (sessionNeeded = false, specialPage) => {
	const promise = (async _ => {
		const isLoginPage = specialPage == "login";
		const isInitialSetup = specialPage == "initialSetup";

		db = await openDB("bopfall", 1, {
			upgrade: async (db, oldVersion, newVersion, transaction) => {
				db.createObjectStore("files");
				db.createObjectStore("metadata");
				db.createObjectStore("misc");
	
				await tools.db.writeParrelel(db, {
					misc: {
						serverURL: null,
						session: null,
	
						metaVersionStored: -1,
						versionStored: -1,
						wasUpgradingTo: -1, // Set during a sync so if the tab's closed, the right files can be discarded and syncing can continue/restart. Set to -1 when all done
						knownVersion: -1
					}
				}, false, transaction);
			}
		});
		const read = await tools.db.readParrelel(db, {
			misc: [
				"serverURL",
				"session",
				"metaVersionStored"
			]
		});
		serverURL = read.serverURL;
		session = read.session;
	
		// Because it hasn't initialised yet, the proper functions can't be used
		const isConfigDone = async _ => await sendRequest.getBool("/initialConfig/status/finished");
		const isLoggedIn = async _ => {
			const res = await sendRequest.getText("/login/status/check", true);

			if (res == "LoggedIn") return true;
			else if (res == "InvalidSessionID" || res == "NoSessionID") return false;
			else throw new BackendError(res);
		};

		const isUsable = sessionNeeded?
			(read.session != null && await isLoggedIn())
			: (read.metaVersionStored != -1 || (read.session != null && ((! isLoginPage) || await isLoggedIn()))) // If this is the login page, make sure the session is valid
		;
		
		if (! shouldStopNextDefault) {
			const serverNeeded = read.metaVersionStored == -1;
			
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
	await initIfNeeded();

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
	}
};
export const request = {
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
	initialConfig: {
		status: {
			finished: async _ => {
				await initIfNeeded();
	
				const result = await sendRequest.getBool("/initialConfig/status/finished");
				commandDone();
				return result;
			}
		}
	},
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
	}
};