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

        return function executeTasks(errorsParent, resultsParent, counter) {
            var manager = new Manager(callbacks, options);
            //pipe output from previous callback of parent as input to this task.
            manager.execute(errorsParent, resultsParent, function (errors, results) {
                //once all tasks completed, pipe output from last callback of this
                //task as input to the next callback of parent.
                if (counter) {
                    counter.next(errors, results);
                }
            });
        };
    }

    /**
     * Manager class
     * @private
     */
    function Manager(callbacks, options) {
        this.callbacks = callbacks.slice(0);
        this.lastArgs = [];
        this.errors = [];
        this.results = [];

        this.currentFunc = -1;

        this.set(options);
    }
    Manager.prototype = {
        callbacks: null,

        currentFunc: -1,
        repeatNext: false,
        repeatCount: 0,

        results: null,
        errors: null,
        /**
         * Error tolerance level.
         */
        tolerance: 0, //call the next() method on an error.
        scope: null,
        lastArgs: null, //keeps track of arguments passed to last callback. This is needed in case of repeating a callback.

        /**
         * Decide the flow and behavior of task execution.
         * Tell what to do when counter hits zero or an error condition.
         * @param {Object} config
         * @param {Boolean} [config.repeat=false] If true, repeats the current task once, when counter hits zero.
         * @param {Boolean} [config.tolerance=0]
         */
        set: function (options) {
            if (options.tolerance !== undefined) {
                this.tolerance = !!options.tolerance;
            }
            if (typeof options.repeat === 'boolean') {
                this.repeatNext = options.repeat;
            }
        },
        /**
         * Stores error and result, that are meant to be sent as arguments to the next callback in the list.
         */
        store: function (error, result) {
            this.errors.push(error);
            this.results.push(result);
        },
        /**
         * Execute the next task.
         */
        next: function (error, result) {
            if (error !== undefined || result !== undefined) {
                this.errors.push(error);
                this.results.push(result);
            }

            var errs = compact(this.errors), res;
            //don't repeat if !this.tolerance && error.
            if (this.repeatNext && (this.tolerance || (!this.tolerance && !errs))) {
                errs = this.lastArgs[0];
                res = this.lastArgs[1];

                this.repeatCount += 1;
            } else {
                this.currentFunc += 1;
                res = this.results;

                //reset in preparation for the next call in queue
                this.errors = [];
                this.results = [];
                this.repeatCount = 0;
            }
            this.repeatNext = false;

            if (this.callbacks[this.currentFunc]) {
                this.lastArgs = [errs, res];
                if (!this.tolerance && errs && errs[0]) {
                    errs = errs[0];
                }
                var counter = new Counter({manager: this, tolerance: this.tolerance});
                counter.repeatCount = this.repeatCount;

                var args = [errs, res, counter];
                if (this.currentFunc === 0) {
                    if (errs === undefined || errs === null) {
                        args.shift();
                        if (result === undefined) {
                            args.shift();
                        }
                    }
                }
                this.callbacks[this.currentFunc].apply(this.scope, args);
            }
        },

        /**
         * Start executing task. Similar signature as next(), but additionally takes
         * a 3rd parameter as callback, that will be called once all the tasks complete.
         */
        execute: function (err, result, cb) {
            this.callbacks.push(cb);
            this.next(err, result);
        }
    };

    /**
     * A counter, that callbacks have access to.
     * This has been moved from Manager, so that decrement operation on a stale counter doesn't affect the
     * flow of control unknowingly. i.e just for robustness.
     */
    function Counter(config) {
        this.manager = config.manager;
        this.tolerance = config.tolerance;
        this.count = 0;
    }

    Counter.prototype = {
        /**
         * Set counter value. Also set the flow and behavior of task execution.
         * @param {Number} val Value of the counter to be set.
         * @param {Boolean} [repeat=false] Check setFlow() method for documentation.
         * @param {Boolean} [tolerance] Check setFlow() method for documentation.
         */
        set: function (val, repeat, tolerance) {
            if (typeof val === 'number' && val > 0) {
                this.count = val;
            }
            this.setFlow({repeat: repeat, tolerance: tolerance});
        },
        /**
         * Decide the flow and behavior of task execution.
         * Tell what to do when counter hits zero or when faced with an error.
         * @param {Object} [config]
         * @param {Boolean} [config.repeat=false] If true, repeats the current task exactly once, when counter hits zero.
         * @param {Boolean} [config.tolerance=manager.tolerance] Error tolerance level.
         * If an error is encountered when tolerance = 0, then a call to tick(err, null) will immediately cause the next task to be executed
         * and the error will be passed to that task.
         * If tolerance = 1, then tick(err, null) will store the error(s) and pass them to the next task only when counter hits zero.
         */
        setFlow: function (config) {
            if (config.tolerance !== undefined) {
                this.tolerance = !!config.tolerance;
            }
            this.manager.set(config);
        },
        /**
         * Increment counter.
         * @param {Number} [val=1]
         */
        inc: function (val) {
            if (typeof val !== 'number' || val <= 0) {
                val = 1;
            }
            this.count += val;
        },
        /**
         * Decrements counter by 1. Send the error or result.
         */
        tick: function (error, result) {
            //prevent invalid state...
            if (this.count > 0) {
                this.count -= 1;
                this.manager.store(error, result);
                if (!this.tolerance && error) {
                    //set to zero so that future decrements, doesn't affect.
                    this.count = 0;
                }
                this.next();
            }
        },
        /**
         * Execute the next task.
         * Note: The next task won't be called if counter is greater than zero.
         */
        next: function (error, result) {
            if (!this.tolerance && error) {
                //set to zero so that future decrements, doesn't affect.
                this.count = 0;
            }
            if (this.count === 0) {
                this.manager.next(error, result);
            }
        }
    };

    /*
     * If all items of array are empty, return null.
     * Else return original unmodified array.
     */
    function compact(arr) {
        var isEmpty = true;
        arr.some(function (a) {
            if (a !== null && a !== undefined) {
                isEmpty = false;
                return true;
            }
        });
        return isEmpty ? null : arr;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = flow;
    } else if (typeof define === "function" && define.amd) {
        define('flow', [], function () {
            return flow;
        });
    } else {
        //On client-side browsers global = window object.
        global.flow = flow;
    }
}(this));
