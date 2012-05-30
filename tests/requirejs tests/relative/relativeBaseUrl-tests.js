//Use a property on require so if the test runs in node, it is visible.
//Remove it when done with the test.
//require.relativeBaseUrlCounter = 0;

require({
        baseUrl: require.isBrowser ? "./" : "./relative/"
    },
    ["./top", "top"],
    function(top1, top2) {
        doh.register(
            "relativeBaseUrl",
            [
                function relativeBaseUrl(t){
                    t.is(top1.id, top2.id);
// we can't use require.relativeBaseUrlCounter because setting it while outside of
// this require call will put the property on the global dispatcher, not the
// actual require function, which is what it's testing here
//                    t.is(1, require.relativeBaseUrlCounter);

//                    delete require.relativeBaseUrlCounter;
                }
            ]
        );

        doh.run();
    }
);
