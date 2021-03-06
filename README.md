YJunction
---------

YJunction is a JavaScript library to help you manage data dependency networks,
by inverting control over data retrieval, composition, consumption, and
synchronisation.

# What does it look like?

Here's a very simple case - wait for the page to load, launch two web service
requests, then compose them into some business entity your app needs:

	// Data retrieval
		
    YJ.when('windowload')
	.then(function(ev) {
		var self = this;
		// run two web services called in parallel
		$.ajax({
			url: "http://example.org/ws/wifiHotspots",
			success: function(hotspots) { self.emit('hotspots', hotspots) }
		});
		$.ajax({
			url: "http://example.org/ws/powerpoints",
			success: function(powerpoints) { self.emit('powerpoints', powerpoints) }
		});
		this.emit('date', new Date(ev.timeStamp));
	})

	// Data composition

	YJ.when('hotspots', 'powerpoints')
	.then(function(hotspots, powerpoints) {
		var hotspotsWithPowerpoints = hotspots.filter(function(hotspot) {
			return powerpoints.some(function(powerpoint) {
				return hotspot.address == powerpoint.address;
			});
		});

		this.emit('workplaces', hotspotsWithPowerpoints);
	});

	// Data consumption

	YJ.when('workplaces', 'date').then(
		function(workplaces, date) {
			var start = new Date(date);
			var h1 = document.createElement('h1');
			h1.innerText = "Workplaces on " + date.toDateString();
			document.body.appendChild(h1);

			workplaces.forEach(function(workplace) {
				var p = document.createElement('p');
				p.innerText = "You can work here: " + workplace.address;
				document.body.appendChild(p);
			});
			this.next(new Date().valueOf() - start.valueOf());
		},
		function(workplaces, date, speed) {
			console.log("rendering took " + speed + "ms");
		}
	);

	YJ.listen(window, 'load', 'windowload');

This implements a dependency graph of the like:

				  [AJAX hotspots]------\
				 /                      \
	[window.load]---[AJAX powerpoints]---[compose workplaces]----[render HTML]
				 \                                              /
				  [date]---------------------------------------/

# So the general gist is...?

You start by creating a 'stack' with `YJ.when`, which contains a list of dependencies
that need to be met before the functions contained in the stack (constructed by the
chain of `then`s) get called. Within each `then`, `this.emit` will register that a
new dependency has been met, and `this.next` calls the next function in the stack
(appending any values passed to the parameter list).

For example:

	// add to stack, execute in order, immediately
	YJ.do(
		function() {
			var self = this;
			// Some async call
			setTimeout(function() {
				self.emit('dependency1', "Hello");
				self.next("World");
			}, 100);
		},
		function(val) {
			// some other async call that depends on the previous one
			setTimeout(this.next, 500);
		},
		function(val) {
			self.emit('dependency2', val);
			this.emit('dependency3', "foobar");
		}
	);
	
	// add to stack, execute in order, when dependencies met
	YJ.when('dependency1', 'dependency2', 'dependency3')
	.then(
		function(dep1, dep2, dep3) {
			var self = this;
			// another async call
			setTimeout(function() {
				self.next();
			}, 600);
		},
		function(dep1, dep2, dep3) {
			var self = this;
			setTimeout(function() {
				self.next("extra val 1", "extra val 2");
			}, 400);
		},
		function(dep1, dep2, dep3, extra1, extra2) {
			console.log([dep1, dep2, dep3, extra1, extra2].join(', '));
			// "Hello, World, foobar, extra val 1, extra val 2"
		}
	);

# Huh?

You're either asking, "What on Earth are you talking about?"; or alternatively "You
don't know what you're talking about!". The former, I will attempt to allay, the
latter I will acknowledge as correct.

In today's web applications, it's often the case that a call to a web service is
made (and is returned), following which multiple other service calls are made, and
so on, all which are used to compose various new business objects to supply your app
with data. Maybe there's a couple of services which contain the same data, and you
want to run with whichever comes back first. Or maybe the data is a stream, and
updates itself periodically or upon some event - you've now got to publish the new
data across the application.

Perhaps then some composition/reduction of this data is synced to your server, and
loaded back in another session, triggering a whole new chain of web service requests.
You try to parellelise everything as much as possible, but it's just so damn hard to
think in a non-linear fashion.

That's where YJunction may be able to help.

# Hasn't [framework X] already done this?

Dunno. Has it?

More broadly, YJ has been inspired by [CommonJS Promises](http://wiki.commonjs.org/wiki/Promises), though
is not totally conformant (not that I could comprehend what passes as conformant from said
linked docs). The Promises concept has been expanded with `emit` to allow forking,
`when` to allow joining, ans `save` and `load` to allow externalisation of sync functionality.
One could potentially wrangle YJ to conform to a CommonJS Promises proposal; the interfaces
defined here aren't really set in stone yet.

# It's only a couple of hundred lines. You've hardly done anything!

I know, isn't it great!?

# Show me some examples

There's some handy extra features floating around... have a look in the demo.html file.

# Is it compatible with node.js?

Yes. Completely.

# What's the offical word on docs?

The official word is: 'sparse'.

The documentation that exists is as follows.

## Stack heads

Start your stack with these.

### when(dependencies:Array):Stack
### when(dependency, dependency, dependency, ...):Stack

- dependencies: string names of the dependencies that
				will trigger the stack when satisfied
- returns:		Stack

### do():Stack
### do(func, func, func, ...):Stack

- returns:		Stack

executes immediately, not waiting for any dependencies
at all

### load(dependency:String):Stack

- dependency:	string name of the dependency to load
- returns:		Stack

calls the `sync(dependency).load` function you have specified,
then executes the stack once loading has completed

### save(dependency:String, value:Object):Stack 

- dependency:	string name of the dependency to save
- value:		value to save
- returns:		Stack

Much like the inverse of `load`, yeah? When the `sync(dependency).save`
marks itself complete, the stack is executed.

## YJ.emit(dependency:String[, value:Object]):undefined
## YJ.emit({ dependency1: value1, dependency2: value2, ... })

Registers a dependency. Any stacks created from `when` will execute if
all their dependencies are satisfied. Even if they've already been triggered
(though you can configure this out). If `value` isn't given, it resolves to
`true', thus allowing simple event-based triggering.

## YJ.listen(emitter, event[, alias]):undefined

Calls `emitter.addEventListener(event, ...)` and emits `alias` with the event
object value whenever the event is triggered. Helpful for when waiting on DOM
events. Alias defaults to `event`.

## Stack.then(func:function):Stack
## Stack.then(func, func, func, ...):Stack

Adds `func` to the stack, to be called when triggered. If the stack has already
been triggered, then `func` gets called immediately. Parameters passed to `func`
when called are the value from `load` or dependencies from `when`, with any
values passed via arguments to `this.next` further up the chain concatenated to
the end.

## Stack modifiers

Sit in-between the Stack head, and the first `then`. Modify triggering behaviour.

### nowait()

Normally, a newly-created Stack won't trigger if its dependencies already exist.
To instead execute immediately, drop in a `nowait()`.

### once()

Normally, a Stack will re-trigger if one of its dependencies is updated. Dropping
in `once()` will force it to run first-time only.

### any()

Normally, a Stack will wait for all dependencies to be satisfied before executing.
The `any()` modifier will make it happen if any dependency at all has changed.

### all()

Normally, dependencies can be satisfied over multiple `emit` calls - some now,
then execute the stack when the remainder are supplied. With `all()`, `emit`
must be passed all of the stack's dependencies at once for it to trigger.
(see the second method of calling `emit`).

## sync(dependency:string):{save, load}

Allows you to define `save` and `load` functions that will get called by 
`YJ.save(prop, val)` and `YJ.load(prop)`. An example is given below. Keep in mind
`load` should call `this.next(val)` to supply the loaded value into the stack,
and likewise `save` can do this if you have post-save tasks that need to be
run.

	// Somewhere in your app's code
	YJ.sync('workplaces')
	.save(function(val) {
		localStorage['workplaces'] = JSON.stringify(val);
		this.next();
	})
	.load(function(val) {
		this.next(JSON.parse(localStorage['workplaces']));
	});

...then, somewhere in your code, safely separated and independent:

	YJ.save('workplaces', [{ address: "1"}, { address: "3" }])
	.then(function() {
		console.log('saved to localStorage');
	});

...and somewhere else again:

	YJ.load('workplaces')
	.then(function(workplaces) {
		console.log('restored from localStorage');
		console.log(workplaces);
	});

# Why call it YJunction?

Why still reading this README? Go and do some work.

# No really, why did you call it YJunction?

I finished the first internal revision on a train just past Yass Junction. Also,
`Y` looks like a branch, and `J` looks like it's joining back in on the branch.
Cool, innit?


Licence
-------
Copyright 2012 Steven Thurlow. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are
permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice, this list of
      conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright notice, this list
      of conditions and the following disclaimer in the documentation and/or other materials
      provided with the distribution.

THIS SOFTWARE IS PROVIDED BY STEVEN THURLOW ''AS IS'' AND ANY EXPRESS OR IMPLIED
WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL STEVEN THURLOW OR
CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.