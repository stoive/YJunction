var connect = require('connect');
var YJ = require('./YJunction.js');

connect(
	connect.static(__dirname, { /*maxAge: 1000 * 60 * 5*/ })
).listen(8000);


			YJ.when(['windowload'])
			.then(function(ev) {
				var self = this;
				// run two web services called in parallel
				/*$.ajax({
					url: "http://example.org/ws/wifiHotspots",
					success: function(hotspots) { self.emit('hotspots', hotspots) }
				});
				$.ajax({
					url: "http://example.org/ws/powerpoints",
					success: function(powerpoints) { self.emit('powerpoints', powerpoints) }
				});*/

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
				//var h1 = document.createElement('h1');
				/*h1.innerText = */ console.log("Workplaces on " + date.toDateString());
				//document.body.appendChild(h1);

				workplaces.forEach(function(workplace) {
					//var p = document.createElement('p');
					/*p.innerText = */ console.log("You can work here: " + workplace.address);
					//document.body.appendChild(p);
				});
				this.next(new Date().valueOf() - start.valueOf());
			})
			.then(function(workplaces, date, speed) {
				console.log("rendering took " + speed + "ms");
			});

			YJ.emit('windowload', {timeStamp: new Date().valueOf()})
