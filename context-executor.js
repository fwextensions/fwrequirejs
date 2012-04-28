/* ===========================================================================

	File: context-executor.js

	Author - John Dunning
	Copyright - 2012 John Dunning.  All rights reserved.
	Email - fw@johndunning.com
	Website - http://johndunning.com/fireworks

   ======================================================================== */


/*
	To do:
		- should have just one instance of require per executor?

		- see if passing in just a function with no dependencies works

		- do we need nested contexts? 

		- store the path to the lib folder on the context, not the path to the
			parent folder

	Done:
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
			// we have to keep track of the currentScriptDir when we're first loaded
			// because it will be empty the first time module() is called after
			// we're first loaded.  the code that's calling us is in the directory
			// above the /lib/
		_initialCallerPath = Files.getDirectory(fw.currentScriptDir);


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
	Context.prototype = {
		
	destroy: function()
	{
		if (this.globals.require) {
			delete this.globals.require.attach;
		}

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
				// we've never been executed before, so load the require library
				// before the callback is called, since it will expect that 
				// require is already loaded
			this.loadRequire();
		}

		try {
			var result = require(inDependencies, inCallback);
		} catch (exception) {
			alert(["Error in context: " + this.name, exception.message,
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
			// these are the three globals that require creates.  loading them
			// now won't restore any previous value (since this is the first time
			// we're loading require), but it ensures that they'll be saved when
			// we're done executing.
		this.loadGlobal("define");
		this.loadGlobal("require");
		this.loadGlobal("requirejs");
		
		var libPath = this.path + "/lib/";

			// now instantiate the require library in this context's path
		fw.runScript(libPath + "require.js");

		require.attach = function(
			url, 
			context, 
			moduleName) 
		{
			url = libPath + url;
log("*** attach", url);
			fw.runScript(url);
			context.completeLoad(moduleName);
		};

			// we only need to do this once per context
		this.loadedRequire = true;
	},


	// =======================================================================
	loadGlobal: function(
		inGlobalName)
	{
		if (!(inGlobalName in this.preservedGlobals)) {
				// preserve the current value of inGlobalName
			this.preservedGlobals[inGlobalName] = _global[inGlobalName];

			this.globals[inGlobalName] = this.globals[inGlobalName];
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
			// if currentScriptDir is null, it means this is the first module()
			// call after we were loaded via runScript, so fall back to the
			// _initialModulePath we stored above
		var contextPath = fw.currentScriptDir || _initialCallerPath;
			
		if (typeof inContextName == "function") {
			inCallback = inContextName;
			inDependencies = [];
			inContextName = prettifyPath(contextPath);
		} else if (inContextName instanceof Array) {
			inCallback = inDependencies;
			inDependencies = inContextName;
			inContextName = prettifyPath(contextPath);
		}

			// get the previously saved context with this name, or create a new
			// one if it's the first time this name is being used 
		var context = _contexts[inContextName] ||
			(_contexts[inContextName] = new Context(inContextName, contextPath));

			// push the module onto the stack so we can support nested modules
		_stack.push(context);

			// tell the module to execute the function the caller passed in
		var result = context.execute(inDependencies, inCallback);

		_stack.pop();

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
			execute.destroy(name);
		}
	};


		// register our executor with the context global 
	if (typeof _global.context == "function") {
		_global.context.registerExecutor(_initialCallerPath, execute);
	}
})();

} catch (exception) {
	alert([exception, exception.lineNumber, exception.fileName].join("\n"));
}
