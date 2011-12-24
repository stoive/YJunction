var connect = require('connect');

connect(
	connect.static(__dirname, { /*maxAge: 1000 * 60 * 5*/ })
).listen(8000);
