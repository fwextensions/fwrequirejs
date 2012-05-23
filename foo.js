

define(function FOO(require)
{
//log("======= defining foo");		

	var moment = require("dojo/moment");
	
	return {
		bar: function bar(msg) { log(msg, "===== in foo.bar", moment(new Date()).format("L LT")) }
	};
});
