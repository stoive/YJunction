(function() {
	var YJ = (function() {
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
			},
			nowait: function() {
				// trigger if all dependencies already supplied
				this.nowait = true;
				if (this.depends.every(function(curr) { return !!dependencies[curr] })) {
					this.exec(this.depends.map(function(curr){ return dependencies[curr] }));
				}
				return this;
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
			then: function() {
				// Allow building stack as a sequence of arguments instead of
				// just a chain of thens
				Array.prototype.push.apply(this.stack, arguments);
				// block modifiers, replace with their setting
				if (typeof(this.once) == "function") this.once = false;
				if (typeof(this.nowait) == "function") this.nowait = false;
				if (typeof(this.any) == "function") this.any = false;
				if (typeof(this.any) == "function") this.any = false;
				return this;
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
					else this.then = function() {
						Array.prototype.push.apply(this.stack, arguments);
						if (typeof(this.once) == "function") this.once = false;
						if (typeof(this.nowait) == "function") this.nowait = false;
						if (typeof(this.any) == "function") this.any = false;
						arguments[0].apply(hook, depends);
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
			do: function() {
				// run immediately
				var stack = new Stack();
				// push all passed functions to stack
				Stack.prototype.then.apply(stack, arguments);
				stack.exec();
				return stack;
			},
			when: function(depends) {
				// pass array, or extract arguments array
				if (!Array.isArray(depends)) depends = Array.prototype.slice.call(arguments);
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

	// module hook-in nicked from underscore.js
	// https://github.com/documentcloud/underscore/blob/master/underscore.js#L54
	// MIT licenced. Thanks!

	if (typeof exports !== 'undefined') {
		if (typeof module !== 'undefined' && module.exports) {
			exports = module.exports = YJ;
		}
		exports.YJ = YJ;
	}
	else if (typeof define === 'function' && define.amd) {
		// Register as a named module with AMD (and RequireJS, I presume).
		define(function() {
			return YJ;
		});
	} else {
		window['YJ'] = YJ;
	}
})();
