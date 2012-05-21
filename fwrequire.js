/* ===========================================================================

	fwrequire.js

	Copyright 2012 John Dunning.  
	fw@johndunning.com
	http://johndunning.com/fireworks

	fwrequire.js is released under the MIT license.  See the LICENSE file 
	for details.

	Documentation is availalbe at https://github.com/fwextensions/fwrequirejs

   ======================================================================== */


// ===========================================================================
(function fwRequireSetup() {
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
	function setupDispatcher() 
	{
			// a hash to store each Context by name
		var _contexts = {},
				// get a reference to the global object.  this would be "window"
				// in a browser, but isn't named in Fireworks.
			_global = (function() { return this; })(),
				// we have to keep track of the currentScriptDir when we're first loaded
				// because it will be empty the first time context() is called after
				// we're first loaded.  the code that's calling us is in the directory
				// above the /lib/
			_initialContextPath = fw.currentScriptDir,
			_initialCallerPath = Files.getDirectory(fw.currentScriptDir),
			_initialScriptFilename = fw.currentScriptFileName,
				// this module global stores the requested Context path 
				// while the Context code is loaded, so we know what to call it
				// when it calls registerContext()
			_currentContextPath = "";


		// ===================================================================
		var dispatchRequire = _global.require = function dispatchRequire(
			inConfig)
		{
				// if currentScriptDir is null, it means this is the first context()
				// call after we were loaded via runScript, so fall back to the
				// _initialCallerPath we stored above
			var callerPath = fw.currentScriptDir || _initialCallerPath,
					// if there's a currentScriptDir, then that means the 
					// context has already been set up, so we don't know where
					// the fwrequire.js file is located relative to the calling
					// file.  so assume it's in a lib subfolder. 
				contextPath = fw.currentScriptDir ? path(fw.currentScriptDir, "lib/") : 
					_initialContextPath,
				context;

				// make sure inConfig is an object but not an array 
			if (inConfig && typeof inConfig == "object" && !(inConfig instanceof Array)) {
				if (inConfig.baseUrl) {
						// use the config's baseUrl as the path to the Context
						// code, and make sure it's absolute
					contextPath = inConfig.baseUrl;

					if (contextPath.indexOf("file://") != 0) {
						contextPath = path(callerPath, contextPath);
					}
				}
			}
			
				// make sure the contextPath ends in a / and unescape it, to
				// ensure that paths match regardless of whether they're passed
				// in escaped or not
			contextPath = unescape(path(contextPath, ""));
			context = _contexts[contextPath];

			if (!context) {
					// call the file at this path that instantiates the Context.
					// by default, that's fwrequire.js, but a .jsf can set the
					// baseFilename property before calling require() to specify
					// a different filename for that context.  we'll default to
					// this file's actual filename.
				var contextJSPath = path(contextPath, 
					dispatchRequire.baseFilename || _initialScriptFilename);

				if (Files.exists(contextJSPath)) {
						// save the current contextPath, which we'll use when the
						// Context calls registerContext after we run its JS
					_currentContextPath = contextPath;
					fw.runScript(contextJSPath);
					
						// the context should now be registered
					context = _contexts[contextPath];
					_currentContextPath = "";
					
						// add information about the caller to the context
					context.path = contextPath;
					context.currentScriptDir = callerPath;
				}
			}

				// delete the baseFilename so that it doesn't affect the
				// next context we set up, unless that one also sets the
				// property before calling require().  delete it outside the if
				// block because another .jsf file in the same context might 
				// define baseFilename again, but since the context already 
				// exists, we would skip the if block.
			delete dispatchRequire.baseFilename;

			if (context) {
					// dispatch the execute call to the Context instance for the 
					// requested path
				context.execute.apply(context, arguments);
			} else {
				alert(unescape(contextJSPath).quote() + " could not be found.");
			}
		};


		dispatchRequire.version = 0.1;
		dispatchRequire.path = unescape(_initialContextPath);


		// ===================================================================
		dispatchRequire.getContextPaths = function getContextPaths()
		{
			var paths = [];

			for (var path in _contexts) {
				paths.push(path);
			}

			return paths;
		};


		// ===================================================================
		dispatchRequire.getContext = function getContext(
			inPath)
		{
			return _contexts[inPath];
		};


		// ===================================================================
		dispatchRequire.registerContext = function registerContext(
			inContext)
		{
				// if _currentContextPath is falsy, we must not be in the middle 
				// of calling runScript on a Context, so ignore this call 
			if (_currentContextPath) {
				_contexts[_currentContextPath] = inContext;
			}
		};


		// ===================================================================
		dispatchRequire.destroyContext = function destroyContext(
			inPath)
		{
			var context = _contexts[inPath];

			if (context) {
				context.destroy();
				delete _contexts[inPath];
			}
		};


		// ===================================================================
		dispatchRequire.destroyAll = function destroyAll()
		{
			for (var path in _contexts) {
				this.destroyContext(path);
			}
		};


		return dispatchRequire;
	}


	// =======================================================================
	function setupContext() 
	{
			// get a reference to the global object.  this would be "window"
			// in a browser, but isn't named in Fireworks.
		var _global = (function() { return this; })();


		// ===================================================================
		function Context()
		{
				// these are the globals that belong to the context and will 
				// be saved after the context execution exits
			this.globals = {};

				// these are the globals that are being overridden by the current
				// execution of the context
			this.preservedGlobals = {};

				// this is a stack of previously preserved globals, so that we can
				// support nested contexts 
			this.preservedGlobalsStack = [];
		}


		// ===================================================================
		Context.prototype = {
			version: 0.1,
			name: "",
			path: "",
			loadedRequire: false,
			
			
			destroy: function destroy()
			{
				if (this.require) {
					delete this.require.attach;
				}

					// make double-sure that references to the stored globals are broken
				this.globals = null;
				this.preservedGlobals = null;
			},


			// ===============================================================
			execute: function execute(
				inConfig,
				inDependencies,
				inCallback)
			{
					// adjust the optional parameters 
				if (typeof inConfig == "function") {
					inCallback = inConfig;
					inDependencies = [];
					inConfig = {};
				} else if (inConfig instanceof Array || typeof inConfig == "string") {
					inCallback = inDependencies;
					inDependencies = inConfig;
					inConfig = {};
				} 
				
				if (typeof inDependencies == "function") {
					inCallback = inDependencies;
					inDependencies = [];
				}

					// before executing the callback, restore our previously 
					// saved globals
				this.restoreGlobals();

				if (!this.loadedRequire) {
						// we've never been executed before, so load the require library
						// before the callback is called, since it will expect that 
						// require is already loaded
					this.loadRequire();
				}

					// the Context name is derived from its path, which can be
					// different than the name passed in via config.context 
					// by the caller.  this is because there's only ever one
					// Context instance at this path, while require may manage
					// additional sub-contexts.
				this.name = this.prettifyPath(this.path);
				inConfig.baseUrl = this.path;
				inConfig.context = inConfig.context || this.name;

					// we can't call this "name", because require.name is the 
					// name of the require function and is read-only, and there's
					// already a contextName property on the function, since 
					// that's a local var of require().  to avoid confusion, use
					// these names.
				require.currentContextName = inConfig.context;
				require.currentContextPath = inConfig.baseUrl;
				
					// if fwrequire.js was loaded by the caller, then after the
					// runScript line, fw.currentScriptDir will be null.  the
					// dispatchRequire function stored the caller's original 
					// path, so store that on require so that the module doesn't
					// have to save off its path before calling runScript.
				require.currentScriptDir = this.currentScriptDir;

				try {
						// call this context's instance of the require global, which
						// should be loaded or restored by now 
					var result = require(inConfig, inDependencies, inCallback);
				} catch (exception) {
					if (exception.lineNumber) {
						alert(["Error in context: " + this.name.quote(), exception.message,
							exception.lineNumber, exception.fileName].join("\n"));
					} else {
							// there's no error info on the exception, so show an
							// alert that there was an error in this context, then
							// throw the exception to let FW display a more 
							// meaningful error message
						alert("Error in context: " + this.name.quote());
						throw exception;
					}
				}

					// save the current values of our globals, which will also 
					// restore their previously preserved values
				this.saveGlobals();

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
					require.call;
				} catch (exception) { 
						// the require library must not be installed 
					alert(["Error in context:", this.name.quote() + 
						":", "require.js was not found in", this.path].join(" "));
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
			},


			// ===============================================================
			prettifyPath: function prettifyPath(
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
		}; // end of Context.prototype


			// register our Context instance with the dispatchRequire global
		if (typeof require == "function") {
			require.registerContext(new Context());
		}
	}


	try { 
		if (typeof require != "function") {
				// the global context function hasn't been set up yet
			setupDispatcher();
		} else {
				// there's already a global context dispatcher, so just 
				// define the manager for the current path
			setupContext();
		}
	} catch (exception) {
		if (exception.lineNumber) {
			alert([exception, exception.lineNumber, exception.fileName].join("\n"));
		} else {
			throw exception;
		}
	}
})(); 
