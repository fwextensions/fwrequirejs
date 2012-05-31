// ===========================================================================
define([
	"moment",
], function (
	moment)
{
	return {
		bar: function bar(msg) 
		{ 
			return msg + " from foo.bar at " + moment(new Date()).format("L LT");
		}
	};
});
