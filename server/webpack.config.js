import path from "path";
import nodeExternals from "webpack-node-externals";

export default {
	entry: "./index.js",
	target: "node",
	mode: "production",

	output: {
		filename: "index.js",
		path: path.join(process.cwd(), "build"),

		library: {
			type: "global"
		}
	}
};