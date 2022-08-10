module.exports.middleware = (config, fullStart, state) => {
	const indexArray = arr => {
		let indexed = {};
		for (let item of arr) {
			indexed[item] = true;
		}
		return indexed;
	};

	const wildcardCorsRoutes = indexArray(config.wildcardCorsRoutes);
	const initialConfigRoutes = indexArray(config.initialConfigRoutes);
	const noAuthRoutes = indexArray(config.noAuthRoutes);
	let clientDomains, clientDomainsConfigured;

	const cors = async (req, res) => {
		const origin = req.headers.origin;
		if (! origin) return true;

		if (wildcardCorsRoutes[req.url]) {
			res.setHeader("Access-Control-Allow-Origin", "*");
		}
		else {
			await fullStart;

			if (! clientDomainsConfigured) { // Some routes will have to trust every domain
				if (initialConfigRoutes[req.url]) {
					res.setHeader("Access-Control-Allow-Origin", origin);
					return true;
				}
				return false;
			}

			if (clientDomains[origin]) {
				res.setHeader("Access-Control-Allow-Origin", origin);
			}
			else return false;
		}
		return true;
	};
	const authenticate = async req => {
		console.log("TODO")
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
			if (! (await authenticate(req))) {
				res.status(401).send();
				return;
			}
		}
		next();
	};
};