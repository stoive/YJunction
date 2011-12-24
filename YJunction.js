var WT = (function() {
	var dependencies = {};
	var waiting = [];
	var syncs = {};

	function trigger() {
		var triggered = Array.prototype.slice.call(arguments);
		waiting.forEach(function(curr) {
			var shouldExec = false;
			if (curr.any === true) {
				// any - some depends are triggered, regardless of if all satisfied
				shouldExec = curr.depends.some(function(depend) { return !!~triggered.indexOf(depend) });
			}
			else if (curr.all === true) {
				// all - every depends triggered (thus every depends satisfied)
				shouldExec = curr.depends.every(function(depend) { return !!~triggered.indexOf(depend) });
			}
			else {
				// normal case - if some depends triggered, and every depends satisfied
				shouldExec = curr.depends.some(function(depend) { return !!~triggered.indexOf(depend) })
					&& curr.depends.every(function(depend) { return !!dependencies[depend] });
			}
			if (shouldExec)
			{
				var args = curr.depends.map(function(curr) { return dependencies[curr] });
				curr.exec(args);
			}
		});
	}

	function emit(key, val) {
		if (typeof(arguments[0]) == "object") {
			var props = [];
			for (var i in arguments[0]) {
				props.push(i);
				dependencies[i] = arguments[0][i] || true;
			}
			trigger.apply(null, props);
		}
		else if (typeof(key) == "string") {
			dependencies[key] = val || true;
			trigger(key);
		}
	}

	function Stack(depends) {
		this.stack = [];
		this.depends = depends;
		// Assume Stacks with no depends will be manually exec'd
		if (depends) waiting.push(this);
	}
	Stack.prototype = {
		once: function() {
			this.once = true;
			return this;
			//var self = this;
			//return { then: self.then, nowait: self.nowait, stack: self.stack, depends: self.depends, exec: self.exec, once: self.once };
		},
		nowait: function() {
			// trigger if all dependencies already supplied
			this.nowait = true;
			if (this.depends.every(function(curr) { return !!dependencies[curr] })) {
				this.exec(this.depends.map(function(curr){ return dependencies[curr] }));
			}
			return this;
			//var self = this;
			//return { then: self.then, once: self.once, stack: self.stack, depends: self.depends };
		},
		any: function() {
			// trigger if any value is emitted, even if some aren't yet
			this.any = true;
			this.all = false;
			return this;
		},
		all: function() {
			// trigger only if all dependencies emitted at once
			this.any = false;
			this.all = true;
			return this;
		},
		then: function(func) {
			this.stack.push(func);
			// block modifiers, replace with their setting
			if (typeof(this.once) == "function") this.once = false;
			if (typeof(this.nowait) == "function") this.nowait = false;
			if (typeof(this.any) == "function") this.any = false;
			if (typeof(this.any) == "function") this.any = false;
			return this;
			//var self = this;
			// cannot call anything but chained `then` hereafter
			//return { then: self.then, stack: self.stack, depends: self.depends };
		},
		exec: function(depends, pos) {
			pos = pos || 0;
			depends = depends || [];
			var self = this;
			
			var hook = {
				next: function() {
					self.exec(depends.concat(Array.prototype.slice.apply(arguments)), ++pos); 
				},
				emit: emit,
				save: function(prop, val) {
					val = val || dependencies[prop];
					syncs[prop].callSave(val);
				},
				reload: function(prop) {
					syncs[prop].callLoad(this.next);
				}
			};

			if (this.once === true) {
				if (this.stack[0]) this.stack.shift().apply(hook, depends);
				else this.then = function(func) {
					func.apply(hook, depends);
					return self;
				}
			}
			else {
				// start executing up the stack
				if (this.stack[pos]) this.stack[pos].apply(hook, depends);
				// once stack exhausted, override `then` to exec immediately with accrued depends
				else this.then = function(func) {
					if (typeof(this.once) == "function") this.once = false;
					if (typeof(this.nowait) == "function") this.nowait = false;
					if (typeof(this.any) == "function") this.any = false;
					this.stack.push(func);
					func.apply(hook, depends);
					return self;
				}
			}
		}
	}

	function Sync(prop) {
		syncs[prop] = this;
	}

	Sync.prototype = {
		save: function(func) {
			this.saveFunc = func;
			return this;
		},
		load: function(func) {
			this.loadFunc = func;
			return this;
		}
	}

	var ret = {
		do: function(func) {
			// run immediately
			var stack = new Stack();
			stack.then(func);
			stack.exec();
			return stack;
		},
		when: function(depends) {
			// run when dependencies men
			return new Stack(depends);
		},
		listen: function(emitter, ev, alias) {
			// emit dependency when event triggered
			alias = alias || ev;
			emitter.addEventListener(ev, function(obj) {
				dependencies[alias] = obj || true;
				trigger(alias);
			}, false);
		},
		sync: function(prop) {
			// define save/load sync methods
			return new Sync(prop);
		},
		load: function(prop) {
			// load a property via specified sync function and execute the stack with its value
			var stack = new Stack();
			stack.then(syncs[prop].loadFunc);
			stack.exec();
			// offer option to load and immediately emit
			stack.thenEmit = function() {
				stack.then(function(val) {
					this.emit(prop, val);
					this.next(val);
				});
				return stack;
			}
			return stack;
		},
		save: function(prop, val) {
			// save a property then execute the stack when done
			var stack = new Stack();
			stack.then(syncs[prop].saveFunc);
			stack.exec([val]);
			return stack;
		},
		emit: emit
	}
	return ret;
})();
