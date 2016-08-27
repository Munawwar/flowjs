/*
 * flow.js v0.1.0. MIT License.
 * Manage async callbacks.
 */

(function (global) {
    /**
     * Manage asyncronous operations.
     * @class flow
     * @singleton
     * @param {Object} [config]
     * @param {Function} functions func1, func2, ... funcN
     * @param {Object} [scope]
     *
     * @return {Function} Returns a function. Which can either, directly be added as a flow task..
     * or can be called as func() or func(err, result, function callback (err2, result2) { ... }). Parameters
     * are optional.
     */
    function flow() {
        var callbacks = Array.prototype.slice.call(arguments),
            options = {};
        if (typeof callbacks[0] === 'object') {
            options = callbacks.shift();
        }
        if (typeof callbacks[callbacks.length - 1] === 'object') {
            options.scope = callbacks.pop();
        }
        var last = callbacks[callbacks.length - 1];
        if (typeof last === 'function' && last.name === 'catcher') {
            options.catcher = callbacks.pop();
        }

        return function (parallelMgr, errorParent, resultParent, baggageParent) {
            var userCallback;
            if (!(parallelMgr instanceof ControlHelper)) { //then assume only 3 arguments
                baggageParent = resultParent;
                resultParent = errorParent;
                errorParent = parallelMgr;

                parallelMgr = null;
                userCallback = (baggageParent instanceof Function ? baggageParent : null);
                baggageParent = null;
            }

            var manager = new SerialManager(callbacks, options);
            //pipe output from previous callback of parent as input to this task.
            manager.execute(errorParent, resultParent, baggageParent, function (error, result, baggage) {
                //once all tasks completed, pipe output from last callback of this
                //task as input to the next callback of parent.
                if (parallelMgr) {
                    parallelMgr.setBaggage(baggage);
                    parallelMgr.next(error, result);
                } else if (userCallback) {
                    userCallback(error, result, baggage);
                }
            });
        };
    }

    /**
     * Manages serial async tasks.
     * @private
     */
    function SerialManager(callbacks, options) {
        this.callbacks = callbacks.slice(0);
        this.lastArgs = [];

        this.currentFunc = -1;

        this.set(options);
    }
    SerialManager.prototype = {
        callbacks: null,

        currentFunc: -1,
        repeatNext: false,
        repeatCount: 0,

        result: null,
        error: null,
        scope: null,
        lastArgs: null, //keeps track of arguments passed to last callback. This is needed in case of repeating a callback.

        /**
         * Decide the flow and behavior of task execution.
         * Tell what to do when counter hits zero or an error condition.
         * @param {Object} config
         * @param {Boolean} [config.repeat=false] If true, repeats the current task once, when counter hits zero.
         * @param {Object} [config.scope]
         */
        set: function (options) {
            if (typeof options.repeat === 'boolean') {
                this.repeatNext = options.repeat;
            }
            if (options.scope) {
                this.scope = options.scope;
            }
            if (typeof options.catcher === 'function') {
                this.catcher = options.catcher;
            }
        },
        /**
         * Stores error and result, that are meant to be sent as arguments to the next callback in the list.
         */
        store: function (error, result, index) {
            if (this.result === undefined) {
                this.result = [];
                this.error = [];
            }

            if (typeof index === 'number') {
                this.result[index] = result;
                this.error[index] = error;
            } else {
                this.result.push(result);
                this.error.push(error);
            }
        },
        /**
         * Execute the next task.
         */
        next: function (error, result, baggage) {
            if (error !== undefined || result !== undefined) {
                this.error = error;
                this.result = result;
            }

            var err, res;
            if (this.repeatNext) {
                err = this.lastArgs[0];
                res = this.lastArgs[1];

                this.repeatCount += 1;
            } else {
                this.currentFunc += 1;
                err = this.error;
                res = this.result;

                //reset in preparation for the next call in queue
                this.error = null;
                this.result = null;
                this.repeatCount = 0;
            }
            this.repeatNext = false;

            if (this.callbacks[this.currentFunc]) {
                this.lastArgs = [err, res];
                var mgr = new ControlHelper({manager: this});
                mgr.repeatCount = this.repeatCount;

                if (!this.catcher) {
                    this.callbacks[this.currentFunc].apply(this.scope, [mgr, err, res, baggage]);
                } else {
                    try {
                        this.callbacks[this.currentFunc].apply(this.scope, [mgr, err, res, baggage]);
                    } catch (e) {
                        this.catcher.call(this.scope, e);
                    }
                }
            }
        },

        /**
         * Start executing task. Similar signature as next(), but additionally takes
         * a 4th parameter as callback, that will be called once all the tasks complete.
         */
        execute: function (err, result, baggage, cb) {
            this.callbacks.push(cb);
            this.next(err, result, baggage);
        },

        /**
         * Alias for next(null, result). API inspired from Promises.
         * @param {Any} result
         */
        resolve: function (result) {
            this.next(null, result);
        },

        /**
         * Alias for next(err). API inspired from Promises.
         * @param {Any} err
         */
        reject: function (err) {
            this.next(err);
        }
    };

    /**
     * Provides control functions to associated SerialManager as well as
     * helps to manage parallel async calls within the serial task.
     *
     * Works internally with a simple idea of using counters to manage parallel calls.
     */
    function ControlHelper(config) {
        //A ControlHelper instance can only be created within a serial task.
        //Hence ControlHelper instnace is always associated with a SerialManager instance.
        this.manager = config.manager;
        this.count = 0;
        this.baggage = null;

        //bind next, so that it can be passed directly to node.js APIs like fs.readFile.
        this.next = this.next.bind(this);
    }

    ControlHelper.prototype = {
        /**
         * Set counter value and also the behavior of task execution.
         * "Behavior" means to tell flowjs what to do when counter hits zero or when faced with an error.
         *
         * @param {Number} count Value of the counter to be set.
         * @param {Boolean} [repeat=false] If true, repeats the current task exactly once, when counter hits zero.
         */
        set: function (count, repeat) {
            var config = count;
            if (typeof count === 'number') {
                config = {
                    count: count,
                    repeat: repeat
                };
            }
            if (typeof config.count === 'number' && config.count > 0) {
                this.count = config.count;
            }

            this.manager.set(config);
        },

        /**
         * Set "baggage". This will be passed as third parameter to the next task.
         * Useful for avoiding scoped variables for your tasks.
         */
        setBaggage: function (b) {
            this.baggage = b;
        },

        /**
         * Set counter value and also the behavior of task execution.
         * "Behavior" means to tell flowjs what to do when counter hits zero or when faced with an error.
         *
         * Polymorhic form of set(count, repeat) method.
         * @param {Object} config
         * @param {Number} config.count Same as count param when it is a number.
         * @param {Boolean} [config.repeat=false] Same as repeat param.
         * @method set
         */

        /**
         * Decrements counter by 1. Send the error or result.
         * @param {Number} [index] The desired index in the results/errors array (of the next task) where the provided result/error should be placed.
         * @param {Any|null} error
         * @param {Any|null} result
         * @private
         */
        tick: function (index, error, result) {
            if (arguments.length < 3) {
                result = error;
                error = index;
            }
            //prevent invalid state...
            if (this.count > 0) {
                this.count -= 1;
                this.manager.store(error, result, index);
                this.next();
            }
        },
        /**
         * Execute the next task of the series.
         * Note: The next task won't be called if counter is greater than zero.
         */
        next: function (error, result) {
            if (this.count === 0) {
                this.count -= 1; //set to -1 so that future decrements, doesn't affect.
                this.manager.next(error, result, this.baggage);
            }
        },
        /**
         * Utility function to help one to execute 'n' number of parallel tasks.
         * @param {Number|Array|Object} n If number then this is the number of parallel tasks. If n is an array then func is called for each item of the array.
         * If object then the config is mostly same as set() method and additionally config.array can be set instead of config.count.
         * @param {Function} func(i or item, cb) The function to call 'n' number of times. func gets an index (or an item of array) and a callback as parameters.
         * Make sure callback is called eventually and exactly once within func. Calling the callback a second time won't do anything (the passed values are discarded).
         * @param {Object} [context] Context of 'this' keyword within func.
         */
        parallel: function (n, func, context) {
            if (typeof n === 'object' && !(n instanceof Array)) {
                this.set(n);
                n = n.array ? n.array : n.count;
            }
            var i;
            if (typeof n === 'number') {
                this.set(n);
                for (i = 0; i < n; i += 1) {
                    func.call(context, i, oneTimeUse(this.tick, this, i));
                }
            } else if (n instanceof Array) {
                this.set(n.length);
                for (i = 0; i < n.length; i += 1) {
                    func.call(context, n[i], oneTimeUse(this.tick, this, i), i);
                }
            }
        }
    };

    function oneTimeUse(func, scope, i) {
        var called = false;
        return function (errs, results) {
            if (!called) {
                called = true;
                return func.call(scope, i, errs, results);
            }
        };
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = flow;
    } else if (typeof define === "function" && define.amd) {
        define([], function () {
            return flow;
        });
    } else {
        //On client-side browsers global = window object.
        global.flow = flow;
    }
}(this));
