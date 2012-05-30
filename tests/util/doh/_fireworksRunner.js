/* ===========================================================================

	_fireworksRunner.js 

	Copyright 2012 John Dunning.  
	fw@johndunning.com
	http://johndunning.com/fireworks

	_fireworksRunner.js is released under the MIT license.  

	This script implements the calls necessary to supporting running tests via 
	the doh framework in Adobe Fireworks.  It requires that 
	dojoConfig.has["host-fireworks"] is set to 1 before dojo is loaded.  
	doh/main.js has been modified to check for that has variable and will load
	this runner file when it's detected.

	We also monkey patch doh to create a fake setTimeout function, which the
	FW environment doesn't support.  It also wraps the assert functions to allow
	passing a function as the condition, which will then be evaluated and its
	body used as the hint if there's an error. 

	To run tests in doh, the Fireworks Console extension must be installed:
	http://johndunning.com/fireworks/about/FWConsole

   ======================================================================== */


/*
	To do:
		- test getting context paths

		- possibly create better test harness that evaluates strings in the context
			of the test function
			if there's an error, it can print what was executing
			or at least pass a message to the assert functions

		- look for foo.test.js files in the top directory and register those, too

		- maybe instead of copying fwrequire over, just use a .js file that reads
			all of fwrequire and evals it
			can't call runScript because then fwrequire would think it's located in
			its source dir
			would be slower than copying the file 

	Done:
		- copy tests from requirejs

		- could put fwdoh in FW runner script
*/

require([
	"doh/runner"
], function(
	doh) 
{
	doh.debug = log;
	doh.error = log;

	log(doh._line);
	log("The Dojo Unit Test Harness, $Rev: 23869 $");
	log("Copyright (c) 2011, The Dojo Foundation, All Rights Reserved");
	log(doh._line);


		// wrap doh.run to create a dummy setTimeout function before the tests
		// run and then delete the global after
	var dohRun = doh.run;
	doh.run = function()
	{
			// annoyingly, doh seems to depend on setTimeout, which doesn't exist.
			// but just immediately calling the callback back seems to work.
		if (typeof setTimeout != "function") {
			setTimeout = function(
				inCallback)
			{
				doh._paused = false;

				return inCallback();
			}
		}
		
			// create a global print function for any CommonJS tests that 
			// expect one
		print = log;

		dohRun.apply(this, arguments);
		
		delete setTimeout;
		delete print;
		
			// when the tests have finished, clean everything up, since each
			// RequireJS test calls doh.run, rather than just registering 
			// themselves, so it'll rerun our tests.  we have to do this after
			// the real doh.run runs, rather than overriding _onEnd, because
			// that is called before _report, and we don't want to zero everything
			// out before reporting the stats. 
		doh._testCount = 0;
		doh._groupCount = 0;
		doh._errorCount = 0;
		doh._failureCount = 0;
		doh._currentGroup = null;
		doh._currentTest = null;
		doh._paused = true;
		doh._groups = {};
		doh._testTypes= {};
	}


		// make calls to pause a noop, since there's no way to pause a test in FW
	doh.pause = function() 
	{
		this._paused = false;
	}
	
	
	function wrapAssert(
		inOriginalFunction)
	{
		return function(
			inCondition, 
			inHint)
		{
			if (typeof inCondition == "function") {
				var conditionSource = inCondition.toString(),
					match = conditionSource.match(/function\s+[^(]*\([^)]*\)\s*\{\s+return\s+([\s\S]*)\}/);

				if (match) {
						// strip the semicolon and any trailing whitespace
					conditionSource = match[1].replace(/;\s*$/, "");
				}

				inHint = (inHint ? inHint + ": " : "") + conditionSource;

				return inOriginalFunction.apply(this, [inCondition(), inHint]);
			} else {
				return inOriginalFunction.apply(this, [inCondition, inHint]);
			}
		}	
	}
	
		// wrap the assert methods so we can pass a function
	doh.t = doh.assertTrue = wrapAssert(doh.assertTrue);
	doh.f = doh.assertFalse = wrapAssert(doh.assertFalse);


		// add some utility functions to the doh global
	doh.fw = {
		path: function()
		{
			var path = arguments[0];

			for (var i = 1; i < arguments.length; i++) {
				var lastChar = path.slice(-1);

					// make sure there is exactly one / between each argument
				if (lastChar != "/" && arguments[i][0] != "/") {
					path += "/";
				}

				path += arguments[i];
			}

			return path;
		},
	
		
		registerRequireFixture: function(
			inLibPath,
			inTest)
		{
			var currentScriptDir = fw.currentScriptDir + "/",
				testName = Files.getFilename(currentScriptDir),
				fwrequirePath = inLibPath,
				requirePath;

			if (!inTest) {
				inTest = fwrequirePath;
				fwrequirePath = "lib/fwrequire.js";
			}
			
			if (fwrequirePath.slice(-3) != ".js") {
					// just a folder name was passed in, so use the default filename
				fwrequirePath = this.path(fwrequirePath, "fwrequire.js");
			}
			
				// we have to delete the existing files before we can copy new 
				// ones over them.  these calls will silently fail if the 
				// destination folder doesn't exist, whic hit won't for some tets.
			fwrequirePath = this.path(currentScriptDir, fwrequirePath);
			requirePath = this.path(Files.getDirectory(fwrequirePath), "require.js");
			Files.deleteFileIfExisting(fwrequirePath);
			Files.copy(this.path(currentScriptDir, "../../fwrequire.js"), fwrequirePath);
			Files.deleteFileIfExisting(requirePath);
			Files.copy(this.path(currentScriptDir, "../../require.js"), requirePath);

			doh.register(
				"fwrequire",
				doh.fw.createRequireFixture(
					testName,
					function(t)
					{
						console.time(testName);
						fw.runScript(currentScriptDir + "Test.jsf");
						console.timeEnd(testName);
						
						inTest(t);
					}
				)
			);
		},
		
		
		createRequireFixture: function(
			inTestName,
			inTest)
		{
			function resetGlobals()
			{
				delete require;
				delete requirejs;
				delete define;
			}
			
			
			return this.createFixture(
				inTestName,
				resetGlobals,
				inTest,
				resetGlobals
			);
		},
		
		
		createFixture: function createFixture(
			inTestName,
			inFunc1,
			inFunc2,
			inFunc3)
		{
			var pre = null,
				post = null,
				test = inFunc1,
				fixture = {
					name: inTestName
				};
				
			if (arguments.length >= 3) {
				pre = inFunc1;
				test = inFunc2;
				post = inFunc3;
			}
			
			fixture.runTest = test;
			
			if (pre) {
				fixture.setUp = pre;
			}
			
			if (post) {
				fixture.tearDown = post;
			}
			
			return fixture;
		}
	};
});
