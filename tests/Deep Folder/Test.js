// ===========================================================================
doh.fw.registerRequireFixture(
	"scripts/lib",
	function(t) {
		t.t(function() { return require.getContextPaths().length == 1 });
	}
);
