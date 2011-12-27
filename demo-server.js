var connect = require('connect');
var YJ = require('./YJunction.js');

// A quick 'n' dirty server to serve the web page demo

connect(
	connect.static(__dirname)
).listen(8000);

// A server-side example

YJ.when(['windowload'])
.then(function(ev) {
	var self = this;
	// run two web services called in parallel
	/*

	request({
		url: "http://example.org/ws/wifiHotspots"
	}, function(err, res) {
		self.emit('hotspots', res.body);
	});
	request.ajax({
		url: "http://example.org/ws/powerpoints"
	}, function(err, res) {
		self.emit('powerpoints', res.body);
	});
	
	*/

	// let's just simulate this.
	setTimeout(function() {
		self.emit('hotspots', [{address: "1"}, {address: "2"}, {address: "3"}]);
	}, 800);
	setTimeout(function() {
		self.emit('powerpoints', [{address: "1"}, {address: "3"}, {address: "4"}]);
	}, 1200);
	this.emit('date', new Date(ev.timeStamp));
	})

	// Data composition

	YJ.when(['hotspots', 'powerpoints'])
	.then(function(hotspots, powerpoints) {
		var hotspotsWithPowerpoints = hotspots.filter(function(hotspot) {
			return powerpoints.some(function(powerpoint) {
				return hotspot.address == powerpoint.address;
			});
		});

		this.emit('workplaces', hotspotsWithPowerpoints);
	});

	// Data consumption

	YJ.when(['workplaces', 'date'])
	.then(function(workplaces, date) {
		var start = new Date(date);
		console.log("Workplaces on " + date.toDateString());

		workplaces.forEach(function(workplace) {
			console.log("You can work here: " + workplace.address);
		});
		this.next(new Date().valueOf() - start.valueOf());
	},
	function(workplaces, date, speed) {
		console.log("rendering took " + speed + "ms");
	});

	YJ.emit('windowload', {timeStamp: new Date().valueOf()})
