// ===========================================================================
doh.fw.registerRequireFixture(function(t) {
		// even though we called require a few times in the test, they were all
		// from the same context path, so there should be only one context
	t.t(function() { return require.getContextPaths().length == 1 });
	
		// make sure require created a context named "baz"
	t.t(function() { return require.getContext(require.getContextPaths()[0]).require.s.contexts.baz });
});
