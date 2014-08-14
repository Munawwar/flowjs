flow.js
=======

Manage async callbacks.

Aim of this library it to improve readability of async calls by "linearizing" async calls,
so that one can read async code from top-to-bottom without losing track of the flow of execution.

Why not use async library?
Because it has too much API, and many of them, IMO, are redundant and not helping much in readability.
The one that I do like is async.seq() and this library is like async.seq() with few more features.

`flow(func1, func2, func3, ...[, scope])();` where each function gets `counter, err, results` as arguments.

##### Basic example

```javascript
flow(function (fl) { //Task 1
    //Doing some non-async stuff here, then call fl.next().
    fl.next(null, 'Task 1 result');
}, function (errs, results, fl) { //Task 2
    console.log('Task 1 completed.');
    console.log(errs);
    console.log(results);

    //Do some async stuff
    setTimeout(function () {
        fl.next(null, 'Task 2 result');
    }, 100);
}, function (errs, results, fl) { //Task 3
    console.log('Task 2 completed.');
    console.log(errs);
    console.log(results);

    //Do two async stuff in parallel
    fl.set(2); //this sets internal counter to 2.

    setTimeout(function () {
        //tick(error, result) queues error and result and also decrements internal count by 1.
        //When counter hits zero, the next task will be executed.
        fl.tick(null, 'Async 1 result');
    }, Math.random() * 100);

    setTimeout(function () {
        fl.tick(null, 'Async 2 result');
    }, Math.random() * 100);
}, function (errs, results, fl) { //Task 4
    console.log('Task 3 completed.');
    console.log(errs);
    console.log(results);
    console.log('Done.');
})();
```

Output could potentially be:
```
Task 1 completed.
null
["Task 1 result"]
Task 2 completed.
null
["Task 2 result"]
Task 3 completed.
null
["Async 2 result", "Async 1 result"]
Done.
```

##### How the example works:

Step 1:
You are given a fl object that has an internal counter and should be used to set the number of async resources/callbacks that needs to be managed.
(which is two, in Task 3 above).

Step 2:
Use the same fl instance to decrement the internal counter within the callbacks using the tick() method.
Also pass the results/errors through tick() so that the next task in the list gets them as it's input.
Once counter hits zero, flow.js executes the next task in the list (which is "Task 4" in the example above).

Step 3:
In "Task 4" function, the results and errors which we got from the previous task is displayed.

##### Documentation

[API Documentation](http://munawwar.github.io/flowjs/doc/)

#### Advanced examples

##### Repeating tasks.

```javascript
flow(function (fl) {
    //Do some parallel async operations and repeat this task two times.
    var repeat = (fl.repeatCount < 2);
    fl.set(2, repeat); //if repeat = true, then when tick() reaches zero, it will repeat this task again.
    for (var i = 2; i > 0; i -= 1) {
        setTimeout(function () {
            counter.tick(null, this.index);
        }.bind({index: i}), Math.random() * 100);
    }
}, function (counter, errs, results) {
    console.log(errs);
    console.log(results);
    console.log('Done.');
})();
```

##### Reusing tasks

In some circumstances you may need to split a task list into two so that one of them can be called again later.

```javascript
var taskList1 = flow(...);

flow(function (fl) {
    fl.next(null, 'Results to pass to taskList1');
},
taskList1,
function (err, results) {
    console.log(results); //results from last callback of taskList1
})();

//You may execute taskList1() any number of times.
$('button').on('click', function () {
    taskList1();
});
```
