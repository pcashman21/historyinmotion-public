define(function() {

function TestRunner() {
    this.failures = 0;
    this.successes = 0;
}

TestRunner.prototype.expect = function (expectation) {
    if (expectation) {
        ++this.successes;
    } else {
        ++this.failures;
        console.log(new Error('Test failed').stack);
    }
}

return {
    TestRunner: TestRunner
} 

});
