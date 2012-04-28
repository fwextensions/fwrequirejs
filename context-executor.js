/* ===========================================================================

	File: context-execute.js

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

try {

(function() {
		// a hash to store each module we're managing by name
	var _contexts = {},
		_stack = [],
			// get a reference to the global object.  this would be "window"
			// in a browser, but isn't named in Fireworks.
		_global = this,
//		_global = (function() { return this; })(),
			// we have to keep track of the currentScriptDir when we're first loaded
			// because it will be empty the first time module() is called after
			// we're first loaded.  the code that's calling us is in the directory
			// above the /lib/
		_initialCallerPath = Files.getDirectory(fw.currentScriptDir);

log("**** in manager", _initialCallerPath);

	// =======================================================================
	function prettifyPath(
		inPath)
	{
			// to make a prettier module name, remove the path to the app
			// Commands directory, or replace it with USER if it's in the
			// user directory
		return inPath.replace(fw.appJsCommandsDir, "").replace(fw.userJsCommandsDir, "USER");
	}


	// =======================================================================
	function Context(
		inName,
		inPath)
	{
		this.name = inName;
		this.path = inPath;

			// these are the globals that belong to the module and will be saved
			// after the module exits
		this.globals = {};

			// these are the globals that are being overridden by the current
			// execution of the module
		this.preservedGlobals = {};

			// this is a stack of previously preserved globals, so that we can
			// support nested modules 
		this.preservedGlobalsStack = [];

		this.loadedRequire = false;
	}


	// =======================================================================
//	Context.prototype.destroy = function()
	Context.prototype = {
		
	destroy: function()
	{
//		if (this.globals.dojo) {
//				// get rid of the closure that has a reference to this instance
//			delete this.globals.dojo._getProp;
//		}

			// make double-sure that references to the stored globals are broken
		this.globals = null;
		this.preservedGlobals = null;
	},


	// =======================================================================
	execute: function(
		inDependencies,
		inCallback)
	{
			// before executing the module function, restore our previously
			// saved globals
		this.restoreGlobals();

		if (!this.loadedRequire) {
				// we've never been executed before, so load the dojo library
				// before the module function is called, since it will expect
				// that dojo is loaded
			this.loadRequire();
		}

		try {
			var result = require(inDependencies, inCallback);
//			var result = inFunction();
		} catch (exception) {
			alert(["Error in module function: " + this.name, exception.message,
				exception.lineNumber, exception.fileName].join("\n"));
		}

			// save the current values of our globals, which will also restore
			// their previously preserved values
		this.saveGlobals();

		return result;
	},


	// =======================================================================
	loadRequire: function()
	{
			// we always need to create a dojo global for a new module because
			// the global object isn't created with dojo._getProp (which doesn't
			// exist yet)
		this.loadGlobal("require");
		this.loadGlobal("define");

			// now instantiate the dojo library in this module's path
		fw.runScript(this.path + "/lib/require.js");

			// we only need to do this once 
		this.loadedRequire = true;
	},


	// =======================================================================
	loadGlobal: function(
		inGlobalName)
	{
		if (!(inGlobalName in this.preservedGlobals)) {
				// preserve the current value of inGlobalName
			this.preservedGlobals[inGlobalName] = _global[inGlobalName];

				// create an empty object if we don't already have a global of
				// this name for this module
			this.globals[inGlobalName] = this.globals[inGlobalName] || {};
		}

			// make our saved global available in the root context.  it'll be an
			// empty object if this is the first time the global is being used
			// in this module.
		_global[inGlobalName] = this.globals[inGlobalName];

		return _global[inGlobalName];
	},


	// =======================================================================
	restoreGlobals: function()
	{
			// push the globals we'd previously preserved on to the stack and
			// then create a fresh object to store the current globals.  calling
			// loadGlobal will store the current global in this.preservedGlobals.
			// we need to keep a stack of these preserved globals because one
			// module may call another.  so if A > B > C > A, the second instance
			// of module A needs to preserve the globals created in C, while the
			// first instance still preserves whatever globals were in place
			// when it was called. 
		this.preservedGlobalsStack.push(this.preservedGlobals);
		this.preservedGlobals = {};
		
		for (var name in this.globals) {
			this.loadGlobal(name);
		}
	},


	// =======================================================================
	saveGlobals: function()
	{
		var name;

		for (name in this.globals) {
				// update our stored reference to this global before deleting
				// it, in case this is the first time through the module and the
				// code that modified the global didn't use the empty object we
				// created when loadGlobal() was initially called.  for instance,
				// dojo.provide("foo"); foo = function() { ... }; replaces the
				// foo global created when dojo.provide("foo") was called.
			this.globals[name] = _global[name];
			delete _global[name];
		}

			// restore all the globals we had preserved
		for (name in this.preservedGlobals) {
			_global[name] = this.preservedGlobals[name];
		}

			// now that we've restored all of these globals, pop back to the
			// next set of preserved globals on the stack 
		this.preservedGlobals = this.preservedGlobalsStack.pop();
	}

	};


	// =======================================================================
	var execute = function(
		inContextName,
		inDependencies,
		inCallback)
	{
log(inContextName);

			// if currentScriptDir is null, it means this is the first module()
			// call after we were loaded via runScript, so fall back to the
			// _initialModulePath we stored above
		var contextPath = fw.currentScriptDir || _initialCallerPath;
			
		if (typeof inContextName == "function") {
			inCallback = inContextName;
			inDependencies = [];
			inContextName = prettifyPath(contextPath);
		} else if (typeof inContextName instanceof Array) {
			inDependencies = inContextName;
			inCallback = inDependencies;
			inContextName = prettifyPath(contextPath);
		}

			// get the previously saved context with this name, or create a new
			// one if it's the first time this name is being used 
		var context = _contexts[inContextName];
		if (!context) {
			_contexts[inContextName] = context = new Context(inContextName, contextPath);
		}

			// push the module onto the stack so we can support nested modules
		_stack.push(context);

			// tell the module to execute the function the caller passed in
		var result = context.execute(inDependencies, inCallback);

		_stack.pop();

//		if (inDestroyContext == "destroy") {
//				// the module wants to be destroyed after it runs, so kill it
//				// as long as one with the same name doesn't exist in the stack,
//				// as destroying this one would affect the earlier one
//			var moduleInStack = false;
//
//			for (var i = 0; i < _stack.length; i++) {
//				if (_stack[i].name == contextName) {
//					moduleInStack = true;
//					break;
//				}
//			}
//
//			if (!moduleInStack) {
//					// it's safe to destroy the module
//				context.destroy(contextName);
//			}
//		}

		return result;
	};


	execute.version = 1.0;


	// =======================================================================
	execute.get = function(
		inContextName)
	{
		return _contexts[inContextName];
	};


	// =======================================================================
	execute.getNames = function()
	{
		var names = [];

		for (var name in _contexts) {
			names.push(name);
		}

		return names;
	};


	// =======================================================================
	execute.destroy = function(
		inContextName)
	{
			// default to the path of the current script if no name is passed in
		inContextName = inContextName || prettifyPath(fw.currentScriptDir || _initialCallerPath);
		var targetContext = _contexts[inContextName];

		if (targetContext) {
			targetContext.destroy();
			delete _contexts[inContextName];
		}
	};


	// =======================================================================
	execute.destroyAll = function()
	{
		for (var name in _contexts) {
			context.destroy(name);
		}
	};


	if (typeof _global.context == "function") {
		_global.context.register(_initialCallerPath, execute);
	}
})();

} catch (exception) {
	alert([exception, exception.lineNumber, exception.fileName].join("\n"));
}
