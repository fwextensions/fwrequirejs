# FWRequireJS tests

Before any of the tests in this directory is run, the [Fireworks Console](http://johndunning.com/fireworks/about/FWConsole) must be installed and open.  The test results are displayed in the console. 

If the FWRequireJS repository is stored in the `Commands/` directory, the tests can be run by selecting *Commands > fwrequirejs > Run All Tests*.  Tests can also be run individually, but they’re too deeply nested to show up in the menu.  You can run them by calling `fw.runScript()` via the console, e.g. `fw.runScript(fw.appJsCommandsDir + "/fwrequirejs/tests/Simple/Test.jsf");`.

The tests use the `doh` test framework.  The `dojo` loader is used to load `doh`, and then the `require` and `define` globals created by `dojo` are deleted, since we want to test the actual RequireJS versions of those functions.

The `_fireworksRunner.js` in `tests/util/doh/` monkey patches `doh` to run in the Fireworks environment.  It creates a fake `setTimeout()` function, since `doh` depends on that to run tests and it doesn’t exist in Fireworks.  It also implements some utility functions to simplify creating Fireworks tests.  

The `Run All Tests.jsf` script will automatically detect all the test files and then run them.  Each of the Fireworks test folders contains `Test.js` and `Test.jsf` files.  The .jsf file contains the boilerplate code to load FWRequireJS and then calls `require()` to load some modules and verifies the results.  The .js file sets up and registers the `doh` fixture that runs `Test.jsf`.  Since the Fireworks scripts each expect to have their own copy of `fwrequire.js` and `require.js`, the fixture will copy those files to the local `lib/` folder before running the .jsf file, which avoids having multiple copies in the repository.  The fixture also deletes the `require()` and `define()` globals before each test.  

In the `requirejs tests` folder, the `Run All Tests.jsf` file looks for JS files that end in `-tests.js` and runs each one.  Since the RequireJS tests expect that the library has already been loaded before they’re run, the test harness calls:

	require({
		contextPath: Files.getDirectory(path),
		requirePath: requirePath
	});

This creates a context at the test’s path, so when the test calls `require()`, the existing context will be found.  That way, the test doesn’t need to specify the location of the `fwrequire.js` file.  Since the RequireJS tests use "./" as the `baseUrl` if they’re running in a browser, the test harness also sets `isBrowser` to true to fake out the tests.  

The RequireJS tests are there mostly to verify that the basic functionality hasn’t been broken. 

