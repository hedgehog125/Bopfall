import esbuild from "esbuild";

esbuild.build({
	entryPoints: ["index.js"],
	outfile: "../serverBuild/index.js",
	platform: "node",
	target: "node16.14",
	format: "esm",

	external: ["aws-sdk", "nock", "bcrypt", "@mapbox/node-pre-gyp"],
	bundle: true,
	minify: true,

	define: {
		"process.env.NODE_ENV": '"production"'
	}
});