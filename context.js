/* ===========================================================================

	File: context.js

	Author - John Dunning
	Copyright - 2012 John Dunning.  All rights reserved.
	Email - fw@johndunning.com
	Website - http://johndunning.com/fireworks

   ======================================================================== */


/*

	To do:
		- throw error if addManager wasn't called? 

		- probably don't need to pass path into register

	Done:
*/


// ===========================================================================
try { (function() {
		
		// a hash to store each context executor we're managing by name
	var _executors = {},
			// get a reference to the global object.  this would be "window"
			// in a browser, but isn't named in Fireworks.
		_global = (function() { return this; })(),
			// we have to keep track of the currentScriptDir when we're first loaded
			// because it will be empty the first time module() is called after
			// we're first loaded.  the code that's calling us is in the directory
			// above the /lib/
		_initialCallerPath = Files.getDirectory(fw.currentScriptDir);


	// =======================================================================
	var context = _global.context = function()
	{
			// if currentScriptDir is null, it means this is the first context()
			// call after we were loaded via runScript, so fall back to the
			// _initialCallerPath we stored above
		var callerPath = fw.currentScriptDir || _initialCallerPath,
			executor = _executors[callerPath];

		if (!executor) {
			var executorPath = callerPath + "/lib/context-executor.js";

			if (Files.exists(executorPath)) {
				fw.runScript(executorPath);
				executor = _executors[callerPath];
			}
		}

		if (executor) {
			executor.apply(_global, arguments);
		}
	};


	context.version = 1.0;


	// =======================================================================
	context.getPaths = function()
	{
		var paths = [];

		for (var path in _executors) {
			paths.push(path);
		}

		return paths;
	};


	// =======================================================================
	context.getExecutor = function(
		inExecutorPath)
	{
		return _executors[inExecutorPath];
	};


	// =======================================================================
	context.registerExecutor = function(
		inPath,
		inExecutor)
	{
		_executors[inPath] = inExecutor;
	};


	// =======================================================================
	context.destroy = function(
		inPath)
	{
		var executor = _executors[inPath];
		
		if (executor) {
				// destroying an executor means destroying all the contexts
				// it manages
			executor.destroyAll();
		}
	};


	// =======================================================================
	context.destroyAll = function()
	{
		for (var path in _executors) {
			context.destroy(path);
		}
	};
})(); } catch (exception) {
	if (exception.lineNumber) {
		alert([exception, exception.lineNumber, exception.fileName].join("\n"));
	} else {
		throw exception;
	}
}
