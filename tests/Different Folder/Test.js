// ===========================================================================
doh.fw.registerRequireFixture(
		// this test loads fwrequire from a folder called resources
	"resources",
	function(t) {
		t.t(function() { return require.getContextPaths().length == 1 });
		t.t(function() { return require.getContext(require.getContextPaths()[0]).requirePath.indexOf("resources") > 0 });
	}
);
