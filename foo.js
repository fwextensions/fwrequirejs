/* ===========================================================================
	
	File: FlickrFire

	Author - John Dunning
	Copyright - 2010 John Dunning.  All rights reserved.
	Email - fw@johndunning.com
	Website - http://johndunning.com/fireworks

	Release - 0.1.0 ($Revision: 1.4 $)
	Last update - $Date: 2010/09/19 02:11:04 $

   ======================================================================== */


/*
	Todo:
	Done:
		- after uploading, copy the URL to the image to the clipboard

		- show the flickr account name in the dialog
			store user's info in prefs?  do does it all come back with check token?

		- making a private image doesn't seem to work

		- make flickr a dojo lib 
*/


// ===========================================================================
//  Main
// ===========================================================================

log("=================== foo.js");

	// make sure that the dojo module framework is loaded.  the module.call
	// expression will throw an exception if it's not, which will then run
	// lib/module.js, which will load the needed files.
try { context.call; } catch (e) 
	{ fw.runScript(fw.currentScriptDir + "/context.js"); }

//context("FOO", function()
//{
//log("========== in foo outer context");	

	define([
		"moment"
	], function(
		moment)
	{
log("======= defining foo");		
		return {
			bar: function(msg) { log(msg, "===== in foo.bar", moment(new Date()).format("L LT")) }
		};
	});
//});
