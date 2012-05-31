(function() {

var doneCount = 0;
var master = new doh.Deferred();
function done() {
	doneCount += 1;
	//alert("done");
	if (doneCount == 2) {
	//alert("master callback");
	master.callback(true);
	}
}

	// save the currentScriptDir outside of the register call, since by the time
	// the test function is called, currentScriptDir will be different or null
var currentScriptDir = fw.currentScriptDir + "/";

doh.register(
	"multiversion",
	[
	{
		name: "multiversion",
		timeout: 5000,
		runTest: function() 
		{
			var callbacks = [];

				// create a fake setTimeout
			function setTimeout(
				inCallback)
			{
				callbacks.push(inCallback);
			}

			require(
				{
				context: "version1",
				baseUrl: "version1/",
				contextPath: currentScriptDir
				},
				["require", "alpha", "beta", "version1/gamma.js"],
				function(require, alpha, beta) {
				//Notice no module arg name for gamma in the function call.
				//gamma in the log call below will be a global created by gamma.js.
				doh.is("green", gamma.color);
				doh.is(1, alpha.version);
				doh.is(1, beta.version);

					// this setTimeout won't work because require points to the
					// one passed in above as a parameter, not the dispatcher.
					// but the timeout callback will run after this require call
					// completes, which puts the old values for require and 
					// define back in the global scope.  so calling define will
					// call the wrong function.
				setTimeout(function(){
					require(
					["omega"],
					function(omega) {
						doh.is(1, omega.version);
						doh.is("1", alpha.version);
						done();
					}
					);
				}, 100);
				}
			);

// this doesn't work because even though the function returned by require.config()
// is a valid require function, by the time it's called, the globals have been
// reset.  so define will point at the dispatcher, which won't be able to find
// the correct context, since the fw.currentScriptDir will be a different path.
//		require.config(
//			{
//			context: "version2",
//			baseUrl: "version2/",
//			contextPath: currentScriptDir,
//			requirePath: currentScriptDir + "../../lib/"
//			})(
//			["require", "alpha", "beta", "version2/epsilon.js"],
//			function(require, alpha, beta) {
//			//Notice no module arg name for epsilon in the function call.
//			//epsilon in the log call below will be a global created by epsilon.js.
//			doh.is("red", epsilon.color);
//			doh.is(2, alpha.version);
//			doh.is(2, beta.version);
//
//			setTimeout(function(){
//				require(
//				["omega"],
//				function(omega) {
//					doh.is(2, omega.version);
//					doh.is("2", alpha.version);
//					done();
//				}
//				);
//			}, 100);
//			});

			// this is an attempt to fake calling setTimeout callbacks after
			// the require calls complete
//		for (var i = 0; i < callbacks.length; i++) {
//			callbacks[i]();
//		}

// don't return the master Deferred, since we're not done yet
//		return master;
		}
	}
	]
);
doh.run();

})();
