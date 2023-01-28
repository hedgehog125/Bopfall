import { openDB } from "idb"; // I'm using idb here instead of idb-keyval because I need custom stores
import { PROXY_PREFIX } from "./src/lib/util/SharedConstants.js";

let lastError = ""; // An empty string is used instead of null so it's easier to send to the main thread
export async function handle(path, isPage, { request }) {
	if (path.startsWith(PROXY_PREFIX)) {
		const proxyPath = path.slice(PROXY_PREFIX.length).split("/");

		if (request.method == "GET") {
			if (proxyPath[0] == "track") {
				const trackID = proxyPath[1];
	
				// TODO: why no error?
				const db = await openDB("bopfall", 2, {
					upgrade(db, oldVersion, newVersion, transaction) {
						transaction.abort(); // The main thread can handle the upgrade, it's not worth bundling the code in here
					}
				});
				const [serverURL, session] = await Promise.all([
					db.get("misc", "serverURL"),
					db.get("misc", "session")
				]);
	
				let res;
				try {
					res = await fetch(
						new Request(serverURL + `file/get/${trackID}`, request)
					);
				}
				catch {
					return Response.error();
				}
	
				return res;
			}
			else if (proxyPath[0] == "lastError") {
				return new Response(lastError);
			}
		}

		lastError = "";
	}
};