/*
TODO


*/

const path = require("sandboxed-path");
const moreFS = require("fs");
const fs = moreFS.promises;

const ipPackage = require("ip");
const IP = ipPackage.address();

const express = require("express");
const app = express();

const state = {};
let config; // It'll be loaded from the disk
const PORT = process.env.PORT?? 8001; // Loaded as part of config or from the environment variable

const loadConfig = async _ => {
	config = JSON.parse(await fs.readFile(path.accessLocal("config.json")));
};

const startServer = _ => {
	app.get("/info", (req, res) => {
		res.json({
			type: "Bopfall"
		});
	});

	app.listen(PORT, _ => {
		console.log(
			`Running on port ${PORT} using IP ${IP}.
	
For access on the same machine: http://localhost:${PORT}/
And for other devices on your LAN: http://${IP}:${PORT}/
`
		);
	});
};

const start = async _ => {
	await loadConfig();

	startServer();
};
start();