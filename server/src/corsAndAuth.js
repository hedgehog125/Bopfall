import { indexArray } from "./tools.js";

const middleware = (config, fullStart, state) => {
	const wildcardCorsRoutes = indexArray(config.wildcardCorsRoutes);
	const initialConfigRoutes = indexArray(config.initialConfigRoutes);
	const allowedBeforeInitialConfig = Object.assign(indexArray(config.allowedBeforeInitialConfig), wildcardCorsRoutes, initialConfigRoutes);
	const noAuthRoutes = indexArray(config.noAuthRoutes);
	let clientDomains, clientDomainsConfigured;

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
		if (session == null || session == "") {
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

	fullStart.then(_ => {
		let mainConfig = config.mainConfig.main;
		clientDomains = indexArray(mainConfig.clientDomains);
		clientDomainsConfigured = mainConfig.clientDomains.length != 0;
	});

	return async (req, res, next) => {
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
};
export default middleware;