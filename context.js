/* ===========================================================================

	File: context.js

	Author - John Dunning
	Copyright - 2012 John Dunning.  All rights reserved.
	Email - fw@johndunning.com
	Website - http://johndunning.com/fireworks

   ======================================================================== */


/*
	To do:
		- put the context and executor code in the same context.js file
			if context isn't defined, it'll use the executor in its own file
			if it is, then it'll register with the global context

		- should we always assume context.js is in /lib/?

		- support configuration objects being passed in

		- support passing a path to the lib directory for the context name? 

		- it's possible to have named and unnamed executors at the same path
			is that a problem? 

		- how do you define a module?
			want to define it in a way that it's available to the other modules
				in the context
			but if another script calls the file that defines the module,
				define() may not be defined yet
				since it's not in the middle of a context call
			call define within a context call?

		- throw error if addManager wasn't called? 

		- probably don't need to pass path into register

	Done:
		- files at two different paths can't use the same context because this
			context manager just looks at the caller's path and maps that to 
			an executor
			doesn't look at any name passed in

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
		_initialCallerPath = Files.getDirectory(fw.currentScriptDir),
		_currentContextName = "";


	// =======================================================================
	var context = _global.context = function(
		inContextName)
	{
			// if currentScriptDir is null, it means this is the first context()
			// call after we were loaded via runScript, so fall back to the
			// _initialCallerPath we stored above
		var callerPath = fw.currentScriptDir || _initialCallerPath,
			contextName = typeof inContextName == "string" ? inContextName : callerPath,
			executor = _executors[contextName];

		if (!executor) {
			var executorPath = callerPath + "/lib/context-executor.js";

			if (Files.exists(executorPath)) {
					// save the current contextName, which we'll use when the
					// executor calls registerExecutor after we run its JS
				_currentContextName = contextName;
				fw.runScript(executorPath);
				
					// the executor should now be registered
				executor = _executors[contextName];
				_currentContextName = "";
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
		inExecutor)
	{
			// if _currentContextName is falsy, we must not be in the middle of
			// calling runScript on an executor, so ignore this call 
		if (_currentContextName) {
			_executors[_currentContextName] = inExecutor;
		}
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
