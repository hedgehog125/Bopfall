import adapter from "@sveltejs/adapter-static";

const URL_PREFIX = "Bopfall"; // <-- Set this to the repository name if you're hosting on github pages (unless it's your homepage site), as all the URLs will need to be prefixed with it


const dev = process.env.NODE_ENV != "production";
const baseURL = dev || URL_PREFIX == ""? "" : `/${URL_PREFIX}`;
const buildDir = "build";

/** @type {import("@sveltejs/kit").Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors	
	kit: {
		appDir: "app",
		paths: {
			base: baseURL
		},
		alias: {
			$util: "src/lib/util",
			$img: "src/lib/imgs",
			$sng: "src/lib/snds",
			$vid: "src/lib/vids"
		},

		prerender: {
			default: true
		},
		adapter: adapter({
			pages: buildDir,
			assets: buildDir,
			fallback: null
		})
	}
};

export default config;