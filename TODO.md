# To do:

- need better error handling when a module can't be found
	alert with the paths that were searched
	having a module define a name for itself and then move the module
		to a different folder has poor error message 

- maybe provide require.config() call that sets up the configuration 
	for dispatchRequire

- should be able to call runScript from a script within /lib to load this file and have it 
	default to the current /lib directory as the baseUrl

- should Context be a singleton?

- do we still need the preservedGlobalsStack?

- set up proper unit tests, maybe with vows.js or jasmine

- run through jslint

- put _global on Context prototype

- show error if a module path starts with http://

- add require.get to support synchronous module loading 

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

- throw error if addManager wasn't called? 


# Done:

- we probably don't need the dummy log if there's only one log call

- trace doesn't work inside context()

- take the baseFilename from the initial script filename

- store the original path to fwrequire.js on dispatchRequire

- maybe unescape caller paths so they're normalized

- store the caller's currentScriptDir on context, separate from current
	context path 

- combine manager and Context into a singleton

- does the manager need to manage individual contexts? 
	or should require do it? 
	the manager and the context could be combined then

- should pass all the params to the context, so it can decide how to 
	use them

- maybe always pass a config into require, using the context's name
	and path as the default vaules 

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
