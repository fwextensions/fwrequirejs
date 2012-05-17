/* ===========================================================================

	fwrequire.js

	Copyright 2012 John Dunning.  
	fw@johndunning.com
	http://johndunning.com/fireworks

	fwrequire.js is released under the MIT license.  See the LICENSE file 
	for details.

   ======================================================================== */


/*
	To do:
		- need better error handling when a module can't be found
			alert with the paths that were searched
			having a module define a name for itself and then move the module
				to a different folder has poor error message 

		- trace doesn't work inside context()

		- maybe always pass a config into require, using the context's name
			and path as the default vaules 

		- should pass all the params to the context, so it can decide how to 
			use them

		- store the caller's currentScriptDir on context, separate from current
			context path 

		- add require.get to support synchronous module loading 

		- does the manager need to manage individual contexts? 
			or should require do it? 
			the manager and the context could be combined then

		- test using packages and main.js

		- test setting catchError.define = true

		- calling define() inside a context only works if using a named context
			otherwise, it thinks the root dir is /lib/lib/

		- it's possible to have named and unnamed managers at the same path
			is that a problem? 

		- do we need nested contexts? 
			yes, if a command panel wants to require a library that's defined
			in /Commands, and that library doesn't export a global 

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

	Done:
		- maybe just call it require(), in fwrequire.js
			but the real require would shadow the context one when executing
			or fwrequire()

		- calling one .jsf after another, with the second in a different context,
			seems to throw a recursion error 

		- shuld be possible to pass in a bare string to require just one module 
			no, that's only to get synchronous access to an already loaded module

		- probably don't need to pass path into register

		- store the path to the lib folder on the context, not the path to the
			parent folder

		- test defining JSML in a panel and requiring a library defined
			in Commands

		- maybe get rid of manager object and just have the dispatcher manage the
			Context instances

		- add currently executing path to context global 
			so in case fw.currentScriptDir gets messed up, the module still 
			knows where it is

		- maybe the name should be passed as a context property on the config

		- support configuration objects being passed in

		- context name should be defined by the path to the root folder, not
			the path of the caller
			so two .jsf files in the same directory could have different contexts

		- should we always assume context.js is in /lib/?
			let it be part of a configuration object

		- the manager should probably be its own class
			but it's a singleton for a given path 

		- call it context dispatcher and context manager 

		- put the context and manager code in the same context.js file
			if context isn't defined, it'll use the manager in its own file
			if it is, then it'll register with the global context

		- files at two different paths can't use the same context because this
			context manager just looks at the caller's path and maps that to 
			a manager
			doesn't look at any name passed in

		- see if passing in just a function with no dependencies works
			it didn't, but does now

*/


// ===========================================================================
(function ContextSetup(console) {
	try {
		console.log.call;
	} catch (exception) { 
			// there's no global console loaded, so set up a dummy noop one
		console = {
			log: function() {}
		};
	}


	// =======================================================================
	function path()
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
	}


	// =======================================================================
	function prettifyPath(
		inPath)
	{
			// make sure there's a / on the end of the path, so that whether or
			// not the path got passed in with one, we consistently have a /
			// for the context name
		inPath = path(inPath, "");

			// to make a prettier context name, remove the path to the app
			// Commands directory, or replace it with USER if it's in the
			// user directory
		return unescape(inPath.replace(fw.appJsCommandsDir, "")
			.replace(fw.userJsCommandsDir, "USER"));
	}


	// =======================================================================
	function setupDispatcher() 
	{
			// a hash to store each context manager by name
		var _managers = {},
				// get a reference to the global object.  this would be "window"
				// in a browser, but isn't named in Fireworks.
			_global = (function() { return this; })(),
				// we have to keep track of the currentScriptDir when we're first loaded
				// because it will be empty the first time context() is called after
				// we're first loaded.  the code that's calling us is in the directory
				// above the /lib/
			_initialContextPath = fw.currentScriptDir,
			_initialCallerPath = Files.getDirectory(fw.currentScriptDir),
				// this module global stores the requested manager path or name
				// while the manager code is loaded, so we know what to call it
				// when it calls registerManager()
			_currentManagerPath = "";


		// ===================================================================
		var context = _global.require = function context(
			inConfig)
		{
				// if currentScriptDir is null, it means this is the first context()
				// call after we were loaded via runScript, so fall back to the
				// _initialCallerPath we stored above
			var callerPath = fw.currentScriptDir || _initialCallerPath,
					// if there's a currentScriptDir, then that means the 
					// context has already been set up, so we don't know where
					// the context.js file is located relative to the calling
					// file.  so assume it's in a lib subfolder. 
				contextPath = fw.currentScriptDir ? path(fw.currentScriptDir, "lib/") : 
					_initialContextPath,
				manager;

				// make sure inConfig is an object but not an array 
			if (inConfig && typeof inConfig == "object" && !(inConfig instanceof Array)) {
				if (inConfig.baseUrl) {
					contextPath = inConfig.baseUrl;

					if (contextPath.indexOf("file://") != 0) {
						contextPath = path(callerPath, contextPath);
					}
				}
				
			}
			
				// make sure the contextPath ends in a /
			contextPath = path(contextPath, "");
			manager = _managers[contextPath];

			if (!manager) {
					// call the version of context.js at this path
				var contextJSPath = path(contextPath, "context.js");

				if (Files.exists(contextJSPath)) {
						// save the current contextPath, which we'll use when the
						// manager calls registerManager after we run its JS
					_currentManagerPath = contextPath;
					fw.runScript(contextJSPath);

						// the manager should now be registered
					manager = _managers[contextPath];
					manager.path = contextPath;
					_currentManagerPath = "";
				}
			}

			if (manager) {
					// dispatch the context call to the manager for the 
					// requested context
				manager.executeContext.apply(manager, arguments);
			} else {
				alert(unescape(contextJSPath).quote() + " could not be found.");
			}
		};


		context.version = 1.0;


		// ===================================================================
		context.getManagerPaths = function getManagerPaths()
		{
			var paths = [];

			for (var name in _managers) {
				paths.push(name);
			}

			return paths;
		};


		// ===================================================================
		context.getManager = function getManager(
			inManagerPath)
		{
			return _managers[inManagerPath];
		};


		// ===================================================================
		context.registerManager = function registerManager(
			inManager)
		{
				// if _currentManagerPath is falsy, we must not be in the middle 
				// of calling runScript on an manager, so ignore this call 
			if (_currentManagerPath) {
				_managers[_currentManagerPath] = inManager;
			}
		};


		// ===================================================================
		context.destroy = function destroy(
			inPath)
		{
			var manager = _managers[inPath];

			if (manager) {
					// destroying an manager means destroying all the contexts
					// it manages
				manager.destroyAll();
				delete _managers[inPath];
			}
		};


		// ===================================================================
		context.destroyAll = function destroyAll()
		{
			for (var path in _managers) {
				this.destroy(path);
			}
		};

		return context;
	}


	// =======================================================================
	function setupManager() 
	{
			// a hash to store each context we're managing by name
		var _contexts = {},
			_context,
			_stack = [],
				// get a reference to the global object.  this would be "window"
				// in a browser, but isn't named in Fireworks.
			_global = (function() { return this; })();


		// ===================================================================
		function Context(
			inName,
			inPath)
		{
			this.name = inName;
			this.path = inPath;
log("-------- new Context", inName, inPath);

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
			destroy: function destroy()
			{
				if (this.globals.require) {
					delete this.globals.require.attach;
				}

					// make double-sure that references to the stored globals are broken
				this.globals = null;
				this.preservedGlobals = null;
			},


			// ===============================================================
			execute: function execute(
				inConfig,
				inDependencies,
				inCallback,
				inSameContext)
			{
inSameContext = false;

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

					// we can't call this "name", because require.name is the 
					// name of the require function and is read-only
				require.currentName = this.name;
				require.currentPath = this.path;

				try {
//					if (inDependencies && typeof inDependencies == "object") {
//							// we don't want the baseUrl making it into the require()
//							// call, since we already passed it a baseUrl when we
//							// first loaded it
//						delete inDependencies.baseUrl;
//					}

						// call this context's instance of the require global, which
						// should be loaded or restored by now 
					var result = require(inDependencies, inCallback);
//					var result = require(inConfig, inDependencies, inCallback);
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


			// ===============================================================
			loadRequire: function loadRequire()
			{
					// these are the three globals that require() creates.  
					// loading them now won't restore any previous value (since 
					// this is the first time we're loading require), but it 
					// ensures that they'll be saved when we're done executing.
				this.loadGlobal("define");
				this.loadGlobal("require");
				this.loadGlobal("requirejs");

					// now instantiate the require library in this context's path
				fw.runScript(path(this.path, "require.js"));

				try {
						// tell require where to look for our files 
					require({ baseUrl: this.path });
				} catch (exception) { 
						// the require library must not be installed 
					console.log("ERROR in context", this.name.quote() + ":", "require.js was not found in", this.path);
					return;
				}

					// create a reference to our path for the attach method
				var libPath = this.path;

					// override the attach method on require to use a synchronous
					// file load to load the module 
				require.attach = function attach(
					url, 
					context, 
					moduleName) 
				{
					if (url.indexOf("file://") != 0) {
							// if we're here, the required module name must end 
							// in .js, which require tries to load from a path 
							// relative to the HTML page, which obviously doesn't 
							// exist.  so force it to use our lib path. 
						url = path(libPath, url);
					}

					fw.runScript(url);
					context.completeLoad(moduleName);
				};

					// save an easily accessible reference to our require instance
				this.require = require;

					// we only need to do this once per context
				this.loadedRequire = true;
			},


			// ===============================================================
			loadGlobal: function loadGlobal(
				inGlobalName)
			{
				if (!(inGlobalName in this.preservedGlobals)) {
						// preserve the current value of inGlobalName
					this.preservedGlobals[inGlobalName] = _global[inGlobalName];

						// we haven't encountered this global before, so make
						// sure we add its name to our globals hash, with an
						// undefined value.  this is crucial because in 
						// saveGlobals, we loop through the globals hash and 
						// save each global's current value back to the hash.
						// if we don't add the name now, the global's value at
						// the end of the context execution will be lost.  
						// 
						// this code used to be:
						// this.globals[inGlobalName] = this.globals[inGlobalName];
						// but that looked like an unnecessary noop if you didn't
						// know about (or forgot, duh!) what happens in 
						// saveGlobals.  an explicit if statement is clearer.
					if (!(inGlobalName in this.globals)) {
						this.globals[inGlobalName] = undefined;
					}
				}

					// make our saved global available in the root context.  
					// it'll be undefined if this is the first time the global 
					// is being used in this context.
				_global[inGlobalName] = this.globals[inGlobalName];

				return _global[inGlobalName];
			},


			// ===============================================================
			restoreGlobals: function restoreGlobals()
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


			// ===============================================================
			saveGlobals: function saveGlobals()
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
		var manager = {
			executeContext: function executeContext(
				inConfig,
				inDependencies,
				inCallback)
			{
				var contextName = prettifyPath(this.path);
log([].concat(arguments));

					// adjust the optional parameters 
				if (typeof inConfig == "function") {
					inCallback = inConfig;
					inDependencies = [];
					inConfig = prettifyPath(this.path);
					contextName = prettifyPath(this.path);
				} else if (inConfig instanceof Array || typeof inConfig == "string") {
					inCallback = inDependencies;
					inDependencies = inConfig;
					inConfig = prettifyPath(this.path);
					contextName = prettifyPath(this.path);
				} else if (inConfig && typeof inConfig == "object") {
					contextName = inConfig.context || prettifyPath(this.path);
				}
				
				if (typeof inDependencies == "function") {
					inCallback = inDependencies;
					inDependencies = [];
				}

					// get the previously saved context with this name, or create a new
					// one if it's the first time this name is being used 
//				var context = _context ||
//					(_context = new Context(contextName, this.path)),
				var context = _contexts[contextName] ||
					(_contexts[contextName] = new Context(contextName, this.path)),
					previousContext = _stack[_stack.length - 1],
					executingInSameContext = (previousContext && (previousContext.name == context.name));

					// push the context onto the stack so we can support nested contexts
				_stack.push(context);

					// tell the context to execute the function the caller passed in and
					// whether the same context is already loaded, which means it doesn't
					// need to save off its globals 
				var result = context.execute(inConfig, inDependencies, inCallback, executingInSameContext);

				_stack.pop();

				return result;
			},


			version: 1.0,


			// ===============================================================
			get: function get(
				inContextName)
			{
				return _contexts[inContextName];
			},


			// ===============================================================
			getNames: function getNames()
			{
				var names = [];

				for (var name in _contexts) {
					names.push(name);
				}

				return names;
			},


			// ===============================================================
			destroy: function destroy(
				inContextName)
			{
					// default to the path of the current script if no name is passed in
				inContextName = inContextName || prettifyPath(this.path);
				var targetContext = _contexts[inContextName];

				if (targetContext) {
					targetContext.destroy();
					delete _contexts[inContextName];
				}
			},


			// ===============================================================
			destroyAll: function destroyAll()
			{
				for (var name in _contexts) {
					this.destroy(name);
				}
			}
		};


			// register our manager with the context global 
		if (typeof require == "function") {
			require.registerManager(manager);
		}
	}

	try { 
		if (typeof require != "function") {
				// the global context function hasn't been set up yet
			setupDispatcher();
		} else {
				// there's already a global context dispatcher, so just 
				// define the manager for the current path
			setupManager();
		}
	} catch (exception) {
		if (exception.lineNumber) {
			alert([exception, exception.lineNumber, exception.fileName].join("\n"));
		} else {
			throw exception;
		}
	}
})(typeof console == "object" && console ? console : null); 
// pass the existing console global, if any, into our module 
