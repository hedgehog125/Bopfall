import { indexArray } from "./tools.js";

let wildcardCorsRoutes, initialConfigRoutes,
allowedBeforeInitialConfig, noAuthRoutes, mainConfig,
clientDomains, clientDomainsConfigured;

const cors = async (req, res) => {
	const origin = req.headers.origin;
	if (! origin) return true;

	if (wildcardCorsRoutes[req.url]) {
		res.setHeader("Access-Control-Allow-Origin", "*");
		res.setHeader("Access-Control-Allow-Headers", "*");
		res.setHeader("Access-Control-Max-Age", 600);
		return true;
	}
	else {
		await fullStart;

		if (clientDomainsConfigured) {
			if (clientDomains[origin]) {
				sendFullCors(origin, res);
				return true;
			}
		}
		else { // Some routes will have to trust every domain because they are required to configure CORS
			if (initialConfigRoutes[req.url]) {
				sendFullCors(origin, res);
				return true;
			}
		}
	}
	return false;
};
const sendFullCors = (origin, res) => {
	res.setHeader("Access-Control-Allow-Origin", origin);
	res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
	res.setHeader("Access-Control-Allow-Credentials", true);
	if (clientDomainsConfigured) {
		res.setHeader("Access-Control-Max-Age", 600);
	}
};
const authenticate = (req, res) => {
	let session = req.headers.authorization;
	if (session == null || session == "") { // No idea if this is possible to happen or not but just in case there's a weird edge case, reject these session ids
		res.status(401).send("NoSessionID");
		return false;
	}
	session = session.split(" ");
	if (session.length != 2) {
		res.status(400).send("InvalidAuthorizationHeaderFormat");
		return false;
	}
	if (session[0].toLowerCase() != "sessionid") {
		res.send(400).send("InvalidAuthorizationScheme");
		return false;
	}
	session = session[1];

	const sessions = state.persistent.auth.sessions;
	if (sessions.has(session)) {
		sessions.get(session).lastRenewTime = Date.now();
		return true;
	}

	res.status(401).send("InvalidSessionID");
	return false;
};
const middlewareFunction = async (req, res, next) => {
	if (! (await cors(req, res))) { // Don't bother processing the rest if it's an invalid CORS request
		res.status(403).send("CorsError");
		return;
	}
	if (req.method == "OPTIONS") {
		next();
		return;
	}

	if (! allowedBeforeInitialConfig[req.url]) {
		if (! state.persistent.initialConfigDone) {
			res.status(409).send("InitialConfigIncomplete");
			return;
		}
	}

	if (! noAuthRoutes[req.url]) {
		await fullStart;
		if (! authenticate(req, res)) return;
	}
	next();
};
const indexValues = _ => {
	wildcardCorsRoutes = indexArray(config.wildcardCorsRoutes);
	initialConfigRoutes = indexArray(config.initialConfigRoutes);
	allowedBeforeInitialConfig = Object.assign(indexArray(config.allowedBeforeInitialConfig), wildcardCorsRoutes, initialConfigRoutes);
	noAuthRoutes = indexArray(config.noAuthRoutes);

	fullStart.then(_ => {
		mainConfig = config.mainConfig.main;
		clientDomains = indexArray(mainConfig.clientDomains);
		clientDomainsConfigured = mainConfig.clientDomains.length != 0;
	});
};

let config, fullStart, state;
const middleware = (_config, _fullStart, _state) => {
	config = _config;
	fullStart = _fullStart;
	state = _state;

	indexValues();
	return middlewareFunction;
};
middleware.update = {
	clientDomains: _ => {
		fullStart.then(_ => {
			clientDomains = indexArray(mainConfig.clientDomains);
			clientDomainsConfigured = mainConfig.clientDomains.length != 0;
		});
	}
};
export default middleware;