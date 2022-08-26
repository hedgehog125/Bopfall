import * as tools from "$util/Tools.js";
import { openDB } from "idb";

export class BackendError extends Error {
	constructor (name) {
		super(name);
		if (! shouldPreventErrorToast) {
			toast(ERRORS[name], undefined, true);
			shouldPreventErrorToast = false;	
		}
	}
};
const initIfNeeded = async (dataNeeded = true) => {
	if (tasks.init == null) {
		const hasData = await init();
		if (dataNeeded && (! hasData)) throw new BackendError("LoginNeeded");
	}
};
const standardFetch = async (path, args) => {
	if (serverURL == null) throw new BackendError("NoServerURL");

	let res;
	try {
		res = await fetch(serverURL + path, args);
	}
	catch {
		throw new BackendError("Network");
	}
	if (! res.ok) throw new BackendError(await res.text());
	return res;
};
const commandDone = _ => {
	shouldPreventErrorToast = false;
};

const INTERNAL_ERROR = "A unhandled error occurred";
const ERRORS = {
	Unknown: "Unknown error",
	Network: "Network error",
	CantConnect: "Unable to connect to the sever (CORS?)",
	NotBopfall: "Not a bopfall server",
	StartFailed: "Server failed to start",
	IncorrectPassword: "Incorrect password",
	IncorrectSetup: "Wrong setup code",
	NoServerURL: INTERNAL_ERROR
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

let shouldPreventErrorToast = false;
export const preventNextErrorToast = _ => {
	shouldPreventErrorToast = true;
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
export const init = (sessionNeeded = false, isLoginPage = false, isInitialSetup = false) => {
	const promise = (async _ => {
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
	
		const isUsable = sessionNeeded?
			read.session != null
			: (read.metaVersionStored != -1 || read.session != null)
		;
		const serverNeeded = read.metaVersionStored == -1;
	
		let changingPage = false;
		if (isUsable) {
			if (isLoginPage) {
				if (await request.initialConfig.status.finished()) {
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
					if (! (await request.initialConfig.status.finished())) {
						if (! isInitialSetup) {
							tools.navigateTo.anotherTemporary("initial-setup");
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

	if (await request.initialConfig.status.finished()) {
		tools.navigateTo.originalPage();
	}
	else {
		tools.navigateTo.anotherTemporary("initial-setup");
	}

	commandDone();
};

const sendRequest = {
	getText: async path => {
		return await (await standardFetch(path, {
			headers: {
				"Authorization": "sessionid " + session
			}
		})).text();
	},
	getJSON: async path => {
		return await (await standardFetch(path, {
			headers: {
				"Authorization": "sessionid " + session
			}
		})).json();
	},
	getBool: async (path, throwIfNull = false) => {
		const res = await sendRequest.getText(path);
		if (res == "null") {
			if (throwIfNull) throw new BackendError("BoolIsNull");
			return null;
		}
		return res === "true";
	},

	postJSON: async (path, value) => {
		return await (await standardFetch(path, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": "sessionid " + session
			},
			body: JSON.stringify(value)
		})).json();
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
		}
	},
	initialConfig: {
		status: {
			finished: async _ => {
				await initIfNeeded(false);
	
				const result = await sendRequest.getBool("/initialConfig/status/finished");
				commandDone();
				return result;
			}
		}
	}
};