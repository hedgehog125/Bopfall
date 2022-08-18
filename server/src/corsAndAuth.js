import { indexArray } from "./tools.js";

const middleware = (config, fullStart, state) => {
	const wildcardCorsRoutes = indexArray(config.wildcardCorsRoutes);
	const initialConfigRoutes = indexArray(config.initialConfigRoutes);
	const noAuthRoutes = indexArray(config.noAuthRoutes);
	let clientDomains, clientDomainsConfigured;

	const cors = async (req, res) => {
		const origin = req.headers.origin;
		if (! origin) return true;
	
		if (wildcardCorsRoutes[req.url]) {
			res.setHeader("Access-Control-Allow-Origin", "*");
			res.setHeader("Access-Control-Allow-Headers", "*");
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
		res.setHeader("Access-Control-Allow-Headers", "Content-Type, Cookie, Set-Cookie");
		res.setHeader("Access-Control-Allow-Credentials", true);
	};
	const authenticate = req => {
		const session = req.cookies.session;
		if (session == null || session == "") return false; // Mostly just to prevent access in the case null or undefined end up being a key in the sessions map

		const sessions = state.persistent.auth.sessions;
		if (sessions.has(session)) {
			sessions.get(session).lastRenewTime = Date.now();
			return true;
		}
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

		if (! noAuthRoutes[req.url]) {
			await fullStart;
			if (! authenticate(req)) {
				res.status(401).send("InvalidSession");
				return;
			}
		}
		next();
	};
};
export default middleware;