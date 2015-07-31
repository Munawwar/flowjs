flow.js
=======

Manage async callbacks.

Aim of this library it to improve readability of async calls by "linearizing" async calls,
so that one can read async code from top-to-bottom without losing track of the flow of execution.

Why not use async library?
Because it has too much API, and many of them, IMO, are redundant and not helping much in readability.
The one that I do like is async.seq() and this library is like async.seq() with few more features.

Why not use Promises?
Promises are great, but nodejs/iojs APIs aren't using them yet. Libraries like [BlueBird](https://github.com/petkaantonov/bluebird) helps you convert nodejs callback APIs to Promises. So you might want to look into that. Ultimately flowjs is another way to deal with callback hell.

With that said, [ES7 async/await](http://jakearchibald.com/2014/es7-async-functions/) syntax makes code much more readable than any existing solution. So this library will ultimately become obsolete when ES7 async/await becomes more available for us to use.

### Basic API

`flow(func1, func2, func3, ...[, scope])();` where each function gets `fl, errors, results` as arguments.

##### Basic example

```javascript
flow(function (fl) { //Task 1 - Simple example. No async stuff here
    console.log('Executing Task 1.');

    fl.next(null, 'Task 1 result'); //Call fl.next() to execute next task.
}, function (fl, errs, results) { //Task 2 - Managing two parallel async calls
    console.log(results);

    //Do two async operations in parallel.
    fl.parallel(['Async 1', 'Async 2'], function (item, callback) {
        //Once both setTimeouts complete and calls the callback, the next task is called.
        setTimeout(function () {
            callback(null, item + ' result');
        }, Math.random() * 100);
    }, this);
}, function (fl, errs, results) { //Task 3
    console.log('Task 2 results: ' + results.join(', '));

    //Similar async operations as Task 2, but this time using counter.
    //The number 2 is for flowjs to know that once 2 callbacks
    //are called, proceed to next task.
    fl.parallel(2, function (i, callback) {
        setTimeout(function () {
            callback(null, 'Async ' + (i + 1) + ' result');
        }, Math.random() * 100);
    }, this);
    
}, function (fl, errs, results) { //Task 4
    console.log('Task 3 results: ' + results.join(', '));

    //No more tasks so no need to call fl.next().
}
/*Any number of functions (tasks) can be added here.*/)();
```

Output:
```
Executing Task 1.
["Task 1 result"]
Task 2 results: Async 1 result, Async 2 result
Task 3 results: Async 1 result, Async 2 result
```

##### How the example works:

Step 1:
You are given a fl object that has API to continue to next task (fl.next()) or do some parallel async operations and then continue to next task.

In Task 2 above, fl.parallel is used, which gives a callback to be called once an async operation completes.
The results/errors are passed through this callback so that the next task in the list gets them as it's input.
Once all the async operations complete and all the callbacks are called, flow.js automatically executes the next task (which is "Task 3" in the example above). which get an array of results and an array of errors.

Step 2:
In "Task 3", the results and errors which we got from the previous task is displayed.

### Clean example

Now let's take a more real-world example to show you how clean the code becomes. Here is a flowchart containing some async operations a typical client-side application would need as part of it's "bootstrapping" logic:

![Flowchart](flowchart.png)

You can easily put callbacks inside callbacks to write code for such a case, but when writing large pieces of code you'll end up with deep nested functions that will be hard to read later on. If you then try to move functions out into the parent scope using variables or named functions then the flow of execution of the code becomes harder to understand.

So now let's write the logic with flowjs.

```javascript
window.CLIENTVERSION = 10;

flow(function (fl, errs, results) {
    //<Boostrapping code here>
    //<Check unsupported browsers here>

    //Fetch data version to check whether we need to migrate user or not.
    ajax('GET', '/version', fl.next);
}, function (fl, errs, results) {
    if (errs) { return; } //Handle error and return
    
    var response = results[0];
    if (response.dataVersion !== window.CLIENTVERSION) {
        //Initiate data migration
        ajax('GET', '/migrate', fl.next);
    } else {
        fl.next();
    }
}, function (fl, errs, results) {
    if (errs) { return; }
    ajax('GET', '/data', fl.next);
}, function (fl, errs, results) {
    if (errs) { return; }
    //<Load application>
    //Done.
})();

function ajax(method, url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.onload = function () {
        if (this.status >= 200 && this.status < 300) {
            callback(null, JSON.parse(this.resposeText));
        } else {
            callback(this.status);
        }
    };
    xhr.send();
}
```

##### Documentation

[API Documentation](http://munawwar.github.io/flowjs/doc/)

#### Advanced examples

##### Repeating tasks.

```javascript
flow(function (fl) {
    var repeat = (fl.repeatCount < 2);
    //Do some parallel async operations and repeat this task two times.
    fl.parallel({
        count: 2,
        repeat: repeat
    }, function (callback, i) {
        setTimeout(function () {
            callback(null, 'Async ' + (i + 1) + ' result');
        }, Math.random() * 100);
    }, this);
}, function (fl, errs, results) {
    console.log(errs);
    console.log(results);
    console.log('Done.');
})();
```

##### Reusing tasks

I've come across a circumstance where I needed to split a task list into two so that one of them can be called again later.

```javascript
var taskList1 = flow(...);

flow(function (fl) {
    fl.next(null, 'Results to pass to taskList1');
},
taskList1,
function (fl, err, results) {
    console.log(results); //results from last callback of taskList1
})();

//You may execute taskList1() any number of times.
$('button').on('click', function () {
    taskList1();
});
```
