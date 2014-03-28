flow
====

Manage async callbacks

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
    counter.next();
}
```

##### How it works:

Step 1:
You are given a counter object that should be used to set the number of async resources/callbacks that you need to manage.
In the above example it is two.

Step 2:
Use the same counter object to decrement the counter within the callback using the tick() method.
Also pass the results/errors of the callbacks so that the next task in the queue gets them as their input.
Once counter hits zero, it executes step 3 (i.e "Task 2").

Step 3:
In "Task 2" (in the above example), the results and errors which (we got from step 2) are displayed.

##### More complex example (with repeating tasks and inc() call).

```javascript
flow(function (counter) {
    //Do some async operations
    for (var i = 2; i > 0; i -= 1) {
        counter.inc(); //increments counter by 1
        setTimeout(function () {
            counter.tick(null, this.index);
        }.bind({index: i}), Math.random() * 100);
    }
    console.log('Task 1 completed.');
}, function (counter, errs, results) {
    console.log(errs);
    console.log(results);
    console.log('Task 2 completed.');
    counter.next();
}, function (counter, errs, results, repeatCount) {
    if (repeatCount < 2) {
        counter.setFlow({repeat: true}); //which means when tick() reaches zero, it will repeat this task again.
    }
    //Do some async operations
    for (var i = 2; i > 0; i -= 1) {
        counter.inc();
        setTimeout(function () {
            counter.tick(null, this.index);
        }.bind({index: i}), Math.random() * 100);
    }
    console.log('Task 3 completed.');
}, function (counter, errs, results) {
    console.log(errs);
    console.log(results);
    console.log('Task 4 completed.');
    console.log('Done');
});
```
