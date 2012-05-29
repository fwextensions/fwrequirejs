// ===========================================================================
try { (function() {

var currentScriptDir = fw.currentScriptDir + "/",
	dojoPath = currentScriptDir + "dojo/";

	// set up the dojo environment before loading it
dojoConfig = {
	baseUrl: dojoPath,
	waitSeconds: 0,
	async: 1,
	has: {
			// tell dojo we're in Fireworks and not a browser so it picks the
			// right test runners
		"host-fireworks":1,
		"host-browser":0,
		"dom":0,
		"dojo-amd-factory-scan":1,
		"dojo-loader":1,
		"dojo-has-api":1,
		"dojo-inject-api":1,
		"dojo-timeout-api":0,
		"dojo-trace-api":1,
		"dojo-log-api":1,
		"dojo-dom-ready-api":0,
		"dojo-publish-privates":0,
		"dojo-config-api":1,
		"dojo-sniff":0,
		"dojo-sync-loader":1,
		"dojo-test-sniff":0,
		"config-tlmSiblingOfDojo":1
	},
	loaderPatch: {
		injectUrl: function injectUrl(url, callback)
		{
			try {
				if (Files.exists(url)) {
					fw.runScript(url);
					callback();
				} else {
					throw "File doesn't exist";
				}
			} catch(e) {
				console.log("failed to load resource (" + url + ")");
				console.log(e);
			}
		},

		getText: function getText(url, sync, onLoad){
			console.log("ERROR: getText() not supported.", url);
		}
	}
};

	// load the dojo loader
fw.runScript(dojoPath + "dojo.js"); 

})(); } catch (exception) {
	if (exception.lineNumber) {
		alert([exception, exception.lineNumber, exception.fileName].join("\n"));
	} else {
		throw exception;
	}
}
