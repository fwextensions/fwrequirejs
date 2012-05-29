// ===========================================================================
doh.fw.registerRequireFixture(function(t) {
	t.t(function() { return require.getContextPaths().length == 1 });
});
