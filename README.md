flow.js
=======

Manage async callbacks

`flow(func1, func2, func3, ...[, scope]);` where each function gets `counter, err, results` as arguments.

##### Simple example

```javascript
flow(function (counter) {
    counter.set(2);
    //Do some async operations
    for (var i = 2; i > 0; i -= 1) {
        setTimeout(function () {
            counter.tick(null, this.index);
        }.bind({index: i}), Math.random() * 100);
    }
    console.log('Task 1 completed.');
}, function (counter, err, results) {
    console.log(err);
    console.log(results);
    console.log('Task 2 completed.');
});
```

##### How the example works:

Step 1:
You are given a counter object that should be used to set the number of async resources/callbacks that needs to be managed.
(which is two, in the given example).

Step 2:
Use the same counter instance to decrement the counter within the callbacks using the tick() method.
Also pass the results/errors through tick() so that the next task in the list gets them as it's input.
Once counter hits zero, flow.js executes the next task in the list (which is "Task 2" in the example above).

Step 3:
In "Task 2" function, the results and errors which we got from previous task are displayed.

##### Documentation

[API Documentation](munawwar.github.io/flow/doc/)

##### More complex example (with repeating tasks).

```javascript
flow(function (counter) {
    counter.set(2);
    //Do some async operations
    for (var i = 2; i > 0; i -= 1) {
        setTimeout(function () {
            counter.tick(null, this.index);
        }.bind({index: i}), Math.random() * 100);
    }
    console.log('Task 1 completed.');
}, function (counter, err, results) {
    console.log(err);
    console.log(results);
    console.log('Task 2 completed.');
    counter.next(); //needed to execute next task
}, function (counter, err, results, repeatCount) {
    var repeat = (repeatCount < 2);
    counter.set(2, repeat); //if repeat = true, then this task will be repeated when counter hits zero.
    
    //Do some async operations
    for (var i = 2; i > 0; i -= 1) {
        setTimeout(function () {
            counter.tick(null, this.index);
        }.bind({index: i}), Math.random() * 100);
    }
    console.log('Task 3 completed.');
}, function (counter, err, results) {
    console.log(err);
    console.log(results);
    console.log('Task 4 completed.');
});
```
