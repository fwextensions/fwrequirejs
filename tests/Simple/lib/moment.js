// create a fake moment.js library so we don't have to include the whole thing
// multiple times
define(function() {
	return function(
		inDate)
	{
		return {
			format: function()
			{
				return new Date().toLocaleString();
			}
		};
	};
});