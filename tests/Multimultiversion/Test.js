// ===========================================================================
(function() {

var currentScriptDir = fw.currentScriptDir + "/",
	testName = "Multimultiversion";

doh.register(
	"fwrequire",
	doh.fw.createRequireFixture(
		"Version 2.0.0/lib",
		testName,
		function(t)
		{
			doh.fw.copyRequireFiles("Version 2.0.0/lib");
			
			console.time(testName);
			fw.runScript(currentScriptDir + "Version 1.0.8/Test.jsf");
			t.t(function() { return require.getContextPaths().length == 1 });
			
			fw.runScript(currentScriptDir + "Version 2.0.0/Test.jsf");
			t.t(function() { return require.getContextPaths().length == 2 });
			console.timeEnd(testName);
		}
	)
);

})();
