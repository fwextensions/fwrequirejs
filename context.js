/* ===========================================================================

	File: context.js

	Author - John Dunning
	Copyright - 2012 John Dunning.  All rights reserved.
	Email - fw@johndunning.com
	Website - http://johndunning.com/fireworks

   ======================================================================== */


/*
	To do:
		- call it context dispatcher and context manager 

		- should we always assume context.js is in /lib/?

		- support configuration objects being passed in

		- support passing a path to the lib directory for the context name? 

		- it's possible to have named and unnamed managers at the same path
			is that a problem? 

		- the manager should probably be its own class

		- do we need nested contexts? 
			yes, if a command panel wants to require a library that's defined
			in /Commands, and that library doesn't export a global 

		- move loadRequire to Manager constructor?

		- store the path to the lib folder on the context, not the path to the
			parent folder

		- should have just one instance of require per manager?
			no, because then one path could have only one context

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
		- put the context and manager code in the same context.js file
			if context isn't defined, it'll use the manager in its own file
			if it is, then it'll register with the global context

		- files at two different paths can't use the same context because this
			context manager just looks at the caller's path and maps that to 
			an manager
			doesn't look at any name passed in

		- see if passing in just a function with no dependencies works
			it didn't, but does now

*/


// ===========================================================================
(function(context) {
	var exception;

	function setupDispatcher() {
			// a hash to store each context manager by name
		var _managers = {},
				// get a reference to the global object.  this would be "window"
				// in a browser, but isn't named in Fireworks.
			_global = (function() { return this; })(),
				// we have to keep track of the currentScriptDir when we're first loaded
				// because it will be empty the first time context() is called after
				// we're first loaded.  the code that's calling us is in the directory
				// above the /lib/
			_initialCallerPath = Files.getDirectory(fw.currentScriptDir),
				// this module global stores the requested manager path or name
				// while the manager code is loaded, so we know what to call it
				// when it calls registerManager()
			_currentManagerName = "";


		// ===================================================================
		context = _global.context = function(
			inManagerName)
		{
				// if currentScriptDir is null, it means this is the first context()
				// call after we were loaded via runScript, so fall back to the
				// _initialCallerPath we stored above
			var callerPath = fw.currentScriptDir || _initialCallerPath,
				contextName = typeof inManagerName == "string" ? inManagerName : callerPath,
				manager = _managers[contextName];

			if (!manager) {
					// call the version of context.js at this path
				var managerPath = callerPath + "/lib/context.js";

				if (Files.exists(managerPath)) {
						// save the current contextName, which we'll use when the
						// manager calls registerManager after we run its JS
					_currentManagerName = contextName;
					fw.runScript(managerPath);

						// the manager should now be registered
					manager = _managers[contextName];
					_currentManagerName = "";
				}
			}

			if (manager) {
					// dispatch the context call to the manager for the 
					// requested context
				manager.apply(_global, arguments);
			}
		};


		context.version = 1.0;


		// ===================================================================
		context.getNames = function()
		{
			var names = [];

			for (var name in _managers) {
				names.push(name);
			}

			return names;
		};


		// ===================================================================
		context.getManager = function(
			inManagerPath)
		{
			return _managers[inManagerPath];
		};


		// ===================================================================
		context.registerManager = function(
			inManager)
		{
				// if _currentManagerName is falsy, we must not be in the middle of
				// calling runScript on an manager, so ignore this call 
			if (_currentManagerName) {
				_managers[_currentManagerName] = inManager;
			}
		};


		// ===================================================================
		context.destroy = function(
			inPath)
		{
			var manager = _managers[inPath];

			if (manager) {
					// destroying an manager means destroying all the contexts
					// it manages
				manager.destroyAll();
			}
		};


		// ===================================================================
		context.destroyAll = function()
		{
			for (var path in _managers) {
				context.destroy(path);
			}
		};

		return context;
	}


	// =======================================================================
	function setupManager() {
			// a hash to store each context we're managing by name
		var _contexts = {},
			_stack = [],
				// get a reference to the global object.  this would be "window"
				// in a browser, but isn't named in Fireworks.
			_global = (function() { return this; })(),
				// we have to keep track of the currentScriptDir when we're first loaded
				// because it will be empty the first time context() is called after
				// we're first loaded.  the code that's calling us is in the directory
				// above the /lib/
			_initialCallerPath = Files.getDirectory(fw.currentScriptDir);


		// ===================================================================
		function prettifyPath(
			inPath)
		{
				// to make a prettier context name, remove the path to the app
				// Commands directory, or replace it with USER if it's in the
				// user directory
			return inPath.replace(fw.appJsCommandsDir, "").replace(fw.userJsCommandsDir, "USER");
		}


		// ===================================================================
		function Context(
			inName,
			inPath)
		{
			this.name = inName;
			this.path = inPath;

				// these are the globals that belong to the context and will be saved
				// after the context exits
			this.globals = {};

				// these are the globals that are being overridden by the current
				// execution of the context
			this.preservedGlobals = {};

				// this is a stack of previously preserved globals, so that we can
				// support nested contexts 
			this.preservedGlobalsStack = [];

			this.loadedRequire = false;
		}


		// ===================================================================
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


		// ===================================================================
		execute: function(
			inDependencies,
			inCallback,
			inSameContext)
		{
				// before executing the callback, restore our previously saved 
				// globals, but only if a different context was previously loaded
			if (!inSameContext) {
				this.restoreGlobals();
			}

			if (!this.loadedRequire) {
					// we've never been executed before, so load the require library
					// before the callback is called, since it will expect that 
					// require is already loaded
				this.loadRequire();
			}

			try {
					// call this context's instance of the require global, which
					// should be loaded or restored by now 
				var result = require(inDependencies, inCallback);
			} catch (exception) {
				if (exception.lineNumber) {
					alert(["Error in context: " + this.name, exception.message,
						exception.lineNumber, exception.fileName].join("\n"));
				} else {
						// there's no error info on the exception, so show an
						// alert that there was an error in this context, then
						// throw the exception to let FW display a more 
						// meaningful error message
					alert("Error in context: " + this.name);
					throw exception;
				}
			}

				// save the current values of our globals, which will also restore
				// their previously preserved values
			if (!inSameContext) {
				this.saveGlobals();
			}

			return result;
		},


		// ===================================================================
		loadRequire: function()
		{
				// these are the three globals that require() creates.  loading them
				// now won't restore any previous value (since this is the first time
				// we're loading require), but it ensures that they'll be saved when
				// we're done executing.
			this.loadGlobal("define");
			this.loadGlobal("require");
			this.loadGlobal("requirejs");

			var libPath = this.path + "/lib/";

				// now instantiate the require library in this context's path
			fw.runScript(libPath + "require.js");

				// override the attach method on require to use a synchronous
				// file load to load the module 
			require.attach = function(
				url, 
				context, 
				moduleName) 
			{
				url = libPath + url;
				fw.runScript(url);
				context.completeLoad(moduleName);
			};

				// we only need to do this once per context
			this.loadedRequire = true;
		},


		// ===================================================================
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
				// in this context.
			_global[inGlobalName] = this.globals[inGlobalName];

			return _global[inGlobalName];
		},


		// ===================================================================
		restoreGlobals: function()
		{
				// push the globals we'd previously preserved on to the stack and
				// then create a fresh object to store the current globals.  calling
				// loadGlobal will store the current global in this.preservedGlobals.
				// we need to keep a stack of these preserved globals because one
				// context may call another.  so if A > B > C > A, the second instance
				// of context A needs to preserve the globals created in C, while the
				// first instance still preserves whatever globals were in place
				// when it was called. 
			this.preservedGlobalsStack.push(this.preservedGlobals);
			this.preservedGlobals = {};

			for (var name in this.globals) {
				this.loadGlobal(name);
			}
		},


		// ===================================================================
		saveGlobals: function()
		{
			var name;

			for (name in this.globals) {
					// update our stored reference to this global before deleting
					// it, in case this is the first time through the context and the
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

		}; // end of Context.prototype


		// ===================================================================
		var execute = function(
			inContextName,
			inDependencies,
			inCallback)
		{
				// if currentScriptDir is null, it means this is the first context()
				// call after we were loaded via runScript, so fall back to the
				// _initialModulePath we stored above
			var contextPath = fw.currentScriptDir || _initialCallerPath;

				// adjust the optional parameters 
			if (typeof inContextName == "function") {
				inCallback = inContextName;
				inDependencies = [];
				inContextName = prettifyPath(contextPath);
			} else if (inContextName instanceof Array) {
				inCallback = inDependencies;
				inDependencies = inContextName;
				inContextName = prettifyPath(contextPath);
			} else if (typeof inDependencies == "function") {
				inCallback = inDependencies;
				inDependencies = [];
			}

				// get the previously saved context with this name, or create a new
				// one if it's the first time this name is being used 
			var context = _contexts[inContextName] ||
				(_contexts[inContextName] = new Context(inContextName, contextPath)),
				previousContext = _stack[_stack.length - 1],
				executingInSameContext = (previousContext && (previousContext.name == context.name));

				// push the context onto the stack so we can support nested contexts
			_stack.push(context);

				// tell the context to execute the function the caller passed in and
				// whether the same context is already loaded, which means it doesn't
				// need to save off its globals 
			var result = context.execute(inDependencies, inCallback, executingInSameContext);

			_stack.pop();

			return result;
		};


		execute.version = 1.0;


		// ===================================================================
		execute.get = function(
			inContextName)
		{
			return _contexts[inContextName];
		};


		// ===================================================================
		execute.getNames = function()
		{
			var names = [];

			for (var name in _contexts) {
				names.push(name);
			}

			return names;
		};


		// ===================================================================
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


		// ===================================================================
		execute.destroyAll = function()
		{
			for (var name in _contexts) {
				execute.destroy(name);
			}
		};


			// register our manager with the context global 
		if (typeof context == "function") {
			context.registerManager(execute);
		}
	}

	try { 
		if (typeof context != "function") {
				// the global context function hasn't been set up yet
			setupDispatcher();
		} else {
				// there's already a global context dispatcher, so just 
				// define the manager for the local path
			setupManager();
		}
	} catch (exception) {
		if (exception.lineNumber) {
			alert([exception, exception.lineNumber, exception.fileName].join("\n"));
		} else {
			throw exception;
		}
	}
})(context); // pass the existing global, if any, into our module 
