// ===========================================================================
(function() {

var currentScriptDir = fw.currentScriptDir + "/",
	testName = "contextPath";

doh.register(
	"fwrequire",
	doh.fw.createRequireFixture(
		testName,
		function(t)
		{
			doh.fw.copyRequireFiles("Command/lib");
	
			console.time(testName);
			
				// run a script that points its contextPath to 
				// currentScriptDir/Command
			fw.runScript(currentScriptDir + "Panel/Test.jsf");
			t.t(function() { return require.getContextPaths().length == 1 });
			
				// run the actual currentScriptDir/Command script, which should
				// share the context that was created by the previous script
			fw.runScript(currentScriptDir + "Command/Test.jsf");
			
				// there should still be just one context, shared by the two scripts
			t.t(function() { return require.getContextPaths().length == 1 });
			
			console.timeEnd(testName);
		}
	)
);

})();
