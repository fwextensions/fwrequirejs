# FWRequireJS: AMD-style modules in Adobe Fireworks

As browser-based applications have become more complex, JavaScript developers have worked out various approaches to including multiple modules on the page without polluting the global namespace.  Complex Adobe Fireworks extensions can benefit from similar solutions, and I’ve tried a few different approaches in the past.  What FWRequireJS offers is [James Burke’s][6] excellent, battle-tested [RequireJS][1] module loader along with some additional infrastructure that permits it to work in the Fireworks JS environment.

The RequireJS site offers more information about the [Asynchronous Module Definition][2] standard and why it’s useful. 


## Installing FWRequireJS

If you use git, you can just clone the [FWRequireJS GitHub repository][4].  If not, you can download a [.zip file][5] containing all of the files.

Once you have the repository, there are only two files you need from it: `fwrequire.js` and `require.js`.  `require.js` is an unmodified copy of the 2.0.0 release of [RequireJS][3].  `fwrequire.js` wraps up the RequireJS code and enables it to run within Fireworks. 


## Using FWRequireJS

A Fireworks extension will typically contain a number of .jsf files that provide related functionality.  Perhaps you’re writing an extension that exports the currently selected elements, and you want to have one command in the *Commands* menu that exports the elements on a transparent background, one that exports them on white, one that exports them on black, etc.  

You might find yourself copying the same code to each of those .jsf files and just tweaking it slightly to change, say, the background color value.  But a better approach would be to separate out the common code into a module that can then be loaded by the .jsf files.  That way, you can modify your library in just one place, rather than having to copy changes to each .jsf file.

Let’s say the directory containing your extension files looks like this:

	Commands/
		My Export Commands/
			Export Selection on Black.jsf
			Export Selection on Transparent.jsf
			Export Selection on White.jsf

To add FWRequireJS support, create a `lib/` sub-directory, and put the `require.js` and 	`fwrequire.js` files in it.  You can also create an `export.js` file there that will hold your reusable module code.  The directory should now look like this:

	Commands/
		My Export Commands/
			lib/
				fwrequire.js
				require.js
				export.js
			Export Selection on Black.jsf
			Export Selection on Transparent.jsf
			Export Selection on White.jsf


## Defining modules

Now that the files are set up, you can create a module using the global `define()` function.  This global is instantiated by some boilerplate code in the .jsf files, which we’ll cover later.  For now, we can assume the FWRequireJS library has been loaded and `define()` is ready to be used.

The `define()` call can take a number of parameters, but in its simplest form, you just pass it a function.  The return value of that function should be the module that is defined by the .js file.  Each .js file should define only one module.  

Your `export.js` file may look something like this:

	define(function() {
			// vars and functions that are local to the module 
			// can be defined here

			// the function returns an object containing the public
			// methods implemented by the module
		return {
			exportSelection: function(backgroundColor)
			{
				...
			}
		};
	});	

The `exportSelection()` method will be called from the .jsf files to do the actual exporting, and each file can pass in a different `backgroundColor` parameter.  See the RequireJS site for [more examples][7] of defining modules.


## Requiring modules

The .jsf file gets access to the module defined in `export.js` by calling a global `require()` function.  Before it can do so, however, it must make sure the FWRequireJS library is loaded.  To do this, you must include a couple lines of boilerplate code at the beginning of every .jsf file that makes use of the FWRequireJS library:

	if (typeof require != "function" || !require.amd) {
		fw.runScript(fw.currentScriptDir + "/lib/fwrequire.js"); }

This if-statement checks that there’s a global function called `require` and that it has an `amd` property.  If neither of these is true, then it loads `fwrequire.js` in a `lib/` sub-directory, which will, in turn, load `require.js` from the same directory.  By supplying some configuration settings, you can store the files in a different directory, but FWRequireJS will look in `lib/` by default.

Why does *every* .jsf file that uses FWRequireJS need this code?  Why can’t you just load it in the first one?  Well, unlike a webpage, you have no way of controlling which .jsf files are run or in which order.  That’s up to the user interacting with the *Commands* menu in Fireworks.  So *any* .jsf file might be the first to be run, and therefore *every* file that uses it has to check for, and possibly load, FWRequireJS.  See the [Multi-multi-version support](#multi-multi-version-support) section for more details.

Once the FWRequireJS library has been loaded, requiring a module is straightforward: 

	require([
		"export"
	], function(
		exportModule)
	{
		exportModule.exportSelection("#000000");
	});

The first parameter to `require()` is usually an array of one or more strings that name the modules that this file depends on.  Once those modules have been loaded, the second parameter to `require()` will be called back with references to them.

The module names in the dependencies array are mapped to file paths that are relative to a base directory.  By default, this is the directory from which `fwrequire.js` was loaded, but it can be changed via configuration options.  In the example above, the `"export"` module would be loaded from `lib/export.js`.  If you have a module located in a sub-directory of `lib/`, like `files.js` in this example:

	Commands/
		My Export Commands/
			lib/
				fwrequire.js
				require.js
				export.js
				utils/
					files.js
			Export Selection on Black.jsf
			...

then that module can be loaded with code that looks like this:

	require([
		"export",
		"utils/files"
	], function(
		exportModule,
		files)
	{
		exportModule.exportSelection("#000000", files.getName());
	});

Just remember that module paths are relative to the directory from which you loaded `fwrequire.js`, *not* the directory containing the .jsf file that’s using `require()`.  This root directory can be changed via the `baseUrl` property of a configuration object passed to `require()`.  See the [configuration](#configuring-fwrequirejs) section for details. 

There are two exceptions to this module-naming scheme.  If the module name ends in “.js”, then the path will be treated relative to the .jsf file that is using FWRequireJS.  Also, if you use a module path that starts with `file://`, then the file at that absolute location is loaded.

The name of the parameter that’s mapped to the loaded library can be whatever you like, and doesn’t have to be exactly the same as the module file name.  In the example above, the `export` module is called `exportModule` in the callback function, since `export` is a reserved word in Fireworks JavaScript.  Just make sure that the order of the parameters is exactly the same as the order of strings in the dependencies array.  

Module filenames should end in .js, not .jsf, because you don’t want them to show up in the *Commands* menu.  These files provide functionality to.jsf files, not to the end-user.

Note that although the AMD specification has “asynchronous” right there in the name, files are always loaded synchronously in the Fireworks environment.  And since Fireworks doesn’t support any HTTP request functionality, all modules must be loaded from local files.


## Configuring FWRequireJS

As described above, the default behavior of FWRequireJS is to use the directory of the script that called it as the root directory and to load the `fwrequire.js` and `require.js` files from a `lib/` sub-directory.  These default paths can be changed by passing a configuration object as the first parameter to `require()`.  The configuration object supports a number of different options: 

`baseUrl`: The path to the root directory from which modules will be loaded.  This defaults to `lib/` under the directory of the .jsf file calling `require()`.  If you want to use a different directory, e.g., `scripts/’ in this example:

	Commands/
		My Export Commands/
			scripts/
				fwrequire.js
				require.js
				export.js
			Export Selection on Black.jsf
			...

then you can specify the relative path to that directory via the `baseUrl` property:

	require({ baseUrl: "scripts" }, [
		"export"
	], function(
		exportModule)
	{
		exportModule.exportSelection("#000000");
	});

Note that passing a relative path works only when that directory is an immediate child of the directory containing the .jsf file.  If you want to load the modules from a sibling directory, like this:

	Commands/
		Common/
			fwrequire.js
			require.js
			export.js
		My Export Commands/
			Export Selection on Black.jsf
			...

then an absolute path can be used for the `baseUrl`:

	(function() {
	var currentScriptDir = fw.currentScriptDir,
		requirePath = fw.currentScriptDir + "/../Common/";

	if (typeof require != "function" || !require.amd) {
		fw.runScript(requirePath + "fwrequire.js"); }

	require({ baseUrl: requirePath }, [
		"export"
	], function(
		exportModule)
	{
		...
	}
	})();

Setting the `baseUrl` option tells FWRequireJS where to look for the modules, as well as the `fwrequire.js` and `require.js` files.  Note that this works only if you use the standard module-naming scheme to load modules.  If you want to load a file that ends .js, `require()` will look for it in the directory above the one containing `require.js`, which is probably not what you want.  This can be addressed with the next option.

`contextPath`: The path to the “context” in which FWRequireJS is executing and loading modules.  In the standard browser case, this would be the directory containing the webpage that loads RequireJS.  There are no webpages in Fireworks, obviously, so FWRequireJS uses the directory of the .jsf file that loaded it as the starting point for a relative path like `baseUrl`.  

The problem is that it’s not always possible for a script in Fireworks to determine where the script that’s calling it is located.  The `fw.currentScriptDir` property is set to the path of the last script to be executed via `fw.runScript()`.  The FWRequireJS `require()` function can then look at this property to guess at the directory of the script that called it.  This works in most cases, but not the first time that FWRequireJS is loaded.  The first .jsf file that needs FWRequireJS will call `runScript()` on the `fwrequire.js` file, which causes `fw.currentScriptDir` to be set to the path of `fwrequire.js`, not the calling script.  

So the first time FWRequireJS is loaded, it has to guess where the caller is located.  It assumes the `fwrequire.js` file is in an immediate sub-directory of the calling script.  But if that assumption is incorrect, you can specify a `contextPath` property to tell it where the .jsf file actually is.  The example above could be rewritten like this, which will ensure that relative paths are calculated correctly:

	(function() {
	var currentScriptDir = fw.currentScriptDir;

	if (typeof require != "function" || !require.amd) {
		fw.runScript(currentScriptDir + "/../Common/fwrequire.js"); }

	require({ baseUrl: "../Common", contextPath: currentScriptDir }, [
		"export"
	], function(
		exportModule)
	{
		...
	}
	})();

Note that this command file has to save the `fw.currentScriptDir` in a local variable before it calls `runScript()` on `fwrequire.js`.  This is due to another flaw in Fireworks’ script loading, which is that after `runScript()` returns, `fw.currentScriptDir` is set to `null`.  So by the time the call to `require()` is executed, it’s no longer possible to get the script’s path by examining `fw.currentScriptDir`.  

Since it’s a bit of a pain to have to save off `fw.currentScriptDir` in every file that uses FWRequireJS with a non-standard `baseUrl`, there’s a simpler way to specify the path to the context:

	if (typeof require != "function" || !require.amd) {
		fw.runScript(fw.currentScriptDir + "/../Common/fwrequire.js"); }

	require(function(){0()}, { baseUrl: "../Common" }, [
		"export"
	], function(
		exportModule)
	{
		...
	}

Note the funny-looking function expression passed in as the first parameter to `require()`, before the configuration object.  This is the shortest possible function that will trigger an exception when called.  

Why in the world would we want to call a deliberately buggy function?  Well, exceptions that are triggered by JavaScript errors (as opposed to Fireworks errors) have a property containing the path to the file in which the buggy code was defined, as well as the line number on which it occurs.  

By defining a function in your .jsf file and passing it to `require()`, you enable the function to figure out the path to your script.  It just needs to call the function inside a `try` block, catch the exception, and look at its `fileName` property.  Yes, it’s a kludge, but it works around an annoying limitation in the Fireworks script handling.

Another common use case for the `contextPath` option is to load a module that’s used by both .jsf commands and a [JSML panel][8].  For example, you might create a panel that has buttons for exporting the selection on different background colors.  The files in your extension might be set up like this:

	Commands/
		My Export Commands/
			lib/
				fwrequire.js
				require.js
				export.js
			Export Selection on Black.jsf
			Export Selection on Transparent.jsf
			Export Selection on White.jsf
	Command Panels/
		Export Panel.js
		Export Panel.swf

The buttons in the panel would need to call the same `exportSelection()` method that the corresponding .jsf commands do, so in the panel’s .js file you would need to load FWRequireJS, if necessary, and then require the `export` module:  

	if (typeof require != "function" || !require.amd) {
		fw.runScript(fw.appJsCommandsDir + "/My Export Commands/lib/fwrequire.js"); }

	require({ contextPath: fw.appJsCommandsDir + "/My Export Commands" }, [
		"export"
	], function(
		exportModule)
	{
		...
	}

The click handlers for the buttons could then call `exportModule.exportSelection()`.  By pointing the panel’s context to the same path as is used by the .jsf files, the `export` module will only be loaded once, and the same module is available to the code in both places, regardless of whether the user runs a .jsf command first or opens the panel first.  So setting `exportModule.foo = 42` in the panel code would make the same `foo` property available in the .jsf commands, and vice versa.

`fwrequirePath`: The path to the `fwrequire.js` file.  If this path is to a directory, then the default `fwrequire.js` file will be loaded.  You can also supply a path directly to the file that should be loaded, if you need to rename the `fwrequire.js` file for some reason.  

This option shouldn’t be necessary very often.  If you change the `baseUrl` directory, you would typically store the `fwrequire.js` and `require.js` files in that same directory.  FWRequireJS will look for its files in `baseUrl`, so specifying that path is usually sufficient for those cases where you don’t store everything in the default `lib/` sub-directory.  

The one case where this is useful is testing.  The FWRequireJS repository contains a set of unit tests, a number of which were lifted directly from RequireJS.  Those unit tests don’t each include their own copy of `fwrequire.js`, so the `fwrequirePath` configuration option lets us point them all to the `fwrequire.js` file at the root of the repository. 

Note that since changing this path means `fwrequire.js` is probably not in an immediate child of the directory containing the .jsf file that’s loading it, `fwrequirePath` should be an absolute path.  If it’s relative, you must also set `contextPath` so that FWRequireJS knows the starting directory for calculating the relative path.  You should also set `baseUrl` if the module files aren’t in the standard `lib/` sub-directory, as RequireJS won’t automatically look at `fwrequirePath` for module files. 

`requirePath`: The path to the `require.js` file.  Usually, this file will be in the same location as `fwrequire.js`, so supplying the `fwrequirePath` path is sufficient to store it in a different directory than `baseUrl`.  But if for some reason you want `fwrequire.js` and `require.js` to be in different directories, you can set the path with this option. 

The [RequireJS documentation][9] lists a number of other options that can also be used in the configuration object.  However, some of them, like `waitSeconds`, won’t make sense in the context of Fireworks. 


## Multi-multi-version support

One of the nice features of RequireJS is that it makes it easy to load different versions of the same library on the same page.  If the different versions are installed at different paths, a given call to `require()` can pick either or both versions of the library by specifying the appropriate relative path.  


### The problem 

This capability is even more crucial in an environment like Fireworks, which presents several unique problems to a module loader:

* Every script runs in a single shared global scope, and any script can stomp on any other’s globals.
* The global scope persists until the application is closed. 
* Extension developers cannot automatically load scripts when Fireworks starts up.
* Developers have no control over which extensions are installed or in which order users run them, which is very different than the challenges faced by a team building a single site with a well-defined and stable production environment.
* There is no event system or threading.  After the user runs a .jsf file from the *Commands* menu, the script simply runs to completion, possibly running other scripts along the way. 

Since developers have no way of controlling which extensions a user installs, there’s no way to guarantee which version of `require()` is loaded in the global scope.  Even among a single developer’s extensions, a user may have installed extensions `A.jsf` and `B.jsf`, where A uses RequireJS 1.0 and B uses RequireJS 2.0.  

If the user runs command A first, then the global `require()` function will be version 1.0.  If the user then runs command B, that command will be stuck with version 1.0 of RequireJS, which may not be compatible.  (In fact, version 2.0 no longer uses the `require.attach()` method that FWRequireJS initially overrode, which would break extensions that were depending on the old version.)  The reverse scenario poses the same problems.  

Of course, scripts could always check which version of `require()` is loaded and then reload their preferred version.  But if the user is going back and forth between running command A and then command B, that’s a lot of unnecessary loading and unloading.  Or a developer could package all their extensions in one big MXP file so that all of the extensions can be updated simultaneously, but if it contains more than a few extensions, that quickly becomes unwieldy for both the developer and the user.  And, of course, is multiple developers all use FWRequireJS, then their extensions may be using different versions of RequireJS, and the problem repeats itself. 


### The solution

FWRequireJS addresses this problem by essentially sandboxing each extension that uses `require()`, allowing each one to have its own copy of RequireJS.  Different extensions can then load their preferred version of RequireJS without interfering with each other.  Of course, the modules that each instance of `require()` loads will also be kept separate.  

When it’s run, FWRequireJS creates global `require()` and `define()` functions (they’re actually the same function).  This function isn’t the same `require()` that’s defined by RequireJS.  Rather, its job is to load the appropriate copy of RequireJS and delegate the call to that copy.

An example will hopefully make things a little more concrete.  Let’s say you have two extensions installed, each using slightly different versions of RequireJS, as well as different modules:

	Commands/
		Extension 1/
			lib/
				fwrequire.js
				require.js
				files.js
			Command A.jsf
			Command B.jsf
		Extension 2/
			lib/
				fwrequire.js
				require.js
				files.js
				export.js
			Command C.jsf
			Command D.jsf

After launching Fireworks, say the user runs *Command D* first.  That .jsf file checks for a global `require()`, doesn’t find it, and then runs the `fwrequire.js` in its `lib/` directory.  

After FWRequireJS is loaded, the `Command D.jsf` script calls `require()` to load the `files` and `export` modules.  This global function looks at the root directory for this command, `Commands/Extension 2/` in this case, and checks whether it already has created a context for that path.  It hasn’t, so it saves off the current values of `require` and `define`, and then runs `Commands/Extension 2/lib/fwrequire.js` (or the appropriate `fwrequirePath`, if one was passed in on a configuration object).  Loading `fwrequire.js` in turn loads `require.js`.

Just before `require.js` is loaded, the existing `require()` and `define()` globals are saved off and delete, allowing RequireJS to replace them with the actual functions.  The original `require()` function from FWRequireJS (confused yet?) is still executing, however, and after loading RequireJS it calls `require()` with the arguments it originally received.  At this point, RequireJS takes over and does its module-loading magic.

After RequireJS is done, execution switches back to FWRequireJS, which saves off the `require()` and `define()` globals and restores its original copies.  So at this point, the global `require()` points to the function defined by `Extension 2/lib/fwrequire.js`, which is keeping track of the RequireJS globals created by `Extension 2/lib/require.js`.

Now the user runs *Command A*.  The .jsf checks for a global `require()` function and finds it in this case, so it doesn’t need to run `Extension 1/lib/fwrequire.js`.  But the FWRequireJS version of `require()` sees that the call is using `Extension 1/` as the root directory, and that a context hasn’t been created for that path yet.  So it does the same thing as before: saves off the globals, runs `lib/require.js`, delegates the call to the new instance of `require()`, and then restores the globals when that call has finished.  Phew!

All of this may seem like a lot of complicated machinery just for making your code more modular.  And that’s probably true if all you’re doing is writing a few simple extensions or don’t mind creating big, monolithic scripts.  But if you start to create many extensions and want to share code between them, the FWRequireJS loader can make the process a lot more efficient. 


[1]: http://www.requirejs.org/
[2]: http://www.requirejs.org/docs/whyamd.html 
[3]: https://github.com/jrburke/requirejs
[4]: https://github.com/fwextensions/fwrequirejs
[5]: https://github.com/fwextensions/fwrequirejs/zipball/master
[6]: https://github.com/jrburke
[7]: http://www.requirejs.org/docs/api.html#define
[8]: http://johndunning.com/fireworks/about/JSMLPanel
[9]: http://www.requirejs.org/docs/api.html#config
