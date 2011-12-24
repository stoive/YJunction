var connect = require('connect');

connect(
	connect.static(__dirname + '/web/', { /*maxAge: 1000 * 60 * 5*/ })
).listen(8000);
