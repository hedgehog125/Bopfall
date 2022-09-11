import { accept as checkMiddleware } from "paperwork";

const middleware = (routeFormats = {}) => {
	let validators = Object.create(null, {});
	for (let route in routeFormats) {
		validators[route] = checkMiddleware(routeFormats[route]);
	}
	
	return (req, res, next) => {
		if ((! validators[req.url]) || req.method == "OPTIONS") {
			next();
			return;
		}

		if (req.headers["content-type"] != "application/json") {
			res.status(400).send("InvalidContentType");
			return;
		}
		validators[req.url](req, res, next);
	};
};
export default middleware;