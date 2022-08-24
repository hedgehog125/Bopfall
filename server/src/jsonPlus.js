import { indexArray } from "./tools.js";
import express from "express";

const middleware = (routes = []) => {
	const indexedRoutes = indexArray(routes);

	return (req, res, next) => {
		if ((! indexedRoutes[req.url]) || req.method == "OPTIONS") {
			next();
			return;
		}

		if (req.headers["content-type"] != "application/json") {
			res.status(400).send("InvalidContentType");
			return;
		}
		next();
	};
};
export default middleware;