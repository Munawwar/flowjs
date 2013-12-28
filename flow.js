/**
 * Flow v0.1.0
 * Manage asyncronous operations and your application's flow of control.
 *
 * Basic idea is to make the developer effectively use counters.
 *
 * @example
    flow(function (c) {
        for (var i = 0; i < 3; i += 1) {
            c.inc();
            ...
            ...
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        c.dec(null, JSON.parse(xhr.resposeText));
                    } else {
                        c.dec({errorCode: xhr.status});
                    }
                }
            }
        }
    }, function (c, err, results) {
        //do something
    }, this); //context in which the funtions will run

    //Another way to use
    var tasks = flow.tasks(...);
    tasks.execute();
 */

(function (global) {
    function flow() {
        flow.tasks.apply(this, arguments).next();
    }
    flow.tasks = function () {
        var callbacks = Array.prototype.slice.call(arguments),
            scope;
        if (typeof callbacks[callbacks.length - 1] === 'object') {
            scope = callbacks.pop();
        }
        return new Manager(callbacks, scope);
    };

    //Manager class
    function Manager(callbacks, scope) {
        this.callbacks = callbacks;
        this.scope = scope;
        this.lastArgs = [];
        this.errors = [];
        this.results = [];

        this.currentFunc = -1;
        this.count = this.repeatCount = 0;
        this.repeatNext = false;
    }
    Manager.prototype = {
        callbacks: null,

        count: 0,
        currentFunc: -1,
        repeatNext: false,
        repeatCount: 0,

        errors: null,
        results: null,
        scope: null,
        lastArgs: null, //keeps track of arguments passed to last callback. This is needed in case of repeating a callback.

        /**
         * Set counter value. And say what to do when counter hits zero.
         * @param {Number} val Value of the counter to be set.
         * @param {Boolean} [repeat=false] If true, repeats the current task when counter hits zero
         */
        set: function (val, repeat) {
            if (typeof val === 'number' && val > 0) {
                this.count = val;
            }
            this.repeatNext = !!repeat;
        },
        /**
         * Say what to do when counter hits zero.
         * @param {Boolean} [repeat=false] If true, repeats the current task when counter hits zero
         */
        setFlow:function (repeat) {
            this.repeatNext = !!repeat;
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
            this.count -= 1;
            this.errors.push(error);
            this.results.push(result);

            this.next();
        },
        /**
         * Execute the next task.
         * Note: The next task won't be called if counter is greater than zero.
         */
        next: function (error, result) {
            if (this.count === 0) {
                if (error || result) {
                    this.errors.push(error);
                    this.results.push(result);
                }

                //TODO: Think about whether to send array when all values are null or not..
                var errs, res;
                if (this.repeatNext) {
                    errs = this.lastArgs[0];
                    res = this.lastArgs[1];

                    this.repeatNext = false;
                    this.repeatCount += 1;
                } else {
                    this.currentFunc += 1;
                    errs = compact(this.errors);
                    res = this.results;

                    //reset in preparation for the next call in queue
                    this.errors = [];
                    this.results = [];
                    this.repeatCount = 0;
                }

                if (this.callbacks[this.currentFunc]) {
                    this.lastArgs = [errs, res];
                    this.callbacks[this.currentFunc].call(this.scope, this, errs, res, this.repeatCount);
                }
            }
            //prevent invalid state...
            if (this.count < 0) {
                this.count = 0;
            }
        }
    };
    Manager.prototype.execute = Manager.prototype.next;

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
