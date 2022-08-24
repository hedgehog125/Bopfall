import * as tools from "$util/Tools.js";
const makeExposedPromise = tools.timing.makeExposedPromise;
import { openDB } from "idb";

const displayError = code => {
	status.check = "error";
	toast(ERRORS[code], undefined, true);
	return code + 1; // 0 means no error
};
const initIfNeeded = async (dataNeeded = true) => {
	if (tasks.init == null) {
		const hasData = await init();
		if (dataNeeded && (! hasData)) throw new Error("LoginNeeded");
	}
};
const standardFetch = async (path, args) => {
	if (serverURL == null) throw new BackendError("NoServerURL");

	let res;
	try {
		res = await fetch(serverURL + path, args);
	}
	catch {
		throw new BackendError("NetworkError");
	}
	if (! res.ok) throw new BackendError(await res.text());
	return res;
};

const ERRORS = [
	"Unknown error",
	"Network error",
	"Unable to connect to the sever (CORS?)",
	"Not a bopfall server",
	"Server failed to start",
	"Incorrect password",
	"Wrong setup code"
];




export class BackendError extends Error {};

export const tasks = {
	init: null,
	check: null
};
export const status = {
	check: "loading"
};
export const progress = {
	check: -1
};

let toast;
export const setToast = value => {
	toast = value;
};

let serverURL;
let session;
export const changeServerURL = async value => {
	if (serverURL == value) return 0;
	serverURL = value;

	tasks.check = makeExposedPromise();
	status.check = "checking";
	progress.check = 0;

	let res;
	try {
		res = await fetch(serverURL + "/info");
	}
	catch (error) {
		return displayError(2);
	}

	if (tools.response.mime(res) != "application/json") {
		return displayError(3);
	}
	try {
		res = await res.json();
	}
	catch {
		return displayError(3);
	}
	if (res.type != "Bopfall") {
		return displayError(3);
	}
	if (res.status.check == "error") {
		return displayError(4);
	}

	progress.check++;

	try {
		res = await fetch(serverURL + "/waitUntilStart");
	}
	catch (error) {
		return displayError(2);
	}
	if (res.ok) res.text(); // It makes it look like an error in the console if we don't call one of the methods
	else {
		return displayError(4);
	}

	status.check = "ok";
	progress.check++;
	tasks.check.resolve();
	return 0;
};

let db;
export const init = async (sessionNeeded = false, isLoginPage = false, isInitialSetup = false) => {
	tasks.init = makeExposedPromise();

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

	tasks.init.resolve();
	return isUsable;
};
export const login = async (password, isSetupCode = false) => {
	await initIfNeeded();

	try {
		session = (await sendRequest.postJSON("/login", {
			password
		})).session;
	}
	catch (error) {
		if (error.message == "NetworkError") {
			displayError(1);
		}
		else if (error.message == "IncorrectPassword") {
			if (isSetupCode) {
				displayError(6);
			}
			else {
				displayError(5);
			}
		}
		else {
			displayError(0);
		}
		throw new BackendError(error.message);
	}

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
	
				return await sendRequest.getBool("/password/status/set");
			}
		}
	},
	initialConfig: {
		status: {
			finished: async _ => {
				await initIfNeeded(false);
	
				return await sendRequest.getBool("/initialConfig/status/finished");
			}
		}
	}
};