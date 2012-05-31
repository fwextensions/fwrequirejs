// ===========================================================================
(function() {

var currentScriptDir = fw.currentScriptDir + "/",
	testName = "Multimultiversion";

doh.register(
	"fwrequire",
	doh.fw.createRequireFixture(
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

//			fw.runScript(currentScriptDir + "Version 1.0.8/Test.jsf");
//
//			fw.runScript(currentScriptDir + "Version 2.0.0/Test.jsf");
		}
	)
);

//doh.fw.registerRequireFixture(
//		// only copy require and fwrequire to the version 2.0.0 folder, since
//		// we want to leave the old version in the 1.0.8 folder
//	"Version 2.0.0/lib",
//	function(t) {
//		fw.runScript(currentScriptDir + "Version 1.0.8/Test.jsf");
//		t.t(function() { return require.getContextPaths().length == 1 });
//		
//		fw.runScript(currentScriptDir + "Version 2.0.0/Test.jsf");
//		t.t(function() { return require.getContextPaths().length == 2 });
//	}
//);

})();
