/* ===========================================================================

	fwrequire.js

	Copyright 2012 John Dunning.  
	fw@johndunning.com
	http://johndunning.com/fireworks

	fwrequire.js is released under the MIT license.  See the LICENSE file 
	for details.

	Documentation is availalbe at https://github.com/fwextensions/fwrequirejs

   ======================================================================== */


/*
	fwrequire.js manages the loading of multiple require.js files, so that 
	different versions of both fwrequire.js and require.js can co-exist in the
	same global scope.  fwrequire.js is basically two scripts in one.  Whichever
	.jsf file runs first will load its fwrequire.js file, and the setupDispatcher
	function will be called, since there's no global require at that point.

	When require() is called subsequently, the dispatcher looks to see if it has 
	a Context object at the path of the .jsf file calling require().  If not, it 
	looks for fwrequire.js at that path and runs it, which will cause that file's
	setupContext() function to be called.  That way, each path gets its own 
	Context object that manages its own copy of require.js.

	Assuming the following file structure:

		Commands/
			Extension 1/
				lib/
					fwrequire.js
					require.js
				Command A.jsf
				Command B.jsf
			Extension 2/
				lib/
					fwrequire.js
					require.js
				Command C.jsf
				Command D.jsf

	- The user runs Extension 2/Command C.jsf
	- fw.currentScriptDir is Extension 2/
	- The global require is undefined, so Command C runs lib/fwrequire.js
	- fw.currentScriptDir is now Extension 2/lib/
	- _initialContextPath is set to the parent directory of fw.currentScriptDir,
	  which is Extension 2/
	- setupDispatcher() runs and creates the global require()
	- require() is called from within Command C.jsf
	- fw.currentScriptDir is null, so contextPath defaults to _initialContextPath
	- requirePath and fwrequirePath default to _initialContextPath/lib
	- Extension 2/lib/fwrequire.js is run and calls setupContext()
	- The Context registers with dispatchRequire and is told its path is 
	  Extension 2/ and the requirePath is Extension 2/lib/
	- The Context sets up a config of { baseUrl: "lib" } and then runs 
	  Extension 2/lib/require.js
	- The Context dispatches the require call to the require() created by 
	  Extension 2/lib/require.js, and the real require does its magic
	- The Context saves off the "real" require global and restores the require
	  function created by setupDispatcher()
	- The user runs Extension 1/Command A.jsf
	- The global require is already defined, so Command A doesn't run lib/require.js
	- fw.currentScriptDir is Extension 1/
	- The global dispatchRequire looks for a context at Extension 1/ and doesn't
	  find one
	- requirePath defaults to Extension 1/lib
	- Extension 1/lib/require.js is run and calls its own setupContext(), but 
	  not setupDispatcher(), since the global require is already defined
	- The Context registers with dispatchRequire and is told its path is 
	  Extension 1/ and the requirePath is Extension 1/lib/
	- The Context sets up a config of { baseUrl: "lib" } and then runs 
	  Extension 1/lib/require.js
	- The Context dispatches the require call to the require() created by 
	  Extension 1/lib/require.js, and the real require does its magic
	- The Context saves off the "real" require global and restores the require
	  function created by setupDispatcher() in Extension 2/lib/fwrequire.js
*/


// ===========================================================================
(function fwRequireSetup() {
	function path()
	{
			// make sure we have a string, in case null or undefined is passed
		var path = arguments[0] + "";

		for (var i = 1; i < arguments.length; i++) {
			var lastChar = path.slice(-1),
					// force nextArgument to be a string
				nextArgument = arguments[i] + "";

				// make sure there is exactly one / between each argument
			if (lastChar != "/" && nextArgument[0] != "/") {
				path += "/";
			}

			path += arguments[i];
		}

		return path;
	}


		// get a reference to the global object.  this would be "window"
		// in a browser, but isn't named in Fireworks.
	var _global = (function() { return this; })();
	

	// =======================================================================
	function setupDispatcher() 
	{
			// a hash to store each Context by name
		var _contexts = {},
				// we have to keep track of the currentScriptDir when we're first 
				// loaded because it will be empty on the next call to require().
				// we assume the code that's calling us is in the directory above 
				// where we're being called.
			_initialContextPath = Files.getDirectory(fw.currentScriptDir),
				// this module global stores the requested Context path info
				// while the Context code is loaded, and is returned to the
				// Context when it calls registerContext()
			_newContextInfo;


		// ===================================================================
		var dispatchRequire = _global.require = _global.define = function dispatchRequire(
			inConfig)
		{
				// if there's a currentScriptDir, then that means the context
				// has already been set up, so assume we're being called from
				// the directory above the baseUrl.  otherwise, default to
				// _initialContextPath.
			var contextPath = fw.currentScriptDir || _initialContextPath,
					// by default, assume require.js and fwrequire.js are in a
					// lib folder under the context folder
				requirePath = path(contextPath, "lib/"),
				fwrequirePath = requirePath,
				context;

			if (inConfig) {
				if (inConfig.baseUrl) {
						// use the config's baseUrl as the path to the Context
						// and require files
					fwrequirePath = requirePath = inConfig.baseUrl;
				}
				
				if (inConfig.contextPath) {
					contextPath = inConfig.contextPath;
					
						// don't pass this to the real require()
					delete inConfig.contextPath;
				}
				
				if (inConfig.requirePath) {
						// also default fwrequirePath to requirePath, in case
						// fwrequirePath isn't set separately
					fwrequirePath = requirePath = inConfig.requirePath;
					
					if (requirePath.slice(-3) == ".js") {
							// a path directly to the require.js file was passed
							// in, so fwrequirePath should default to that file's
							// directory, not the require.js file itself
						fwrequirePath = Files.getDirectory(requirePath);
					}
					
						// don't pass this to the real require()
					delete inConfig.requirePath;
				}
				
				if (inConfig.fwrequirePath) {
					fwrequirePath = inConfig.fwrequirePath;
					
						// don't pass this to the real require()
					delete inConfig.fwrequirePath;
				}
			}
			
				// make sure the contextPath ends in a / and unescape it, to
				// ensure that paths match regardless of whether they're passed
				// in escaped or not.  use that as a key to the context object.
			contextPath = unescape(path(contextPath, ""));
			context = _contexts[contextPath];

			if (!context) {
					// call the file at this path that instantiates the Context.
					// by default, that's fwrequire.js, but a .jsf can pass
					// a fwrequirePath property to specify a different filename 
					// for that context.  
				if (fwrequirePath.slice(-3) != ".js") {
					fwrequirePath = path(fwrequirePath, "fwrequire.js");
				}
				
				if (fwrequirePath.indexOf("file://") != 0) {
						// it's a relative path, so make it relative to the context
					fwrequirePath = path(contextPath, fwrequirePath);
				}

				if (Files.exists(fwrequirePath)) {
						// save the current contextPath and requirePath, which 
						// we'll return to the new Context when it calls 
						// registerContext after we run its JS file
					_newContextInfo = {
						path: contextPath,
						requirePath: requirePath
					};
					fw.runScript(fwrequirePath);
					
						// the context should now be registered
					context = _contexts[contextPath];
					_newContextInfo = null;
				}
			}

			if (context) {
					// dispatch the execute call to the Context instance for the 
					// requested path
				return context.execute.apply(context, arguments);
			} else {
				alert("FWRrequireJS error:\nFile could not be found: " + unescape(fwrequirePath));
			}
		};


		dispatchRequire.version = 0.1;
		
			// remember the path to the file that instantiated us
		dispatchRequire.path = unescape(fw.currentScriptDir);
		
			// add these to match RequireJS, in case there's code that wants to
			// inspect them before calling require()
		dispatchRequire.amd = {
			multiversion: true,
			plugins: true,
			jQuery: true
		};
		dispatchRequire.isAsync = dispatchRequire.isBrowser = false;


		// ===================================================================
		dispatchRequire.config = function config(
			inConfig)
		{
			return dispatchRequire(inConfig);
		}


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
			if (_newContextInfo) {
				_contexts[_newContextInfo.path] = inContext;
				
					// return the path info to our caller so it can update the
					// context with it
				return _newContextInfo;
			} else {
					// if _newContextInfo is null, we must not be in the middle 
					// of calling runScript on a Context, so ignore this call 
				return null;
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
		// ===================================================================
		var Context = {
			version: 0.1,
				// these are the globals that belong to the context and will 
				// be saved after the context execution exits
			globals: {},
				// these are the globals that are being overridden by the current
				// execution of the context
			preservedGlobals: {},
				// this is a stack of previously preserved globals, so that we can
				// support nested contexts 
			preservedGlobalsStack: [],
			name: "",
			path: "",
			requirePath: "",
			loadedRequire: false,
			
			
			// ===============================================================
			init: function init(
				inRequire)
			{
				if (typeof inRequire == "function") {
						// we assume the right kind of require is loaded and that it
						// has a registerContext method.  if not, the try/catch below
						// should catch the exception and show a reasonable error.
					var config = inRequire.registerContext(this);

						// registerContext returns useful path information about 
						// this context
					this.config(config);
				}
			},
			
			
			// ===============================================================
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
			config: function config(
				inConfig)
			{
				this.path = inConfig.path;
				
					// the Context name is derived from its path, which can be
					// different than the name passed in via config.context 
					// by the caller.  this is because there's only ever one
					// Context instance at this path, while require may manage
					// additional sub-contexts.
				this.name = this.prettifyPath(this.path);
				this.requirePath = inConfig.requirePath || (path(this.path, "require.js"));

				if (this.requirePath.indexOf("file://") != 0) {
						// make sure this is an absolute path
					this.requirePath = path(this.path, this.requirePath);
				}

				if (this.requirePath.slice(-3) != ".js") {
						// we only got the path to the folder containing the 
						// file, so add the default file name
					this.requirePath = path(this.requirePath, "require.js");
				}
			},


			// ===============================================================
			execute: function execute(
				inConfig)
			{
					// before executing the callback, restore our previously 
					// saved globals
				this.restoreGlobals();

				if (!this.loadedRequire) {
						// we've never been executed before, so load the require 
						// library before the callback is called
					this.loadRequire(inConfig);
				}

				require.currentContextPath = inConfig ? inConfig.baseUrl : this.path;
				require.currentContextName = inConfig ? inConfig.context : this.name;
				
				if (inConfig.context && !inConfig.baseUrl) {
						// a context name was passed in, but no baseUrl, which 
						// means require will create a new context and default
						// its baseUrl to ./.  but we want the default to be lib/.
					inConfig.baseUrl = "lib";
				}

				try {
						// call this context's instance of the require global, which
						// should be loaded or restored by now 
					var result = require.apply(_global, arguments);
				} catch (exception) {
					if (exception.lineNumber) {
						alert(["FWRrequireJS error in context: " + this.name.quote(), exception.message,
							exception.lineNumber, exception.fileName].join("\n"));
					} else {
							// there's no error info on the exception, so show an
							// alert that there was an error in this context, then
							// throw the exception to let FW display a more 
							// meaningful error message
						alert("FWRrequireJS error in context: " + this.name.quote());
						throw exception;
					}
				}

					// save the current values of our globals, which will also 
					// restore their previously preserved values
				this.saveGlobals();

				return result;
			},


			// ===============================================================
			loadRequire: function loadRequire(
				inConfig)
			{
					// these are the three globals that require() creates.  
					// loading them now won't restore any previous value (since 
					// this is the first time we're loading require), but it 
					// ensures that they'll be saved when we're done executing.
				this.loadGlobal("define");
				this.loadGlobal("require");
				this.loadGlobal("requirejs");
				
					// use the baseUrl from inConfig, if any, or default to lib
					// for the baseUrl for this instance of require, which will
					// read this global config object when it loads.  this 
					// probably isn't strictly necessary, since a non-lib baseUrl
					// should almost always be passedin via a config object on
					// each require call.
				require = {
					baseUrl: (inConfig && inConfig.context && inConfig.baseUrl) || "lib"
				};

					// now instantiate the require library at the path and 
					// filename passed to us from dispatchRequire
				fw.runScript(this.requirePath);

				if (typeof require != "function") {
						// the require library must not be installed 
					alert(["FWRrequireJS error in context: " + this.name.quote(), 
						"require.js was not found in " + this.path].join("\n"));
					return;
				}

					// create a reference to our path for the attach method
				var libPath = this.path;

					// override the attach method on require to use a synchronous
					// runScript call to load the module 
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
					
					if (Files.exists(url)) {
						fw.runScript(url);
						context.completeLoad(moduleName);
					}
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
				return unescape(inPath.replace(unescape(fw.appJsCommandsDir), "")
					.replace(unescape(fw.userJsCommandsDir), "USER"));
			}
		}; // end of Context

			// tell the Context to register with the global dispatcher 
		Context.init(require);
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
