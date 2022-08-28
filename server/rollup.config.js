import commonjs from "@rollup/plugin-commonjs";
import jsonBundle from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { terser } from "rollup-plugin-terser";

const BUILT_IN = [	"assert",
	"async_hooks",
	"buffer",
	"child_process",
	"cluster",
	"console",
	"constants",
	"crypto",
	"dgram",
	"diagnostics_channel",
	"dns",
	"domain",
	"events",
	"fs",
	"http",
	"http2",
	"https",
	"inspector",
	"module",
	"net",
	"os",
	"path",
	"perf_hooks",
	"process",
	"punycode",
	"querystring",
	"readline",
	"repl",
	"stream",
	"string_decoder",
	"timers",
	"tls",
	"trace_events",
	"tty",
	"url",
	"util",
	"v8",
	"vm",
	"wasi",
	"worker_threads",
	"zlib",

	"node:buffer",
	"node:stream"
];

export default {
	input: "index.js",
	external: BUILT_IN,
	plugins: [
		nodeResolve({
			preferBuiltins: false
		}),
		commonjs(),
		jsonBundle({
			compact: true
		}),
		terser({
			ecma: 2021,
			mangle: { toplevel: true },
			compress: {
				module: true,
				toplevel: true,
				unsafe_arrows: true
			},
			output: { quote_style: 1 }
		})
	],
	output: {
		file: "bundle.js",
		format: "es"
	}
}