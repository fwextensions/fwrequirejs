/* ===========================================================================

	File: context.js

	Author - John Dunning
	Copyright - 2012 John Dunning.  All rights reserved.
	Email - fw@johndunning.com
	Website - http://johndunning.com/fireworks

   ======================================================================== */


/*
	The "module" consists of the directory that contains the scripts that call
	module() and the lib/ subdirectory.  Multiple scripts in that directory can
	each call module(), and they will all access the same globals.  A dojo
	instance is always created whenever a new module is created.  The various
	dojo methods can then be called as usual, like dojo.require("foo.bar").

	The function passed to module() is wrapped in a try/catch block, so any
	uncaught exceptions will generate an error alert.

	Calling module() from within another module probably won't work.


	To do:
		- use the return value from the module function for something?
			destroy the module if it returns "destroy"?

		- store the caller's currentScriptDir and then use that as a key to the
			context object for that path
			load the context.js file for that path
			so each path can have its own context implementation   

		- only works for scripts that are run as commands, because otherwise, the
			currentScriptDir isn't set
			also, the file calling module() has to be in the directory above
				/lib/, even if it's using a named module

		- have module check its version number
			if a newer version of the library is loaded, replace the existing
				module library
				would need to copy over all the modules
			since the try module.call block would pass, a newer version of module
				would never get a chance to run
				so any scripts calling it would have to do the check for newer
				versions themselves

		- maybe call it context() since it creates an execution context?

		- running a script that calls another script that then tries to load
			as a module doesn't work
			within the module function, _root.dojo exists, but the dojo global
				doesn't, including in other dojo files like array.js
			seems like in some contexts, setting a property on _root sets a global
				and sometimes it doesn't

		- maybe add namedModule() call that specifies a name for the module instead
			of using a path
			so commands in different folders could all communicate, or a JSML
				panel's JS file could have a module separate from the other panels
				in Command Panels
			or check for a new version number and just use a new parameter, like
				module("foo.bar", function() { })?
				that looks like you're including the foo.bar library before your module
			but calling module from a panel's .js file won't work if it uses any
				fwlib libraries, since module() will delete the global fwlib after
				running the module function, but that will also delete fwlib.panel,
				which the AS expects to be there
				the handlers and other code for the panel has to stick around
				between events from the AS side, but module is designed to clean
				up after itself so no globals stick around after a module runs
				so, it's sort of basically incompatible with the panel concept

		- update local dojo from latest release

		- allow dojo libs to be loaded without calling dojo.require?
			module("dojo.json", "fwlib.dialog", function() {...})

		- if dojo also refers to "modules", is this module name confusing?

	Done:
		- make sure calling nested modules of different names works

		- support nesting modules
			module("foo", function() { ... module("foo", function() { ... } })
			that will cause the globals that were saved when foo was first loaded
				to be swapped back in, and then back out when the second foo finishes

		- make better names for preserve, restore, etc.

		- try running a command from the user js dir
*/


// ===========================================================================
//  Main
// ===========================================================================

try { (function() {
		
log(new Date().toLocaleString());

		// a hash to store each module we're managing by name
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

log("callerPath", callerPath, "currentScriptDir", fw.currentScriptDir);

		if (!executor) {
			var executorPath = callerPath + "/lib/context-executor.js";
log("factoryPath", executorPath);

			if (Files.exists(executorPath)) {
log("*** loading executor");
				fw.runScript(executorPath);
// throw error if addManager wasn't called? 
// probably don't need ot pass path into addManager
				executor = _executors[callerPath];
			}
		}

		if (executor) {
log("*** executing");
			executor.apply(_global, arguments);
		}
	};


	context.version = 1.0;


// some way to list paths of executors


	// =======================================================================
	context.getExecutor = function(
		inExecutorPath)
	{
		return _executors[inExecutorPath];
	};


	// =======================================================================
	context.register = function(
		inPath,
		inExecutor)
	{
log("register", inPath);
		_executors[inPath] = inExecutor;
	};

//log("_initialPath in context", _initialPath);

//	_global.context = context;
	
//	if (typeof _root.context == "function") {
//		_root.context.addManager(_initialPath, context);
//	} else {
//		_root.context = context;
//	}
})(); } catch (exception) {
	if (exception.lineNumber) {
		alert([exception, exception.lineNumber, exception.fileName].join("\n"));
	} else {
		throw exception;
	}
}
