// ===========================================================================
doh.fw.registerRequireFixture(
		// pass a bogus directory name to prevent the require.js and fwrequire.js
		// files from being copied 
	"asdf",
	function(t) {
		t.t(function() { return require.getContextPaths().length == 1 });
	}
);
