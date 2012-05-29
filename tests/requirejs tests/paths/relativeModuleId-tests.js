(function() {

var currentScriptDir = fw.currentScriptDir + "/",
	requirePath = currentScriptDir + "../../../lib/";

try { require.call; } catch (e) 
	{ fw.runScript(requirePath + "fwrequire.js"); }

require({
		baseUrl: currentScriptDir, 
		requirePath: requirePath,
//        baseUrl: "./",
        paths: {
            "array": "impl/array"
        }
    },
    ["require", "array"],
    function(require, array) {
        doh.register(
            "relativeModuleId",
            [
                function relativeModuleId(t){
                    t.is("impl/array", array.name);
                    t.is("util", array.utilName);
                }
            ]
        );

        doh.run();
    }
);

})();
