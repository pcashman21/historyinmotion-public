/* Unit tests for historical_time.js.  Execute it from the command line with node. */

MYAPP = {};
MYAPP.dateTolerance = .01;

var requirejs = require('requirejs');
requirejs(['historical_time', 'test_runner'], function(ht, test_runner) {

/* Convenience wrapper to construct a HistoricalDate from a date string and an era (CE or BCE) specifier. */
function historicalDateFromDateStringAndEra(dateString, specificity, era) {
    var date = new Date(dateString);
    if (typeof era !== 'undefined' ? era : false) {
        /* JavaScript represents the year 1 BCE as 0, 2 BCE as -1, and so forth. */
        date.setFullYear(1 - date.getFullYear());
    }
    return new ht.HistoricalDate(date.getTime(), specificity);
}

events = [
	{"circa": false,	"BCE": true,	"GMT": "1000-01-01T00:00:00-05:00"},	/* 0:  1000 BCE */
	{"circa": false,	"BCE": true,	"GMT": "1001-01-01T00:00:00-05:00"},	/* 1:  1001 BCE */
	{"circa": false,	"BCE": true,	"GMT": "2000-01-01T00:00:00-05:00"},	/* 2:  2000 BCE */
	{"circa": true,		"BCE": true,	"GMT": "1000-01-01T00:00:00-05:00"},	/* 3:  ca. 1000 BCE */
	{"circa": true,		"BCE": true,	"GMT": "1001-01-01T00:00:00-05:00"},	/* 4:  ca. 1001 BCE */
	{"circa": true,		"BCE": true,	"GMT": "2000-01-01T00:00:00-05:00"},	/* 5:  ca. 2000 BCE */
	{"circa": false,	"BCE": false,	"GMT": "1000-01-01T00:00:00-05:00"},	/* 6:  1000 CE */
	{"circa": false,	"BCE": false,	"GMT": "1001-01-01T00:00:00-05:00"},	/* 7:  1001 CE */
	{"circa": false,	"BCE": false,	"GMT": "2000-01-01T00:00:00-05:00"},	/* 8:  2000 CE */
	{"circa": true,		"BCE": false,	"GMT": "1000-01-01T00:00:00-05:00"},	/* 9:  ca. 1000 CE */
	{"circa": true,		"BCE": false,	"GMT": "1001-01-01T00:00:00-05:00"},	/* 10: ca. 1001 CE */
	{"circa": true,		"BCE": false,	"GMT": "2000-01-01T00:00:00-05:00"},	/* 11: ca. 2000 CE */
	{"circa": false,	"BCE": false,	"GMT": "0001-01-01T00:00:00-05:00"},	/* 12: 1 CE */
	{"circa": false,	"BCE": true,	"GMT": "0001-01-01T00:00:00-05:00"},	/* 13: 1 BCE */
];
var hd = [];
for (var i=0; i <events.length; i++) {
	hd[i] = historicalDateFromDateStringAndEra(events[i].GMT, events[i].circa, events[i].BCE);
}


var t = new test_runner.TestRunner();

t.expect(hd[0].compareHistoricalDate(hd[0]) == "concurrent"); 	/* 1000 BCE vs. 1000 BCE */
t.expect(hd[0].compareHistoricalDate(hd[1]) == "after"); 		/* 1000 BCE vs. 1001 BCE */
t.expect(hd[1].compareHistoricalDate(hd[0]) == "before"); 		/* 1001 BCE vs. 1000 BCE */
t.expect(hd[0].compareHistoricalDate(hd[3]) == "concurrent"); 	/* 1000 BCE vs. ca. 1000 BCE */
t.expect(hd[3].compareHistoricalDate(hd[0]) == "concurrent"); 	/* ca. 1000 BCE vs. 1000 BCE */
t.expect(hd[3].compareHistoricalDate(hd[3]) == "concurrent"); 	/* ca. 1000 BCE vs. ca. 1000 BCE */
t.expect(hd[3].compareHistoricalDate(hd[0]) == "concurrent"); 	/* ca. 1000 BCE vs. 1000 BCE */
t.expect(hd[3].compareHistoricalDate(hd[4]) == "concurrent"); 	/* ca. 1000 BCE vs. ca. 1001 BCE */
t.expect(hd[3].compareHistoricalDate(hd[5]) == "after"); 		/* ca. 1000 BCE vs. ca. 2000 BCE */
t.expect(hd[5].compareHistoricalDate(hd[3]) == "before"); 		/* ca. 2000 BCE vs. ca. 1000 BCE */
t.expect(hd[6].compareHistoricalDate(hd[6]) == "concurrent"); 	/* 1000 CE vs. 1000 CE */
t.expect(hd[6].compareHistoricalDate(hd[7]) == "before"); 		/* 1000 CE vs. 1001 CE */
t.expect(hd[7].compareHistoricalDate(hd[6]) == "after"); 		/* 1001 CE vs. 1000 CE */
t.expect(hd[6].compareHistoricalDate(hd[9]) == "concurrent"); 	/* 1000 CE vs. ca. 1000 CE */
t.expect(hd[6].compareHistoricalDate(hd[10]) == "concurrent"); 	/* 1000 CE vs. ca. 1001 CE */
t.expect(hd[10].compareHistoricalDate(hd[6]) == "concurrent"); 	/* ca. 1000 CE vs. 1000 CE */
t.expect(hd[9].compareHistoricalDate(hd[9]) == "concurrent"); 	/* ca. 1000 CE vs. ca. 1000 CE */
t.expect(hd[9].compareHistoricalDate(hd[10]) == "concurrent"); 	/* ca. 1000 CE vs. ca. 1001 CE */
t.expect(hd[10].compareHistoricalDate(hd[9]) == "concurrent"); 	/* ca. 1001 CE vs. ca. 1000 CE */
t.expect(hd[9].compareHistoricalDate(hd[11]) == "before"); 		/* ca. 1000 CE vs. ca. 2000 CE */
t.expect(hd[11].compareHistoricalDate(hd[9]) == "after"); 		/* ca. 2000 CE vs. ca. 1000 CE */
t.expect(hd[0].compareHistoricalDate(hd[6]) == "before"); 		/* 1000 BCE vs. ca. 2000 CE */
t.expect(hd[6].compareHistoricalDate(hd[0]) == "after"); 		/* 2000 CE vs. 1000 BCE */
t.expect(hd[3].compareHistoricalDate(hd[6]) == "before"); 		/* ca. 1000 BCE vs. 1000 CE */
t.expect(hd[6].compareHistoricalDate(hd[3]) == "after"); 		/* 2000 CE vs. ca. 1000 BCE */

var one_year = 1000 * 60 * 60 * 24 * 365;
var two_millennia = 1000 * 60 * 60 * 24 * (365 * 2000 - 245);

t.expect(hd[0].calculateHistoricalDuration(hd[1]) === one_year);		/* Duration: 1000 BCE, 1001 BCE */
t.expect(hd[1].calculateHistoricalDuration(hd[0]) === one_year);		/* Duration: 1001 BCE, 1000 BCE */
t.expect(hd[6].calculateHistoricalDuration(hd[7]) === one_year);		/* Duration: 1000 CE, 1001 CE */
t.expect(hd[7].calculateHistoricalDuration(hd[6]) === one_year);		/* Duration: 1001 CE, 1000 CE */
t.expect(hd[0].calculateHistoricalDuration(hd[7]) === two_millennia);		/* Duration: 1000 BCE, 1001 CE */
t.expect(hd[7].calculateHistoricalDuration(hd[0]) === two_millennia);		/* Duration: 1001 CE, 1000 BCE */
t.expect(hd[12].calculateHistoricalDuration(hd[13]) === one_year);	/* Duration: 1 CE, 1 BCE */

if (t.failures > 0) {
    console.log(t.successes + " PASSED, " + t.failures + " FAILED")
} else {
    console.log(t.successes + " PASSED");
}

});
