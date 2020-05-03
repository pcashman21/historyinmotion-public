// 						HISTORY IN MOTION WEB CLIENT
// CODE COPYRIGHT (c) 2013 - 2015 BY PAUL M. CASHMAN (North Reading, MA) and JOHN M. LEEN (Seattle, WA)
// ALL RIGHTS RESERVED.

/* Library for dealing with historical time.  Exports several classes and utility functions. */
/* See the return block at the bottom of the file for a list. */

define(function() {

/* Utility to construct a BCE date from a string. */
function parseBceDate(dateStr) {
    var date = new Date(dateStr);
    date.setFullYear(1 - date.getFullYear());
    return date.getTime();
}

/* Utility to hide how Javascript saves BCE years */
function makeBceYear(year) {
	return (1 - year);
}

/* Utility to tell if a date is BCE or CE */
function whichEra(historicalDate) {
	var thisDate = new Date(historicalDate.GMT);
	if (thisDate.getUTCFullYear() < 0) return "BCE";
	else return "CE";
}

// jleen: This replacement for the Date constructor can handle dates in the first century
// (i.e. two-digit dates).
function makeDate(fullYear, month, day) {
    var date = new Date(fullYear, month, day);
    date.setFullYear(fullYear);
    return date;
}

/* HistoricalDate stores a historical date as a POSIX date and a precision: */
/*	date:		UTC time as milliseconds before or after january 1, 1970 */
/*	circa:		true if this is an approximate date; false if it is an absolute date */

function HistoricalDate (historicalTimeinGMT, specificity) {
    if (typeof historicalTimeinGMT !== 'number') throw 'bah ' + typeof historicalTimeinGMT + ' ' + historicalTimeinGMT;
    this.GMT = historicalTimeinGMT;
	this.circa = typeof specificity !== 'undefined' ? specificity : false;

	/* compareHistoricalDate(date2) compares "this" to "date2" where both are HistoricalDates. */
	/* Results: */
	/*	"before"		if "this" is before "date2" */
	/*	"after"			if "this" is after "date2" */
	/*	"concurrent"	if "this" is at the same time as "date2" */
	
	/* Note that either or both dates may be "circa" some absolute date.  If one or both HistoricalDates are approximate, */
	/* then they are considered "concurrent" if they fall within some tolerance (percentage of time), which is given by the */
	/* global variable MYAPP.dateTolerance, which is expressed as a percentage (e.g., .01 for a 1% tolerance). */
	
	this.compareHistoricalDate = function (date2,tolerance) {
		if (!(this.circa || date2.circa)) { /* Both dates are absolute */
			if (this.GMT < date2.GMT) return "before";
			if (this.GMT > date2.GMT) return "after";
			return "concurrent";
		}
		/* One or both dates are "circa," so compute the percentage difference and compare it to the global MYAPP.dateTolerance */
		if (this.withinDateTolerance(date2,tolerance)) return "concurrent";
		if (this.GMT < date2.GMT) return "before";
		if (this.GMT > date2.GMT) return "after";
	}
	
	/* withinDateTolerance computes the percentage by which "this" differs from "date2".  If the absolute value of the difference */
	/* is a percentage <= MYAPP.dateTolerance, then the function returns true; otherwise it returns false.  This enables two dates, */
	/* one or both of which are approximate, to be compared. */
	
	this.withinDateTolerance = function (date2, tolerance) {
		var pct = Math.abs((this.GMT - date2.GMT)/this.GMT);
		return (pct <= tolerance);
	}
	
	/* calculateHistoricalDuration computes the time in milliseconds between "this" HistoricalDate and another ("date2"). */
	
	this.calculateHistoricalDuration = function (date2) {
		return Math.abs(this.GMT - date2.GMT);
	}
	
	this.stringifyHistoricalDate = function () {
		var h = {};
		h.GMT = this.GMT;
		h.circa = this.circa;
		return h;
	}
}

// Functions to encapsulate the system min and max dates.  Needed both here and in MAIN, so they can't just be globals in MAIN.
	
function maxHistoricalDate () {
	return Date.parse("9999-01-01T00:00:00-05:00");
}

function minHistoricalDate () {
	return parseBceDate("9999-01-01T00:00:00-05:00");
}
	

var msPerHour = 60 * 60 * 1000;

// Get the UTC offset in hours, given a string of the form "timeZoneName (UTCx[h]h[:mm])" where timeZonename is the name of the zone,
// x is either + or -, h is hours, m is minutes, and [] bracket optional elements.  Note that the return value may be fractional, since 
// there are time zones that are not an integral number of hours.

function getUTCOffset(timeZone) {
	var utcOffset = timeZone.substr(timeZone.indexOf("(")+4,timeZone.indexOf(")")-(timeZone.indexOf("(")+4)); // Strip off "(UTC" and ")" to get the offset
	if (utcOffset.indexOf(":") < 0) utcOffset = utcOffset + ":00";
	if (utcOffset.indexOf(":") == 1) utcOffset = "0" + utcOffset;
	var utcOffsetHours = parseInt(utcOffset.substr(0,utcOffset.indexOf(":")));
	var utcOffsetMinutes = parseInt(utcOffset.substr(utcOffset.indexOf(":")+1));
	if (utcOffsetHours < 0) utcOffsetHours = utcOffsetHours - (utcOffsetMinutes/60);
	else					utcOffsetHours = utcOffsetHours + (utcOffsetMinutes/60);
	return utcOffsetHours;
}

// GregorianDateFormatter provides a format method that emits a Gregorian calendar date.
// The constructor takes an argument "utcOffset", a number (may not be an integer!) that specifies an offset for UTC.  It also takes the 
// "timeZone" string such as "Eastern (UTC-5)".
// It also takes a "formatGuide" object argument structured as an array of 12 objects.  Each object describes the format element 
// to occur at that position in a completed historical date format string.  Each array element has an object value which has at 
// least these properties:
//		rootName:	The "root name" of the HD element that displays this format option, e.g., day_of_week, month, date, etc.
//					The names of HTML elements within this <div> have names based on this root name.
//		display:	true iff this property is to be displayed 
//		separator:	A string that follows the property value (e.g., blank, comma, colon, etc.)
// The month and era properties have an additional sub-property:
//		style:		Indicates the style in which to show this value (the HTML field value, e.g., BCE_CE or BC_AD
// For month, this could be by name or by number (1-12).  For era, it's BCE or CE style vs. BC or AD style.
//
// We do timezone calculations by hand and avoid the "local time" version of any JavaScript library methods,
// so that we can use the correct timezone for the historical events rather than depend on the browser's local time.
//
// TODO: Handle timezones more comprehensively, including automatic DST boundaries.
function GregorianDateFormatter(utcOffset,formatGuide,timeZone) {
    this.utcOffset = utcOffset !== 'undefined' ? utcOffset : 0;
    var timeZoneName = timeZone.substring(0,timeZone.indexOf("(")-1);
    var timeZoneOffset = timeZone.substr(timeZone.indexOf("("));
	
	this.format = function (historicalDate) {
		var epoch 	= new Date(historicalDate.GMT + utcOffset * msPerHour);
		var era		= "CE";
		var year 	= epoch.getUTCFullYear();
        /* JavaScript represents the year 1 BCE as 0, 2 BCE as -1, and so forth. */
        if (year <= 0) {
            era = "BCE";
            year = 1 - year;
        }
		var date 	= epoch.getUTCDate();
		var day 	= epoch.getUTCDay();
		var hours 	= epoch.getUTCHours();
		var minutes	= epoch.getUTCMinutes();
		var month	= epoch.getUTCMonth();
		var seconds	= epoch.getUTCSeconds();
		var months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
		var weekdays = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
		var AM_PM = "AM";
		var result = "";
	
		if ((hours >= 12) || (hours < 0)) { AM_PM = "PM"; } // hours < 0 => it was a PM hour to start with
		if (hours > 12) { hours = hours - 12; }
		if (hours < 0) { hours = hours + 12; day--; date--; }
		if (minutes < 10) minutes = "0" + minutes;
		if (seconds < 10) seconds = "0" + seconds;
		var clock24 = false;
		for (var i=0; i< formatGuide.length; i++) {
			if (formatGuide[i].rootName == "AMPM") clock24 = !formatGuide[i].display; // Does user want AM/PM or 24-hour clock
		}
		for (var i=0; i< formatGuide.length; i++) {
			if (formatGuide[i].display) {
				switch (formatGuide[i].rootName) {
					case "day_of_week":
						result = result + weekdays[day] + formatGuide[i].separator;
						break;
					case "month":
						if (formatGuide[i].style == "name") result = result + months[month] + formatGuide[i].separator ;
						else								result = result + (month + 1) + formatGuide[i].separator;
						break;
					case "date":
						result = result + date + formatGuide[i].separator;
						break;
					case "year":
						result = result + year + formatGuide[i].separator;
						break;
					case "era":
						if (era == "CE") {
							if (formatGuide[i].style == "BC_AD") era = "AD";
						}
						else {
							if (formatGuide[i].style == "BC_AD") era = "BC";
						}
						result = result + era + formatGuide[i].separator;
						break;
					case "hour":
						if ((AM_PM == "PM") && clock24 && (hours < 12)) hours = hours + 12;   // Use 24-hour clock 
						if ((AM_PM == "AM") && clock24 && (hours < 10)) hours = "0" + hours;
						if ((AM_PM == "AM") && !clock24 && (hours == 0)) hours = 12;  // Show midnight as 12 AM, not 0 AM
						result = result + hours + formatGuide[i].separator;
						break;
					case "minute":
						result = result + minutes + formatGuide[i].separator;
						break;
					case "second":
						result = result + seconds + formatGuide[i].separator;
						break;
					case "AMPM":
						result = result + AM_PM + formatGuide[i].separator;
						break;
					case "timezone":
						result = result + timeZoneName + formatGuide[i].separator;
						break;
					case "offset":
						result = result + timeZoneOffset + formatGuide[i].separator;
						break;
				}
			}
		}
		return result;
	}
	
	// formatObject does the same thing as format, but it returns an object with the historicalDate's time components rather than a string.
	
	this.formatObject = function (historicalDate) {
		var epoch 	= new Date(historicalDate.GMT + utcOffset * msPerHour);
		var era		= "CE";
		var year 	= epoch.getUTCFullYear();	
        /* JavaScript represents the year 1 BCE as 0, 2 BCE as -1, and so forth. */
        if (year <= 0) {
            era = "BCE";
            year = 1 - year;
        }
		var date 	= epoch.getUTCDate();		
		var day 	= epoch.getUTCDay();		
		var hours 	= epoch.getUTCHours();		
		var minutes	= epoch.getUTCMinutes();	
		var month	= epoch.getUTCMonth();		
		var seconds	= epoch.getUTCSeconds();	
		var months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
		var weekdays = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
		var AM_PM = "AM";
		var result = "";
	
		if ((hours >= 12) || (hours < 0)) { AM_PM = "PM"; } // hours < 0 => it was a PM hour to start with
		if (hours > 12) { hours = hours - 12; }
		if (hours < 0) { hours = hours + 12; day--; date--; }
		if (minutes < 10) minutes = "0" + minutes;
		if (seconds < 10) seconds = "0" + seconds;
		for (var i=0; i< formatGuide.length; i++) {
			if (formatGuide[i].rootName == "AMPM") clock24 = !formatGuide[i].display; // Does user want AM/PM or 24-hour clock
		}
		for (var i=0; i< formatGuide.length; i++) {
			if (formatGuide[i].display) {
				switch (formatGuide[i].rootName) {
				
					// There is no case for "month" because returning the name of the month would cause the Javascript Date object 
					// creation method to barf (if the user had specified months as names rather than numbers in the formatting).
				
					case "era":
						if (era == "CE") {
							if (formatGuide[i].style == "BC_AD") era = "AD";
						}
						else {
							if (formatGuide[i].style == "BC_AD") era = "BC";
						}
						break;
					case "hour":
						if ((AM_PM == "PM") && clock24 && (hours < 12)) hours = hours + 12;   // Use 24-hour clock 
						if ((AM_PM == "AM") && clock24 && (hours < 10)) hours = "0" + hours; 
						if ((AM_PM == "AM") && !clock24 && (hours == 0)) hours = 12;  // Show midnight as 12 AM, not 0 AM
						break;
					default:
						break;
				}
			}
		}
		result = { 	weekday:	weekdays[day],
					month: 		month,
					date: 		date,
					year: 		year,
					era: 		era,
					hours: 		hours,
					minutes: 	minutes,
					seconds: 	seconds,
					AM_PM: 		AM_PM,
					timezone:	timeZoneName,
					offset:		timeZoneOffset
				};
		return result;
	}
}

// checkDateAndTimeInputs takes:
//		jqDate		jQuery object for the date input element 
//		jqTime		jQuery objecy the time input element 
//		AMorPM		string "AM" or "PM"
//		timeZone	string representing the time zone.  This is of the form "tz_name UTCx[h]h[:mm]" where tz_name is a name like Eastern, and [] enclose optional items
//
// The time input by the user is assumed to be in the time zone specified, so it needs to be converted to the equivalent UTC.
// The function returns an object as follows:
//	{   GMT:		milliseconds before or after January 1, 1970
//		errCode:	a string for the error code, if one was found, or "" if no error
//		jqObject:	the jQuery object representing the input element that was in error
//		utcOffset:	Number of hours to add to UTC to get the desired time zone (could be a non-integer, e.g., -3.5 hours)
//  }	
//
// Note that checkDateAndTimeInputs does *not* create and return a HistoricalDate.  That is done in the calling program.
//
// Also note that checkDateAndTimeInputs uses the UTC time and the timeZone to obtain the Daylight Savings Time offset in hours (0 if no DST, 1 if DST).  It
// uses this to add the necessary number of milliseconds to the UTC time.

function checkDateAndTimeInputs(jqDate,jqTime,AMorPM,timeZone) {
	var utcOffset = timeZone.substr(timeZone.indexOf("(")+4,timeZone.indexOf(")")-(timeZone.indexOf("(")+4)); // Strip off "(UTC" and ")" to get the offset
	if (utcOffset.indexOf(":") < 0) utcOffset = utcOffset + ":00";
	if (utcOffset.indexOf(":") == 1) utcOffset = "0" + utcOffset;
	var dateStr = jqDate.children(":input").val(); // The date <input> element is always encased in a <div> that encloses the <label> and its <input>, so 
												   // that if there is an error in the input, the error message can be placed in the element that follows the <div>
	var timeStr = jqTime.val();
	var mm = "";
	var dd = "";
	var yyyy = "";
	var hh = 0;
	var mi = 0;
	var ss = 0;
	var daysPerMonth = [31,28,31,30,31,30,31,31,30,31,30,31];
	var i1 = dateStr.indexOf("/");  // 1st slash
	var dateStrDDYYYY = dateStr.substr(i1+1);
	var i2 = dateStrDDYYYY.indexOf("/");  // 2nd slash
	mm = parseInt(dateStr.substr(0,i1))-1; // Subtract 1 for UTC zero-based month
	dd = parseInt(dateStrDDYYYY.substr(0,i2));
	yyyy = parseInt(dateStrDDYYYY.substr(i2+1));
	if (((yyyy % 4) == 0) && (((yyyy % 100) !== 0) || ((yyyy % 400) == 0))) daysPerMonth[1] = 29; // Note leap years
	if (mm > 11) return({ GMT: 0, errCode: "badMonth", jqObject: jqDate });
	if ((dd == 0) || (dd > daysPerMonth[mm])) return({ GMT: 0, errCode: "badDate", jqObject: jqDate });
	if (timeStr.length > 0) {
		var i3 = timeStr.indexOf(":");
		if (i3 < 0) hh = parseInt(timeStr);
		else {
			hh = parseInt(timeStr.substr(0,i3));
			var i4 = timeStr.substr(i3+1).indexOf(":");
			if (i4 < 0) {
				mi = parseInt(timeStr.substr(i3+1));
			}
			else {
				mi = parseInt(timeStr.substr(i3+1,i4));
				ss = parseInt(timeStr.substr(i4+i3+2));
			}
		}
	}
	if (isNaN(hh) || isNaN(mi) || isNaN(ss) ||
		(hh > 24) || (mi > 59) || (ss > 59)) return ({ GMT: 0, errCode: "badTime", jqObject: jqTime });
	if ((AMorPM == "PM") && (hh < 12)) hh = hh + 12;  //Adjust for PM hours	
	if ((AMorPM == "AM") && (hh == 12)) hh = 0;  // Save midnight hour as 0, not 12
	var utcOffsetHours = parseInt(utcOffset.substr(0,utcOffset.indexOf(":")));
	var utcOffsetMinutes = parseInt(utcOffset.substr(utcOffset.indexOf(":")+1));
	// To get the equivalent UTC, subtract the offset from the local time, since the offset will be added when converting from UTC to local
	if (utcOffsetMinutes > 0) {	
		mi = mi - utcOffsetMinutes;
		if (mi > 59) {			// Roll over to next hour
			mi = mi - 60;
			hh = hh + 1;
		}
		else if (mi < 0) {		
			mi = mi + 60;
			if (utcOffsetHours > 0) hh = hh - 1;
		}
	}
	hh = hh - utcOffsetHours;
	if (hh > 23) {				// Roll over to next day
		hh = hh - 24;			
		dd = dd + 1;
	}
	else if (hh < 0) {			
		hh = hh + 24;
		dd = dd - 1;			// Roll back to previous day
	}
	if (dd > daysPerMonth[mm]) { // Roll over to next month
		dd = 1;
		mm = mm +1;
		if (mm > 11) {			// Roll over to next year
			mm = 0;
			yyyy = yyyy + 1;
		}
	}
	else if (dd == 0) {			// Roll back to previous month
		mm = mm - 1;
		if (mm < 0) {			// Roll back to previous year
			mm = 11;
			yyyy = yyyy - 1;
		}
		dd = daysPerMonth[mm];
	}
	var ms = new Date();
	ms.setUTCFullYear(yyyy);
	ms.setUTCMonth(mm);
	ms.setUTCDate(dd);
	ms.setUTCHours(hh);
	ms.setUTCMinutes(mi);
	ms.setUTCSeconds(ss);
	ms.setUTCMilliseconds(0);
	ms.setUTCHours(hh+DaylightSavingsOffset(ms,timeZone));
	utcOffset = utcOffsetHours;
	if (utcOffset < 0) utcOffset = utcOffset - (utcOffsetMinutes/60);
	else			   utcOffset = utcOffset + (utcOffsetMinutes/60);
	utcOffset = utcOffset + DaylightSavingsOffset(ms,timeZone);
	return({ GMT: ms.getTime(),
			 errCode: "",
			 jqObject: null,
			 utcOffset: utcOffset
	});
}


function DaylightSavingsOffset(ms,timeZone) {
	var date = new Date(ms);
	if (date.getUTCFullYear() < 1950) return 0;
	return 0; // obviously this will need some work!
}

function secondsPerUnitTime (timeUnit) {
	var secondsPerYear = 365.25 * 24 * 60 * 60;
	var secondsPerHour = 60 * 60;
	switch (timeUnit) {
		case "millennium" :
			return 1000 * secondsPerYear;
		case "century":
			return 100 * secondsPerYear;
		case "decade":
			return 10 * secondsPerYear;
		case "year":
			return secondsPerYear;
		case "month":
			return secondsPerYear/12;
		case "week":
			return 7 * 24 * secondsPerHour;
		case "day":
			return 24 * secondsPerHour;
		case "hour":
			return secondsPerHour;
		case "minute":
			return 60;
		case "second":
			return 1;
	}	
}

function ClockRate (historicalDeltaTAmount,historicalDeltaTUnit,wallClockDeltaTAmount,wallClockDeltaTUnit) {
	this.historicalDeltaTAmount = historicalDeltaTAmount;
	this.historicalDeltaTUnit = historicalDeltaTUnit;
	this.wallClockDeltaTAmount = wallClockDeltaTAmount;
	this.wallClockDeltaTUnit = wallClockDeltaTUnit;
	this.impliedClockRateInSeconds = function() {
		return new ClockRate((this.historicalDeltaTAmount * secondsPerUnitTime(this.historicalDeltaTUnit))/(this.wallClockDeltaTAmount * secondsPerUnitTime(this.wallClockDeltaTUnit)),"second",1,"second");
	}
	
	this.stringifyClockRate = function () {
		var r = {};
		r.historicalDeltaTAmount = this.historicalDeltaTAmount;
		r.historicalDeltaTUnit = this.historicalDeltaTUnit;
		r.wallClockDeltaTAmount = this.wallClockDeltaTAmount;
		r.wallClockDeltaTUnit = this.wallClockDeltaTUnit;
		return r;
	}
}

function Clock (clockRate, currentHistoricalTime) {
	// this.currentHT = typeof currentHistoricalTime !== 'undefined' ? currentHistoricalTime : "HTNotSet";
	this.clockRateNominal = clockRate;
	this.clockRateImplied = clockRate.impliedClockRateInSeconds();
	
	this.stringifyClock = function () {
		var c = {};
		c.currentHT = this.currentHT;
		c.clockRateNominal = this.clockRateNominal.stringifyClockRate();
		c.clockRateImplied = this.clockRateImplied.stringifyClockRate();
		return c;
	}
}

function Timeline (ID, title, description, enabled, displayPathEventNames, begin, end, clock, utcOffset,timeZone,format,start_desc,end_desc,startSoundtrack, endSoundtrack, externalFileList) {
	if (displayPathEventNames == undefined) displayPathEventNames = true;
	this.ID = ID;
	this.title = title;
	this.description = description;
	this.enabled = enabled;
	this.displayPathEventNames = displayPathEventNames; // Controls whether to display the hover window showing a path event's name while the icon 
														// to which it is attached is moving.  If there are a lot of concurrent path events, displaying the 
														// hover windows for all of them can cause them to appear jittery, which is highly distracting.  Eventually, 
														// running HiM on a faster processor will solve the problem.
	this.begin = begin;
	this.end = end;
	this.clock = clock;
    this.utcOffset = utcOffset;
    this.timeZone = (timeZone != undefined) ? timeZone : "Eastern (UTC-5)";
    if (format != undefined) this.format = format;
    this.start_desc = (start_desc != undefined) ? start_desc : "";
    this.end_desc = (end_desc != undefined) ? end_desc : "";
    this.externalFileList =	(externalFileList != undefined) ? externalFileList : [];
    // See Scenario for explanation of Soundtracks.
    this.startSoundtrack = (startSoundtrack != undefined) ? startSoundtrack : "";
	this.endSoundtrack = (endSoundtrack != undefined) ? endSoundtrack : "";
	
	// convertPositionToHistoricalDate takes a position on the jQuery slider at #slider-box and converts it to a HistoricalDate
	
	this.convertPositionToHistoricalDate = function (pos) {
		var s					= $("#slider-box");
		var pctOfSliderPassed 	= pos/s.slider("option","max");
		var tlDurationInMsec	= s.data("tlDuration") * 1000;
		// Figure the amount of the TL's duration that has passed and add it to the TL's start GMT. 
		return new HistoricalDate(this.begin.GMT + (pctOfSliderPassed * tlDurationInMsec), false);
	}
	
	// convertHistoricalDateToPosition takes a HistoricalDate and coverts it to a position on the jQuery slider at #slider-box.
	
	this.convertHistoricalDateToPosition = function (hd) {
		var s					= $("#slider-box");
		var tlDurationInMsec	= s.data("tlDuration") * 1000;
		var max					= s.slider("option","max");
		var pctOfDurationPassed	= this.begin.calculateHistoricalDuration(hd)/tlDurationInMsec;
		return max * pctOfDurationPassed;
	}
	
	this.stringifyTimeline = function () {
		var t = {};
		t.ID = this.ID;
		t.title = this.title;
		t.description = this.description;
		t.enabled = this.enabled;
		t.displayPathEventNames = this.displayPathEventNames;
		t.begin = this.begin.stringifyHistoricalDate();
		t.end = this.end.stringifyHistoricalDate();
		t.clock = this.clock.stringifyClock();
		t.utcOffset = this.utcOffset;
		t.timeZone = this.timeZone;
		if (this.format != undefined) t.format = this.format;
		t.start_desc = this.start_desc;
		t.end_desc = this.end_desc;
		t.externalFileList = this.externalFileList;
		t.startSoundtrack = this.startSoundtrack;
		t.endSoundtrack = this.endSoundtrack;
		return t;
	}
}

function Scenario (name, author, copyright, changeDates, mapDefinition, locations, events, begin, end, timelines, defaultEra, defaultTimeZone,format,SSIL, 
					start_desc,end_desc,startSoundtrack, endSoundtrack, externalFileList) {
	this.scName	= name;					// Scenario name
	this.scAuthor = author;				// Scenario author
	this.scCopyright = copyright;		// Copyright
	this.scChangeDates = changeDates;	// Dates of creation, last opened, last modified (creationDate, lastOpenedDate, lastModifiedDate  -- all are Date objects)
	this.scMapCenter = mapDefinition.mapCenter;		// GM LatLng for map center
	this.scMapZoom = mapDefinition.mapZoom;			// Initial zoom value for the map
	if (mapDefinition.mapID) 		this.scMapID = mapDefinition.mapID;
	if (mapDefinition.mapLayerKeys) this.scMapLayerKeys = mapDefinition.mapLayerKeys;
	this.scHistoricalMapListIndex = mapDefinition.historicalMapListIndex;
	this.scLocations = locations;		// Scenario locations (not events, just fixed placemarks)
										// Scenario events (array) -- MUST BE SORTED EARLIEST TO LATEST!

	this.scEvents = events;				
	this.scBegin = begin;				// HistoricalDate for start of Scenario
	this.scEnd = end;					// HistoricalDate for end of Scenario
	this.scTimelines = timelines;		// Scenario timelines (array)
	this.scDefaultEra = defaultEra;		// "CE" or "BCE"
	this.scDefaultTimeZone = (defaultTimeZone != undefined) ? defaultTimeZone : "Eastern (UTC-5)";
	this.scUTCOffset = getUTCOffset(defaultTimeZone);
	this.scFormat = format;
	this.scSSIL = SSIL;					// Scenario-specific icon library
	this.scStartDesc = (start_desc != undefined) ? start_desc : "";
	this.scEndDesc = (end_desc != undefined) ? end_desc : "";
	this.scExternalFileList = (externalFileList != undefined) ? externalFileList : [];
	
	// A soundtrack can be associated with a start or end context.  It is an HTML string that can be used to play the soundtrack.  For audio and 
	// video files that the user uploads, these will be <audio> and <video> tags.  For audio or video found on the Internet, these will be held in 
	// <iframe> tags.
	
	this.scStartSoundtrack = (startSoundtrack != undefined) ? startSoundtrack : "";
	this.scEndSoundtrack = (endSoundtrack != undefined) ? endSoundtrack : "";
	
	// "stringifyScenario" is a function to take a Scenario and prepares it to be stringified by JSON.stringify.  In particular, all
	// circular dependencies must be removed.  There are various algorithms that supposedly will do this, but I (PMC) can't
	// get them to work.  Besides, there are lots of Javascript details (e.g., all the functions associated with the object that are 
	// added to a Scenario which really could be taken out when stringifying it.  So stringifyScenario "unmakes" the Scenario object 
	// into a simple object with no associated functions or circularities.
	
	this.stringifyScenario = function () {
		var s = {};		// This will be the stringified Scenario
		s.scName = this.scName;
		s.scAuthor = this.scAuthor;
		s.scCopyright = this.scCopyright;
		s.scChangeDates = this.scChangeDates;
		s.scMapCenter = {
			"lat": this.scMapCenter.lat(),
			"lng": this.scMapCenter.lng()
		};
		s.scMapZoom = this.scMapZoom;
		if (this.scMapID)			s.scMapID = this.scMapID;
		if (this.scMapLayerKeys)	s.scMapLayerKeys = this.scMapLayerKeys;
		if (this.scHistoricalMapListIndex) s.scHistoricalMapListIndex = this.scHistoricalMapListIndex;
		
		// For the locations and events, each one might have a GM marker, path, or polygon as part of it.  We just want to keep the 
		// data  that is already in JSON form and NOT the GM object.  The marker, path, or polygon will be recreated when the stringified, 
		// JSONified object is read in again when the user wants to run/edit the scenario.  (Leaving the marker in may lead to circularities.)
		
		s.scLocations = [];
		s.scEvents = [];
		for (var i=0; i < this.scLocations.length; i++) { s.scLocations[i] 	= this.scLocations[i].stringifyHistoricalEvent(); }
		for (var i=0; i < this.scEvents.length; i++) 	{ s.scEvents[i] 	= this.scEvents[i].stringifyHistoricalEvent(); }
		s.scBegin = this.scBegin.stringifyHistoricalDate();
		s.scEnd = this.scEnd.stringifyHistoricalDate();
		s.scTimelines = [];
		for (var i=0; i < this.scTimelines.length; i++) { s.scTimelines[i] = this.scTimelines[i].stringifyTimeline(); }
		s.scDefaultEra = this.scDefaultEra;
		s.scDefaultTimeZone = this.scDefaultTimeZone;
		s.scUTCOffset = this.scUTCOffset;
		s.scFormat = this.scFormat;
		s.scSSIL = this.scSSIL;
		s.scStartDesc = this.scStartDesc;
		s.scEndDesc = this.scEndDesc;
		s.scExternalFileList = this.scExternalFileList;
		s.scStartSoundtrack = this.scStartSoundtrack;
		s.scEndSoundtrack = this.scEndSoundtrack;
		return s;
	}
	
	// Add an icon to the scenario's SSIL array
	
	this.addToSSIL = function (icon) {
		this.scSSIL.push(icon);
	}
	
	// Remove an icon from the scenario's SSIL array 
	
	this.removeFromSSIL = function (icon) {
		var SSIL = this.scSSIL;
		removeIconFromSet(SSIL,icon);
	}
	
	// insertEvent takes a HistoricalEvent (either an event or fixed location) and inserts it into the scenario.  Fixed locations are just 
	// inserted into the array scLocations.  If it is a time-bound event, then insert it into the array scEvents such that it is in order by 
	// event start time (i.e., scEvents[0] is the earliest-starting event and scEvents[scEvents.length-1] is the latest.
	
	this.insertEvent = function (event) {
		if (!event.has_dates) {
			this.scLocations[this.scLocations.length] = event;
			return;
		}
		var index = 0;
		var found = false;
		for (var i=0; i < this.scEvents.length; i++) {
			if (event.begin.compareHistoricalDate(this.scEvents[i].begin) == "before") {
				index = i;
				found = true;
				break;
			}
		}
		if (!found) this.scEvents[this.scEvents.length] = event; // insert event at the end of all the others
		else {  // Insert the event before the first one with a later start time, and move all the following events one spot down the array
			var k = this.scEvents.length; k--;
			for (var j = k; j >= index; j--) this.scEvents[j+1] = this.scEvents[j];
			this.scEvents[index] = event;
		}
		if (event.begin.compareHistoricalDate(this.scBegin) == "before") this.scBegin = event.begin; // Update scenario begin & end times, if necessary
		if (event.end.compareHistoricalDate(this.scEnd) == "after") this.scEnd = event.end;
		this.scChangeDates.lastModifiedDate = new Date(); // Update time of last edit
		this.updateFullScenarioTimeline();
	}
	
	// deleteEvent takes an eventID and deletes the HistoricalEvent (either an event or fixed location) from the scenario (either the scLocations or
	// scEvents array).   
	
	this.deleteEvent = function (eventID) {
		var result = this.findEvent(eventID);	
		if (result.fixedLocation) {
			for (var i = result.index; i < this.scLocations.length; i++) {
				this.scLocations[i] = this.scLocations[i+1];
			}
			this.scLocations.pop();
		}
		else {
			for (var i = result.index; i < this.scEvents.length; i++) {
				this.scEvents[i] = this.scEvents[i+1];
			}
			this.scEvents.pop();
			if (this.scEvents.length == 0) {
				this.scBegin = new HistoricalDate(maxHistoricalDate(),false);
				this.scEnd = new HistoricalDate(minHistoricalDate(),false);
			}
			else {
				var k = this.scEvents.length;
				if (this.scEvents[0].begin.compareHistoricalDate(this.scBegin) == "after") this.scBegin = this.scEvents[0].begin; // Update scenario begin & end times, if necessary
				if (this.scEvents[k-1].end.compareHistoricalDate(this.scEnd) == "before") this.scEnd = this.scEvents[k-1].end;
			}
			this.scChangeDates.lastModifiedDate = new Date(); // Update time of last edit
			this.updateFullScenarioTimeline();
		}
	}
	
	// findEvent takes an eventID and returns the following object:
	//		{ fixedLocation:	true if this event has no start and end times, false otherwise (i.e., it is a real time-bound event)
	//		  index:			index in scLocations or scEvents where the event was found, or -1 if not found
	//		  event:			the HistoricalEvent whose eventID == the parameter
	//		  type:				"Point Event", "Path Event", "Area Event" (or null, but this should never happen)
	//		}
	// Note that index == -1 means there is a bug in HiM.  This situation should never arise.
	// if (fixedLocation) then scLocations[index] is the event.  Otherwise scEvents[index] is the event.
	// The eventID is a random number that is meant to uniquely identify an event within a scenario while the scenario is loaded in memory.  It is not
	// saved to the database but is regenerated every time the scenario is loaded into memory.
	
	this.findEvent = function (eventID) {
		var result;
		for (var i = 0; i < this.scLocations.length; i++) {
			if (this.scLocations[i].eventID == eventID) { 
				result = { fixedLocation: true, index: i, event: this.scLocations[i] };
				if (result.event.lat) result.type = "Point Event";
				else if (result.event.path) result.type = "Path Event";
				else if (result.event.polygon) result.type = "Area Event";
				else result.type = null; //SHOULD NEVER HAPPEN!!
				return result;
			}
		}
		for (var i = 0; i < this.scEvents.length; i++) {
			if (this.scEvents[i].eventID == eventID) {
				result = { fixedLocation: false, index: i, event: this.scEvents[i] };
				if (result.event.lat) result.type = "Point Event";
				else if (result.event.path) result.type = "Path Event";
				else if (result.event.polygon) result.type = "Area Event";
				else result.type = null; //SHOULD NEVER HAPPEN!!
				return result;
			}
		}
		return { fixedLocation: true, index: -1, event: null, type: null };
	}
	
	// updateFullScenarioTimeline is called whenever an event (not a fixed location) is added to or removed from the a scenario (i.e., from insertEvent or deleteEvent).
	// Its purpose is to create and maintain a distinguished timeline called "Full Scenario" which spans the time from the start of the earliest event to the end of the
	// latest event, and to have a clock rate such that that span of historical time can be covered in one minute of wall clock time (the clock rate can, of course,
	// be edited by the user).  
	//
	// If "Full Scenario" (FS) doesn't exist, create it; or if it exists and the last event was just deleted, delete it.  Otherwise, check to see if the time span
	// (and therefore the clock rate) needs to be adjusted, and do it.
	//
	// Note that even though the scenario is being changed (by having the Full Scenario timeline modified or created), there is no need to explicitly save the
	// scenario to the server.  The code in "main" that invoked insertEvent or deleteEvent will save the scenario.

	this.updateFullScenarioTimeline = function () {
		var index = -1;	// Find the Full Scenario TL (may or may not be one for this scenario)
		var maxID = -1; // Find the highest TL ID while we're at it (may not be one)
		var FullScenarioTL;
		for (var i=0; i < this.scTimelines.length; i++) {
			if (this.scTimelines[i].title == "Full Scenario") index = i;
			maxID = (this.scTimelines[i].ID > maxID) ? this.scTimelines[i].ID : maxID;
		}
		if (this.scEvents.length == 0) {	// Last event in scenario was deleted, so delete the Full Scenario TL
			if (index > -1) {	// Remove Full Scenario TL from list of scenario TLs
				for (var i=index; i < this.scTimelines.length; i++) {
					this.scTimelines[i] = this.scTimelines[i+1];
				}
				this.scTimelines.pop();	
				
				// If Full Scenario was the last TL, clear up several things now that the scenario has no TLs.
				//		1. Blank out any previously displayed time
				//		2. Set time slider position to 0
				//		3. Remove any data associated with previous timeline
				//		4. Set timeline ID to bogus value (-1) so initial timeline choice will force the setup of execution parameters 
				//		5. Remove keypress event handler for advancing to next event or unit of time, because there are no events or timelines with durations 
				//		6. Remove click event handler for timeline selection
				//		7. Disable the timeline play button
				//		8. Remove "Full Scenario" as an option on the timeline selection dropdown
				
				if (this.scTimelines.length == 0) {	
					$('#current_time').text("");   	
					$("#slider-box").slider({
										value: 0,
										max: 0,
										min: 0
									}).removeData().data("timelineID", -1);  
					$(document).unbind("keydown"); 
					$('#Select_Timeline_Form').unbind("change");
					$('#play_button').button("disable");
					$('#Select_Timeline').empty();  
				}
				return;
			}
		}
		
		// One or more events exist for this scenario, so find (or create) Full Scenario and extend (or initialize) it accordingly with
		// the earliest start time and latest end time of the scenario.
		
		if (index == -1) { 
			var lastTLindex = this.scTimelines.length;
			this.scTimelines[lastTLindex] = new Timeline(maxID+1,		// Must create Full Scenario TL
														   "Full Scenario",
														   "Timeline covering the entire time span of '" + this.scName + "'",
														   true,
														   true,
														   this.scBegin,
														   this.scEnd,	
														   new Clock(new ClockRate(this.scBegin.calculateHistoricalDuration(this.scEnd)/1000,"second",1,"minute")),
														   this.scUTCOffset,
														   this.scDefaultTimeZone);
		}
		else {
			this.scTimelines[index].begin = this.scBegin;
			this.scTimelines[index].end = this.scEnd;
			this.scTimelines[index].clock = new Clock(new ClockRate(this.scBegin.calculateHistoricalDuration(this.scEnd)/1000,"second",1,"minute"));
		}
	}
	
	// insertTimeline inserts a timeline into the scenario.  It takes a timeline as the argument.
	
	this.insertTimeline = function (tl) {
		var index = this.scTimelines.length;
		for (var i=0; i < this.scTimelines.length; i++) {
			if (this.scTimelines[i].ID == tl.ID) {
				index = i;
				break;
			}
		}
		this.scTimelines[index] = tl;
	}
	
	// deleteTimeline deletes a timeline from the scenario and moves the timelines in the array so there is no gap.  It takes the timeline ID as the argument.
	
	this.deleteTimeline = function (tlID) {
		var index;
		for (var i=0; i < this.scTimelines.length; i++) {
			if (this.scTimelines[i].ID == tlID) {
				index = i;
				break;
			}
		}
		var k = this.scTimelines.length;
		for (var i = index; i < k-1; i++) {
			this.scTimelines[i] = this.scTimelines[i+1];
		}
		this.scTimelines.pop();
	}
	
	// calculateGrowthIncrements goes through the list of events for this scenario and for each path or area event it invokes the appropriate
	// calculateGrowthIncrements function for that event.  For details see those functions under HistoricalEvent.
	
	this.calculateGrowthIncrements = function (baseInterval,impliedClockRate,maxPolygons) {
		var scenario = this; // Need to get the scenario explicitly; otherwise "this" doesn't work in the polygon case to invoke findEvent
		this.scEvents.forEach(function(historicalEvent) {
									if (historicalEvent.path) {	// Only do this for paths which have an icon style other than arrow.  Since arrow animation 
															    // is done by GM itself, there is no need for HiM to do any work.
										if (historicalEvent.animationIconStyle != "Arrow (entire path only)") historicalEvent.calculateGrowthIncrements(baseInterval,impliedClockRate);
									}
									else if (historicalEvent.polygon) {
										if (historicalEvent.animationTargetAreaEvent < 0) return; // There is no target, so no animation for this area event
										var r = scenario.findEvent(historicalEvent.animationTargetAreaEvent);
										if (r.index < 0) throw 'Could not find event with ID ' + historicalEvent.animationTargetAreaEvent + " in this scenario";
										historicalEvent.calculateGrowthPolygons(baseInterval,impliedClockRate,r.event,maxPolygons);
									}
								});
	}
}

// HistoricalEvent represents either a time-bound historical event or a location which is not time-bound.  The latter is actually an event whose
// start and end times are the start and end times of the scenario, and therefore a location is always visible no matter what time it is.
// (For efficiency, locations are kept separate from events in the Scenario object.)  
//
// The HistoricalEvent function takes an "option" object and a Google Maps map which is the basis for the scenario.  It returns a
// HistoricalEvent object, which includes the GM object (a marker, polyline, or polygon) needed to represent the event or location in Google Maps.

function HistoricalEvent(options, map) {
								  this.name 		= options.name;
	if (options.description)	{ this.description  = options.description; }
	else						{ this.description	= ""; }
	if (options.externalFileList)	{ this.externalFileList = options.externalFileList; } // Array of ExternalFiles (e.g., images uploaded from user's local file storage) that are referenced in the description
	else							  this.externalFileList = [];
	if (options.has_dates)		{ this.has_dates	= options.has_dates; }
	if (options.image)			{ this.image 		= options.image; }
	if (options.tag)			{ this.tag	 		= options.tag; }
	if (options.color)			{ this.color		= options.color; }
	if (options.weight)			{ this.weight		= options.weight; }
	if (options.opacity)		{ this.opacity		= options.opacity; }
	if (options.fillColor)		{ this.fillColor	= options.fillColor; }
	if (options.fillOpacity)	{ this.fillOpacity	= options.fillOpacity; }
	if (options.begin)			{ this.begin 		= new HistoricalDate(options.begin.GMT, options.begin.circa); } 
	if (options.end)			{ this.end 			= new HistoricalDate(options.end.GMT, options.end.circa); } 
	if (options.timeZone)		{ this.timeZone		= options.timeZone; }
	this.eventID				= (options.eventID) ? options.eventID : Math.random();						
	if (options.lat) { 
								  this.lat 			= options.lat; 
								  this.lng 			= options.lng; 
								  this.marker 		= new google.maps.Marker({
            												title:  options.name,
           													visible: false,
           													draggable: false,
            												position: new google.maps.LatLng(
               	 															parseFloat(options.lat, 10),
                															parseFloat(options.lng, 10)),
            																map: map
       	 									        				  });	
       	 						  if (options.image) { // Include specific placemark icon if it's not the standard GM pushpin
       	 								this.marker.setIcon({
																url: options.image
															});  
       	 						}
	}
	else if (options.path) 	{ 
								  // Not clear why this should happen, but it appears that in some polylines, points are being replicated.  Filter out 
								  // these duplicate points from the polyline.
								  var lastLat, lastLng;
								  var index = 0;
								  var filteredPolyline = [];
       	 						  for (var j=0; j < options.path.length; j++) {
       	 						  		if (j > 0) {
       	 						  			if ((lastLat == options.path[j].lat) && (lastLng == options.path[j].lng)) continue;
       	 						  			else {
       	 						  				lastLat = options.path[j].lat;
       	 						  				lastLng = options.path[j].lng;
       	 						  			}
       	 						  		}
       	 						  		else {
       	 						  			lastLat = options.path[0].lat;
       	 						  			lastLng = options.path[0].lng;
       	 						  		}
       	 						  		filteredPolyline[index] = options.path[j];
       	 								index++;
       	 						  }
       	 						  this.path = filteredPolyline;
								  var latLngArray = [];
       	 						  for (var j=0; j < filteredPolyline.length; j++) {
       	 								latLngArray[j] = new google.maps.LatLng(filteredPolyline[j].lat, filteredPolyline[j].lng);
       	 						  }
       	 						  var color = (options.color) ? options.color : "#FF0000";
       	 						  var weight = (options.weight) ? options.weight : 2;
       	 						  var opacity = (options.opacity) ? options.opacity : 1.0;
       	 						  this.polyline = new google.maps.Polyline({
    																path: latLngArray,
    																visible: false,
    																strokeColor: color,
    																strokeOpacity: opacity,
    																strokeWeight: weight,
    																map: map
       	 									  		});
       	 						  this.animationIconStyle = (options.animationIconStyle) ? options.animationIconStyle : "Arrow (entire path only)";
       	 						  this.animationIcon = (options.animationIcon) ? options.animationIcon : ""; // URL of custom icon, if custom is specified
       	 						  this.animationPathChoice = (options.animationPathChoice) ? options.animationPathChoice : "Entire path";
	}
	else if (options.polygon)	{  
								  // Not clear why this should happen, but it appears that in some polygons, points are being replicated.  Filter out 
								  // these duplicate points from the polygon.
								  var lastLat, lastLng;
								  var index = 0;
								  var filteredPolygon = [];
       	 						  for (var j=0; j < options.polygon.length; j++) {
       	 						  		if (j > 0) {
       	 						  			if ((lastLat == options.polygon[j].lat) && (lastLng == options.polygon[j].lng)) continue;
       	 						  			else {
       	 						  				lastLat = options.polygon[j].lat;
       	 						  				lastLng = options.polygon[j].lng;
       	 						  			}
       	 						  		}
       	 						  		else {
       	 						  			lastLat = options.polygon[0].lat;
       	 						  			lastLng = options.polygon[0].lng;
       	 						  		}
       	 						  		filteredPolygon[index] = options.polygon[j];
       	 								index++;
       	 						  }
       	 						  this.polygon = filteredPolygon;
       	 						  var latLngArray = [];
       	 						  for (var j = 0; j < filteredPolygon.length; j++) {
       	 						  		latLngArray[j] = new google.maps.LatLng(filteredPolygon[j].lat, filteredPolygon[j].lng);
       	 						  }
       	 						  var color = (options.color) ? options.color : "#FF0000";
       	 						  var weight = (options.weight) ? options.weight : 2;
       	 						  var opacity = (options.opacity) ? options.opacity : 0.8;
       	 						  var fillColor = (options.fillColor) ? options.fillColor : "#FF0000";
       	 						  var fillOpacity = (options.fillOpacity) ? options.fillOpacity : 0.35;
       	 						  this.GMpolygon = new google.maps.Polygon({
    																paths: latLngArray,
    																visible: false,
    																strokeColor: color,
    																strokeOpacity: opacity,
   			 														strokeWeight: weight,
    																fillColor: fillColor,
    																fillOpacity: fillOpacity,
    																map: map
       	 											});
       	 						 this.animationTargetAreaEvent = (options.animationTargetAreaEvent) ? options.animationTargetAreaEvent : -1;
       	 						 this.animationFillPath = (options.animationFillPath) ? options.animationFillPath : false;
       	 						 this.animationSourceAreaEvent = (options.animationSourceAreaEvent) ? options.animationSourceAreaEvent : [];
       	 						 if (this.image) {
       	 						 	var maxLat = options.polygon[0].lat;		
									var minLat = maxLat;
									var maxLng = options.polygon[0].lng;
									var minLng = maxLng;
									for (var i=0; i < options.polygon.length; i++) {
										if 		(options.polygon[i].lat > maxLat) maxLat = options.polygon[i].lat;
										else if (options.polygon[i].lat < minLat) minLat = options.polygon[i].lat;
										if 		(options.polygon[i].lng > maxLng) maxLng = options.polygon[i].lng;
										else if (options.polygon[i].lng < minLng) minLng = options.polygon[i].lng;
									}
       	 						 	this.AEmarker = new google.maps.Marker({
															title:  options.name,
															visible: false,
															draggable: false,
															position: new google.maps.LatLng((maxLat+minLat)/2,(maxLng+minLng)/2),
															icon: this.image,
															map: map
														 });	
       	 						 }
	}
	
	this.stringifyHistoricalEvent = function() {
		var s = {}; 
		if (this.description) 	{ s.description	= this.description; }
		if (this.externalFileList) { s.externalFileList = this.externalFileList; }
		if (this.has_dates)  	{ s.has_dates 	= this.has_dates; }
		if (this.eventID)		{ s.eventID		= this.eventID; }
		if (this.lat)  { 
								  s.lat 		= this.lat;
			       				  s.lng 		= this.lng;
		}
		else if (this.path)		{ 
								  s.path 				= this.path; 
								  s.weight	 			= this.weight;
								  s.color	 			= this.color;
								  s.opacity				= this.opacity;
								  s.animationIcon 		= this.animationIcon;
								  s.animationIconStyle	= this.animationIconStyle;
								  s.animationPathChoice	= this.animationPathChoice;
		}
		else if (this.polygon) 	{ 
								  s.polygon 	= this.polygon; 
								  s.weight	 	= this.GMpolygon.strokeWeight;
								  s.color	 	= this.GMpolygon.strokeColor;
								  s.opacity		= this.GMpolygon.strokeOpacity;
								  s.fillColor	= this.GMpolygon.fillColor;
								  s.fillOpacity	= this.GMpolygon.fillOpacity;
								  s.animationTargetAreaEvent = this.animationTargetAreaEvent;
								  s.animationFillPath 		 = this.animationFillPath;
								  s.animationSourceAreaEvent = this.animationSourceAreaEvent;
		}
		if (this.image) 		{ s.image 		= this.image; }
		if (this.tag) 			{ s.tag 		= this.tag; }
		if (this.name) 			{ s.name 		= this.name; }
		if (this.begin) 		{ s.begin 		= this.begin.stringifyHistoricalDate(); }
		if (this.end)   		{ s.end   		= this.end.stringifyHistoricalDate(); }
		if (this.timeZone)		{ s.timeZone 	= this.timeZone; }
		else				    { s.timeZone	= "Eastern (UTC-5)"; }
		return s;
	}
	
	// getUTCOffsetInHours returns the UTC offset in hours for this event.  It may be a real number, since some timezones have 
	// fractional hours as part of their offset.
	
	this.getUTCOffsetInHours = function () {
		return(getUTCOffset(this.timeZone));
	}
	
	// Find "center" of area event and return an object {centerLat: lat, centerLng: lng} as result.
	// (Both lat and lng are numbers, not GM Lat or Lng objects.)
	
	this.findCenter = function () {		
		var maxLat = this.polygon[0].lat;		
		var minLat = maxLat;
		var maxLng = this.polygon[0].lng;
		var minLng = maxLng;
		for (var i=0; i < this.polygon.length; i++) {
			if 		(this.polygon[i].lat > maxLat) maxLat = this.polygon[i].lat;
			else if (this.polygon[i].lat < minLat) minLat = this.polygon[i].lat;
			if 		(this.polygon[i].lng > maxLng) maxLng = this.polygon[i].lng;
			else if (this.polygon[i].lng < minLng) minLng = this.polygon[i].lng;
		}
		return { centerLat: (maxLat + minLat)/2, centerLng: (maxLng + minLng)/2 };
	}
	
	// calculateGrowthIncrements operates on path events.  It sets up the event so that when the current timeline is played, the 
	// event's geometry will move or expand smoothly according to the animation parameters of the event.  This only happens if the event's animation 
	// parameters are set to something OTHER than arrow as the animation style AND the full path as the scope of the animation.  That animation is
	// handled directly by GM.  HiM handles all other cases.
	//
	// For paths, the algorithm is as follows:
	//		0. Assume the path P is broken up into N segments with points p[0],...,p[n-1].  A segment i of that path starts at point 
	//		   p[i] and extends to point p[i+1].
	//		1. For each segment i of the path, calculate the distance d[i] represented by that segment. Let D = sum(d[i]).
	//		2. Calculate the duration in historical time (msec) of the entire path event; call this DUR.
	//		3. For each segment i of the path:
	//			3.1. The historical time (msec) needed to traverse that segment is ht[i] = DUR * (d[i]/D).
	//			3.2. The wall clock time (sec) needed to traverse that segment is wt[i] = ht[i]/impliedClockRate.  (Recall that the impliedClockRate is a 
	//				 ClockRate whose historicalDeltaTAmount effectively gives the number of historical seconds that pass in one wall-clock second, for 
	//               the current timeline.)
	//			3.3. The number of increments to divide segment i into is n[i] = Math.round(wt[i] * (1000/baseInterval)).
	//			3.4. Compute the lat/lng increments for segment i:
	//					3.4.1. deltaLat = (p[i+1].lat - p[i].lat)/n[i] 
	//					3.4.2. deltaLng = (p[i+1].lng - p[i].lng)/n[i] 
	//			3.5. Populate the next n[i] elements of the historical event's pathSubsegments array with an object consisting of two elements: 
	//					3.5.1. The historical date at which this subsegment begins, which is Start(P) + (sum(0 <= k < i)[ht(k)]) + (j * (ht(i)/n(i))), where
	//							3.5.1.1. Start(P) is the starting historical date of the path event 
	//							3.5.1.2. (sum(0 <= k < i)[ht(k)]) is the sum of the durations of the (i-1) preceding path segments 
	//							3.5.1.3. 0 <= j < n(i) is the j-th subsegment within the i-th path segment 
	//							3.5.1.4. ht(i)/n(i) is the historical duration of each of the subsegments in the i-th path segment
	//					3.5.2. A GM LatLng object made from (p[i].lat + j * deltaLat) and (p[i].lng + j * deltaLng) for 0 <= j < n[i].
	//		4. For all the objects in the pathSubsegments array, add two elements:
	//			4.1 A GM Polyline object with one segment, namely, the one whose LatLngs are those in the i-th and (i+1)-st array elements.
	//			4.2 The slider position (on the current timeline) of the historical date represented by this subsegment's begin date.
	//		5. Set the HistoricalDate object's lastSubsegmentIndex to 0.  This is the last subsegment that has been processed during an invocation of 
	//		   setTimePosition in main.  Set its lastSubsegmentIndexSliderPos to whatever the slider position is for element 0 of pathSubsegments.
	//
	// calculateGrowthIncrements is called at two times: 
	//		1. Whenever a new timeline is selected (i.e., when $("#Select_Timeline").on("change") is triggered.
	//		2. Whenever a path or area event is edited, and a timeline exists.  (If a TL doesn't exist, we know case (1) will be triggered *before* 
	//         a timeline can be run and the refinement of the path into subsegments has to be used.)
	//
	// Parameters:
	//		baseInterval		Number of msec HiM sleeps between updates of the time slider 
	//		impliedClockRate	a ClockRate giving the number of historical seconds that pass in one wall-clock second.
	
	this.calculateGrowthIncrements = function (baseInterval, impliedClockRate) {
		if (this.animationIconStyle == "Arrow (entire path only)") {
			if (this.pathSubsegments) { // Before refining the path into subsegments, turn off visibility of any previous subsegments
				var limit = this.pathSubsegments.length - 1;
				for (var i = 0; i < limit; i++) this.pathSubsegments[i].GMsegment.setMap(null);
			}
			this.pathSubsegments = new Array(); // For arrow animation by GM, we don't need subsegments 
			return;
		}
		impliedClockRateInSeconds = impliedClockRate.historicalDeltaTAmount;
		var polyPath = this.polyline.getPath();
		if (this.pathSubsegments) { // Before refining the path into subsegments, turn off visibility of any previous subsegments
			var limit = this.pathSubsegments.length - 1;
			for (var i = 0; i < limit; i++) this.pathSubsegments[i].GMsegment.setMap(null);
		}
		this.pathSubsegments = new Array(); // Holds all the subsegments the path event will br broken into
		var D = 0;
		var limit = this.path.length - 1;
		for (var i=0; i < limit; i++) {
			D = D + computeDistanceBetween(polyPath.getAt(i),polyPath.getAt(i+1));
		}
		var DUR = this.begin.calculateHistoricalDuration(this.end)/1000; // Historical duration of the entire path event in seconds
		var d;	// Distance of one path segment
		var ht; // Historical duration in seconds of one path segment 
		var wt; // Wall-clock duration in seconds of one path segment 
		var n;  // Number of subsegments to divide this segment into 
		var deltaLat, deltaLng; // Lat/lng increments for this segment 
		var index = 0; // Running index into this.pathSubsegments array 
		var totalSubsegmentsSoFar = 0; // Total number of subsegments prior to the segment currently being divided up
		var totalDurationSoFar = 0; // Total historical duration in msec of subsegments prior to the segment currently being divided up
		var tl = $("#slider-box").data("timeline");
		for (var i=0; i < limit; i++) {	// Compute the length of segment i of the path between points p[i] and p[i+1]
			d = computeDistanceBetween(polyPath.getAt(i),polyPath.getAt(i+1));
			ht = DUR * (d/D);
			wt = ht/impliedClockRateInSeconds;
			n = Math.round(wt * (1000/baseInterval));
			if (n == 0) n = 1; 
			deltaLat =  (this.path[i+1].lat - this.path[i].lat)/n;
			deltaLng =  (this.path[i+1].lng - this.path[i].lng)/n;
			for (var j=0; j < n; j++) {
				this.pathSubsegments[index] =  { latLng: new google.maps.LatLng(this.path[i].lat + (j * deltaLat),
																	            this.path[i].lng + (j * deltaLng)),
												 begin: new HistoricalDate(this.begin.GMT + totalDurationSoFar + (j * ((ht * 1000)/n)),false)
											   };
				index++;
			}
			totalSubsegmentsSoFar = totalSubsegmentsSoFar + n;
			totalDurationSoFar = totalDurationSoFar + (ht*1000);
		}
		var map = this.polyline.getMap();
		limit = this.pathSubsegments.length - 1;
		for (var i=0; i < limit; i++) {
			var path = [ this.pathSubsegments[i].latLng, this.pathSubsegments[i+1].latLng ];
			this.pathSubsegments[i].GMsegment = new google.maps.Polyline({	clickable: 		false,
																			path: 			path,
																			strokeColor:	this.color,
																			strokeWeight:	this.weight,
																			strokeOpacity:	(this.opacity) ? this.opacity : this.polyline.strokeOpacity,
																			visible: 		false,
																			map:			map
																		});
			this.pathSubsegments[i].sliderPos = tl.convertHistoricalDateToPosition(this.pathSubsegments[i].begin);
		}
		this.lastSubsegmentIndex = 0; // Used to keep track of the last subsegment processed (made visible or invisible) during timeline playback 
									  // Initialized to 0 here and whenever the path event transitions from visible to invisible
		this.lastSubsegmentIndexSliderPos = this.pathSubsegments[0].sliderPos;
	}
	
	// calculateGrowthPolygons is the analog of calculateGrowthIncrements for path events.  The algorithm is based on the path algorithm, but some work must 
	// be done before that because area animation is based on the fact that in HiM, one area (the sourceAE) "grows" into or "moves" toward another.  
	// The growth case could be that of a fire or epidemic, in which the limits of the spread of the event are known at different times, and become events 
	// in their own right.  The movement case could be that of an army, which occupies one area at one point in time and then moves to another area later on; 
	// the starting and ending points of the army are the source and target AEs.
	//
	// The algorithm is as follows:
	//		1. Use calculateEdgeIncrements(targetAE) to create two arrays: sourceAE.pathSubsegmentsAsSource and targetAE.pathSubsegmentsAsTarget.  Each has 
	//		   LCM(edges(sourceAE), edges(targetAE)) elements. calculateEdgeIncrements orders these and forms (in sourceAE) the array 
	//		   pathSequenceStoT, where each element is on object consisting of a two-point path linking a point on the sourceAE to one on the targetAE, plus 
	//		   the start and end time of that segment (the start time of the sourceAE and the start time of the targetAE).  For more details, see that function.
	//		2. For 0 <= i < LCM(edges(sourceAE), edges(targetAE)), use the basic algorithm in calculateGrowthIncrements to divide each path in 
	//		   this.pathSequenceStoT into increments that will be traversed in the same amount of time.
	//		3. For 0 <= i < LCM(edges(sourceAE), edges(targetAE)), create a GM Polygon object whose points are the j-th subsegment endpoints in each of the 
	//		   LCM(edges(sourceAE), edges(targetAE))segments.  In other words, we are creating a sequence of polygons representing the progression of steps to 
	//		   transform or move the source, where each step is as far as can be traveled in one baseInterval (the interval at which HiM awakes and updates 
	//		   the map display) in order to complete the transformation by the time the targetAE begins. Store this sequence in the sourceAE's property 
	//		   polygonSequence. For each element in that array, add the slider position (on the current timeline) of the historical date represented by 
	//		   this subsegment's begin date.
	//		4. Set the sourceAE's lastSubsegmentIndex to 0.  This is the last subsegment (sub-polygon, actually) that has been processed during an invocation of 
	//		   setTimePosition in main.  Set its lastSubsegmentIndexSliderPos to whatever the slider position is for element 0 of polygonSequence.
	//
	// calculateGrowthPolygons is called at these times: 
	//		1. Whenever a new timeline is selected (i.e., when $("#Select_Timeline").on("change") is triggered.
	//		2. Whenever an area event (source or target) is edited, and a timeline exists.  (If a TL doesn't exist, we know case (1) will be triggered *before* 
	//         a timeline can be run and the refinement of the path into subsegments has to be used.)
	//
	// Parameters:
	//		baseInterval		Number of msec HiM sleeps between updates of the time slider 
	//		impliedClockRate	A ClockRate giving the number of historical seconds that pass in one wall-clock second.
	//		targetAE			The target area event which this AE is moving toward or transforming into	
	//		maxPolygons			Max number of polygons to calculate between the source and target AEs		
	
	this.calculateGrowthPolygons = function (baseInterval,impliedClockRate,targetAE,maxPolygons) {
		if (this.animationTargetAreaEvent < 0) { // There is no target AE
			if (this.pathSubsegments) { // Before refining the polygon path into interpolated polygons, turn off visibility of any previous subsegments
				for (var i = 0; i < this.pathSubsegments.length; i++) this.pathSubsegments[i].GMsegment.setMap(null);
			}
			this.pathSubsegments = new Array(); // For arrow animation by GM, we don't need subsegments 
			return;
		}
		if (this.pathSubsegments) { // Before refining the polygon path into interpolated polygons, turn off visibility of any previous subsegments
			for (var i = 0; i < this.pathSubsegments.length; i++) this.pathSubsegments[i].GMsegment.setMap(null);
		}
		this.pathSubsegments = new Array(); // Holds all the subsegments the path event will br broken into
		var sourceAE = this;
		sourceAE.calculateEdgeIncrements(targetAE);
		
		// tempPolygons is an array of arrays.  tempPolygons[i][*] is a set of subsegments that subdivide the line sourceAE.pathSequenceStoT[i]. So 
		// sourceAE.pathSequenceStoT[i][0] 	 is the LatLng object sourceAE.pathSequenceStoT[i].path[0] (which is sourceAE.pathSubsegmentsAsSource[i]) and 
		// sourceAE.pathSequenceStoT[i][K-1] is the LatLng object sourceAE.pathSequenceStoT[i].path[1] (which is targetAE.pathSubsegmentsAsTarget[i]), 
		// where 0 <= i < sourceAE.pathSequenceStoT.length and K is the number of subsegments the line is divided into so that after K baseIntervals, 
		// the entire line would be traversed in the historical duration between the start of sourceAE and the start of targetAE.
		
		var tempPolygons = [];
		var DUR = sourceAE.begin.calculateHistoricalDuration(targetAE.begin)/1000; // Historical duration in seconds between the start times of the two events
		var impliedClockRateInSeconds = impliedClockRate.historicalDeltaTAmount; 
		var wt = DUR/impliedClockRateInSeconds; // Wall-clock duration in seconds of one path segment 
		var n  = Math.round(wt * (1000/baseInterval));  // Number of subsegments to divide this segment into 
		if (n == 0) n = 1;
		else if (n > maxPolygons) n = maxPolygons; // Don't exceed this number, as it will slow down the calculations significantly
		var deltaLat, deltaLng; // Lat/lng increments for this segment 
		var startLat, startLng; // Starting lat/lng for each segment
		var totalDurationSoFar = 0; // Total historical duration in msec of subsegments prior to the segment currently being divided up
		var tl = $("#slider-box").data("timeline"); // Current timeline
		for (var i=0; i < sourceAE.pathSequenceStoT.length; i++) {
			startLat = sourceAE.pathSequenceStoT[i].path[0].latLng.lat();
			startLng = sourceAE.pathSequenceStoT[i].path[0].latLng.lng();
			deltaLat =  (sourceAE.pathSequenceStoT[i].path[1].latLng.lat() - startLat)/n;
			deltaLng =  (sourceAE.pathSequenceStoT[i].path[1].latLng.lng() - startLng)/n;
			tempPolygons[i] = [];
			for (var j=0; j < n; j++) {
				tempPolygons[i][j] =  { latLng: new google.maps.LatLng(startLat + (j * deltaLat),
																	   startLng + (j * deltaLng)),
										begin: new HistoricalDate(sourceAE.begin.GMT + totalDurationSoFar + (j * ((DUR * 1000)/n)),false)
									  };
			}
			totalDurationSoFar = totalDurationSoFar + (DUR*1000);
		}
		var map = sourceAE.GMpolygon.getMap();
		
		// Might as well do our best to morph the fill color of the sourceAE into the fill color of the targetAE.  colorToNumber takes a hex color string
		// (with or without a leading #) and converts it to a decimal number.  numberToColor does the reverse.
		
		var colorToNumber = function (color) {
			var hex = { "0" : 0, "1" : 1, "2" : 2, "3" : 3, "4" : 4, "5" : 5, "6" : 6, "7" : 7, "8" : 8, "9" : 9, "A": 10, "B" : 11, "C" : 12, "D" : 13, "E" : 14, "F" : 15 };
			var number = 0;
			var startPos = (color.indexOf("#") < 0) ? 0 : 1;
			for (var i=0; i< (color.length - startPos); i++) {
				var hexDigit = color.substr(startPos+i,1);
				number = 16 * number + hex[hexDigit];
			}
			return number;
		};
		var numberToColor = function (number) {
			var hexDigit = ["0","1","2","3","4","5","6","7","8","9","A","B","C","D","E","F"];
			var hexPowers = [1, 16, 256, 4096, 65536, 1048576 ];
			var color = "#";
			var positionValue = 0;
			for (var i=5; i >= 0; i--) {
				if (number >= hexPowers[i]) {
					positionValue = 0;
					do {
						number = number - hexPowers[i];
						positionValue++;
					} while (number >= 0);
					if (number < 0) {
						number = number + hexPowers[i];
						positionValue--;
					}
					color = color + hexDigit[positionValue];
				}
				else color = color + "0";
			}
			return color;
		};
		var colorIncrement = Math.floor((colorToNumber(targetAE.GMpolygon.fillColor) - colorToNumber(sourceAE.GMpolygon.fillColor))/n);
		var sourceAEcolor = colorToNumber(this.fillColor);
		for (var j=0; j < n; j++)  {
			var path = [];
			for (var i=0; i < tempPolygons.length; i++) { 
				path[i] = tempPolygons[i][j].latLng;
			}
			sourceAE.pathSubsegments[j] =  { GMsegment: new google.maps.Polygon({	clickable: 		false,
																					path: 			path,
																					strokeColor:	this.color,
																					strokeWeight:	0,
																					strokeOpacity:	0,
																					fillColor:		numberToColor(sourceAEcolor + j * colorIncrement),
																					fillOpacity:	this.fillOpacity,
																					visible: 		false,
																					map:			map
																				}),
											 sliderPos: tl.convertHistoricalDateToPosition(tempPolygons[0][j].begin)
										   };
		}
		this.lastSubsegmentIndex = 0; // Used to keep track of the last subsegment processed (made visible or invisible) during timeline playback 
									  // Initialized to 0 here and whenever the path event transitions from visible to invisible
		this.lastSubsegmentIndexSliderPos = this.pathSubsegments[0].sliderPos;
		if (this.image == undefined) return;
		
		// If this AE has an icon, then calculate the path of a line running from the center of this AE to the center of the targetAE.  (Here "center" 
		// is defined as the LatLng pair (average(maxLat(AE), minLat(AE)), average(maxLng(AE), minLng(AE))).  Segment the path in the usual manner and 
		// store it in sourceAE.pathCenterLine as an array of GM LatLngs.  This will be used to move the icon as the animation moves the sourceAE to 
		// the targetAE position.
		
		var sourceAEcenter = sourceAE.findCenter();
		var targetAEcenter = targetAE.findCenter();
		deltaLat = (targetAEcenter.centerLat - sourceAEcenter.centerLat)/n;
		deltaLng = (targetAEcenter.centerLng - sourceAEcenter.centerLng)/n;
		sourceAE.pathCenterLine = [];
		for (var i=0; i < n; i++) {
			this.pathCenterLine[i] = new google.maps.LatLng(sourceAEcenter.centerLat + i * deltaLat, sourceAEcenter.centerLng + i * deltaLng);
		}
	}
	
	// calculateEdgeIncrements is invoked for an area event (call it sourceAE) and takes another area event (the targetAE) as a parameter.  It 
	// divides each edge of the source and target polygons as follows.  Let:
	//		edges(X) be the cardinality of polygon X, i.e., the number of edges 
	//		LCM(A,B) be the least common multiple of two integers A and B
	//		subsegmentsPerEdge(AE) = LCM(edges(targetAE), edges(sourceAE))/edges(AE)
	// The function produces in the sourceAE an array pathSubsegmentsAsSource, and in targetAE the array pathSubsegmentsAsTarget.  (Note that an AE 
	// can be a source for one animation and a target in another.)  Each array contains LCM(edges(targetAE), edges(sourceAE)) elements, each of which is a 
	// GM LatLng. 
	// The key result of this function is the pathSequenceStoT in the sourceAE.  This is an array of LCM(edges(targetAE), edges(sourceAE)) elements,
	// each one consisting of:
	//		path:	an array of two elements, [pathSubsegmentsAsSource[i], pathSubsegmentsAsTarget[i]]
	//		begin:	a HistoricalDate which is the start time of the sourceAE
	//		end:	a HistoricalDate which is the start time of the targetAE
	// The important thing about this array is that the elements are ordered as follows: The 0-th element of the array connects the two northernmost points 
	// in the source and target arrays.  (If there are multiple points that fulfill that criterion in the sourceAE, the first such point is chosen; if there 
	// are multiple points in the targetAE, the one closest to the sourceAE point is chosen.)  The next element of the array connects the two points that 
	// are next in the respective arrays, and so on ("wrapping around" each array when the last element of the array is reached).  Note that the sequence of 
	// points that form the edges of a GM polygon are in the order drawn by the user, so the sequence of subsegment points in the pathSubsegmentsAs arrays 
	// follow that natural order.
	
	this.calculateEdgeIncrements = function (targetAE) {
		var gcf = function(a, b) { // Greatest common factor function
						return (b == 0) ? (a):( gcf(b, a % b)); 
					};
		var lcm = function(a, b) { // Least common multiple function
						return (a/gcf(a,b)) * b; 
					};
		var index = 0;
		var edgesSource = this.polygon.length;
		var edgesTarget = targetAE.polygon.length;
		var subsegmentsPerEdgeSource = lcm(edgesSource,edgesTarget)/edgesSource; // Number of subsegments per edge for source and target AEs
		var subsegmentsPerEdgeTarget = lcm(edgesSource,edgesTarget)/edgesTarget;
		this.pathSubsegmentsAsSource = [];
		targetAE.pathSubsegmentsAsTarget = [];
		var deltaLat, deltaLng;
		var northernmostSourceLat = this.polygon[0].lat;
		var northernmostSourceIndex = 0;	// If there are multiple ones, we'll just use the first
		var northernmostTargetLat = targetAE.polygon[0].lat;
		var northernmostTargetIndex = 0;
		var index = 0;
		var left, right;
		var done = false;
		for (var i=0; i < edgesSource; i++) {	// Divide sourceAE edge i into subsegmentsPerEdgeSource equal segments
			if (i == edgesSource-1) { left = i; right = 0; done = true; }  // The last subsegment spans the endpoint of the last subsegment of the last edge  
			else 					{ left = i; right = i+1; }			   // and the starting point of the first subsegment of the first edge
			deltaLat =  (this.polygon[right].lat - this.polygon[left].lat)/subsegmentsPerEdgeSource;
			deltaLng =  (this.polygon[right].lng - this.polygon[left].lng)/subsegmentsPerEdgeSource;
			for (var j=0; j < subsegmentsPerEdgeSource; j++) {
				this.pathSubsegmentsAsSource[index] =  { latLng: new google.maps.LatLng(this.polygon[left].lat + (j * deltaLat),
																	            		this.polygon[left].lng + (j * deltaLng))
											   		   };
				if (this.pathSubsegmentsAsSource[index].latLng.lat() > northernmostSourceLat) {	
					northernmostSourceLat = this.pathSubsegmentsAsSource[index].latLng.lat();
					northernmostSourceIndex = index;
				}
				index++;
			}
			if (done) break;
		}
		index = 0;
		done = false;
		for (var i=0; i < edgesTarget; i++) {	// Divide targetAE edge i into subsegmentsPerEdgeTarget equal segments
			if (i == edgesTarget-1) { left = i; right = 0; done = true; } // The last subsegment spans the endpoint of the last subsegment of the last edge  
			else 					{ left = i; right = i+1; }			  // and the starting point of the first subsegment of the first edge
			deltaLat =  (targetAE.polygon[right].lat - targetAE.polygon[left].lat)/subsegmentsPerEdgeTarget;
			deltaLng =  (targetAE.polygon[right].lng - targetAE.polygon[left].lng)/subsegmentsPerEdgeTarget;
			for (var j=0; j < subsegmentsPerEdgeTarget; j++) {
				targetAE.pathSubsegmentsAsTarget[index] =  { latLng: new google.maps.LatLng(targetAE.polygon[left].lat + (j * deltaLat),
																	            			targetAE.polygon[left].lng + (j * deltaLng))
											   		   		};
				if (targetAE.pathSubsegmentsAsTarget[index].latLng.lat() > northernmostTargetLat) {	
					northernmostTargetLat = targetAE.pathSubsegmentsAsTarget[index].latLng.lat();	
					northernmostTargetIndex = index;
				}
				index++;
			}
			if (done) break;
		}
		var distanceToNorthernmostSourceLatPoint = computeDistanceBetween(this.pathSubsegmentsAsSource[northernmostSourceIndex].latLng,
																		  targetAE.pathSubsegmentsAsTarget[northernmostTargetIndex].latLng);
		var distance;
		for (var i=0; i < edgesTarget; i++) { // We have the northernmost lat value for the targetAE; see if there is more than one point with that lat.   
											  // If so, choose the one nearest to the northernmost source lat point
			if ((i != northernmostTargetIndex) && (targetAE.pathSubsegmentsAsTarget[i].latLng.lat() == northernmostTargetLat)) {
				distance =  computeDistanceBetween(this.pathSubsegmentsAsSource[northernmostSourceIndex].latLng,
												   targetAE.pathSubsegmentsAsTarget[i].latLng);
				if (distance < distanceToNorthernmostSourceLatPoint) {
					distanceToNorthernmostSourceLatPoint = distance;
					northernmostTargetLat = targetAE.pathSubsegmentsAsTarget[i].latLng.lat();
					northernmostTargetIndex = i;
				}
			}
		}
		
		// Now copy the pathSubsegmentsAs arrays into two temporary arrays such that the 0-th elements of each array are the two northernmost points, and 
		// all other points follow in succession from the original arrays.  When we get to the end of each original array, wrap around to the start of that 
		// array and continue.
		//
		// Before we do that, though, we need to insure that the orientations of both polygons are the same, or adjust if they aren't.  "Orientation" here means 
		// the direction (clockwise [CW] or counter-clockwise [CCW]) in which the user drew the polygon; this is reflected in the order in which Google Maps 
		// stores the polygon's points.  Starting from the northernmost point, look at the next point in the natural order of the polygon's points: if the 
		// longitude of the next point is east of that of the northernmost point, then the orientation is CW; if the longitude is west of that of the northernmost 
		// point, the orientation is CCW.  As long as the orientations of the two polygons are both CW or both CCW, we can just take the points in the 
		// natural order in which they are stored.  If the orientations differ, then we must read off the points of the target event's polygon in reverse 
		// order to match that of the source polygon's orientation.
		
		var tempSource = [];
		var tempTarget = [];
		var limit = this.pathSubsegmentsAsSource.length;
		var orientationSource = this.pathSubsegmentsAsSource[(northernmostSourceIndex+1) % limit].latLng.lng() - this.pathSubsegmentsAsSource[northernmostSourceIndex].latLng.lng();
		var orientationTarget = targetAE.pathSubsegmentsAsTarget[(northernmostTargetIndex+1) % limit].latLng.lng() - targetAE.pathSubsegmentsAsTarget[northernmostTargetIndex].latLng.lng();
		var sameOrientation = ((orientationSource * orientationTarget) > 0); // if both orientations are positive or both negative, their product is positive
		index = 0;
		for (var i = northernmostSourceIndex; i < limit; i++) {
			tempSource[index] = this.pathSubsegmentsAsSource[i]; index++;
		}
		for (var i = 0; i < northernmostSourceIndex; i++) {
			tempSource[index] = this.pathSubsegmentsAsSource[i]; index++;
		}
		index = 0;
		if (sameOrientation) {
			for (var i = northernmostTargetIndex; i < limit; i++) {
				tempTarget[index] = targetAE.pathSubsegmentsAsTarget[i]; index++;
			}
			for (var i = 0; i < northernmostTargetIndex; i++) {
				tempTarget[index] = targetAE.pathSubsegmentsAsTarget[i]; index++;
			}
		}
		else { // Target orientation differs from source orientation, so "count down" the points in reverse order in the array
			for (var i = northernmostTargetIndex; i >= 0; i--) {
				tempTarget[index] = targetAE.pathSubsegmentsAsTarget[i]; index++;
			}
			for (var i = limit-1; i > northernmostTargetIndex; i--) {
				tempTarget[index] = targetAE.pathSubsegmentsAsTarget[i]; index++;
			}
		}
		// Finally, create the pathSequenceStoT array in the sourceAE.
		this.pathSequenceStoT = [];
		for (var i=0; i < limit; i++) {
			this.pathSequenceStoT[i] = { path:	[ tempSource[i], tempTarget[i] ],
										 begin:	this.begin,			// Start HD of the sourceAE
										 end:	targetAE.begin		// Start HD of the targetAE
									   };
		}
	}
	
	// clearPathSubsegments turns visibility off on all subsegments of a path.  This is invoked from (main) editEvent when a path event is 
	// edited.  IN that situation, the entire path event is made invisible (via GM setMap(null)), but some subsegments may be visible, depending on 
	// where the time slider is when the editing occurs.
	//clearPathSubsegments assumes the caller has checked to make sure that the HistoricalEvent has its pathSubsegments component defined.
	
	this.clearPathSubsegments = function () {
		var limit = this.pathSubsegments.length - 1;
		for (var i = 0; i < limit; i++) this.pathSubsegments[i].GMsegment.setMap(null);
	}
}

// Helper function to compute distance between two points.  Use the spherical law of cosines to compute the distance between two points on the earth (in meters).  See http://www.movable-type.co.uk/scripts/latlong.html
// TODO: For some unknown reason, google.maps.geometry.spherical.computeDistanceBetween kept telling me something was undefined, so I reverted to this.

function computeDistanceBetween (latLng1,latLng2) {
	var lat1 = (Math.PI/180) * latLng1.lat(); // Convert degrees to radians first
	var lat2 = (Math.PI/180) * latLng2.lat();
	var diffLng = (Math.PI/180) * (latLng2.lng()-latLng1.lng());
	return (Math.acos(Math.sin(lat1)*Math.sin(lat2) + 
					  Math.cos(lat1)*Math.cos(lat2) *
					  Math.cos(diffLng)) * 6371000); // radius of the earth in meters
 }


// HiM User
// 
// options object for creation:
//		options.userName			name of this user 
//		options.password			password (if defined)
//		options.userData			
//			options.userData.uEmail				email address 
//			options.userData.uOptIn				opt-in to mailing list yes/no 
//			options.userData.uYearOfBirth		birth year 
//			options.userData.uRole				role (student, professor, etc.)
//			options.userData.uReason			main reason for using HiM    
//			options.userData.MyIcons			icon library for the user 
//			options.userData.nextExternalFileID	integer representing next external file sequence number for this user (if defined)

function User(options) {
	this.userName = options.userName;
	if (options.password) 			this.password = options.password; 
	else 							this.password = null;
	if (options.userData && 
		options.userData.MyIcons) {
									var MyIcons = [];
									for (var i=0; i < options.userData.MyIcons.length; i++) MyIcons[i] = new ExternalFile(options.userData.MyIcons[i]);
									this.MyIcons = MyIcons;
	}
	else							this.MyIcons = [];
	if (options.userData &&
	    options.userData.nextExternalFileID) 
	   								this.nextExternalFileID = options.userData.nextExternalFileID;
	else							this.nextExternalFileID = 0;
	if (options.userData)			this.userData = options.userData;
	else							this.userData = {};
	
	this.stringifyUser = function() {
		var s = {};
		s.userName = this.userName;
		s.password = this.password;
		s.userData = this.userData;
		s.userData.MyIcons = this.MyIcons;
		s.userData.nextExternalFileID = this.nextExternalFileID;
		return s;
	}
	
	// Add an icon to the user's MyIcons array
	
	this.addToMyIcons = function (icon) {
		this.MyIcons.push(icon);
	}
	
	// Remove an icon from the user's MyIcons array 
	
	this.removeFromMyIcons = function (icon) {
		var MyIcons = this.MyIcons;
		removeIconFromSet(MyIcons,icon);
	}
	
	// Return sequence number to use for next external file for this user 
	
	this.getNextExternalFileID = function () {
		return this.nextExternalFileID++;
	}
}

// ExternalFile is an external file reference.  It is a way to represent icons, images, video/audio clips, etc.
// ExternalFiles are actually stored on the server, but the code below is the way to represent and deal with the 
// references within the HiM client.
//
// options object for creation:
//	options.user			User object of current logged-in user	
//	options.fileExtension	extension of file ("png", "jpeg", "pdf", etc.)
//	options.fileType		type of ExternalFile: "icon", "video", "audio", "image".  Note that depending on the type, the remaining 
//								options may vary.  For example, an icon has a tooltip, but none of the other types do. 
//	options.tooltip			tooltip for icon (if defined)
//
// Alternatively, if all we're doing is recreating a JSONified ExternalFile object, then just use options.url in lieu of options.user and 
// options.fileExtension.
//
// Properties of resulting ExternalFile:
//	fileName				filename of the resulting file, without server name or pathname (used prior to creation of the url; ignored afterwards)
//	url						Full URL of the ExternalFile (added after creation of the object) 										
//	fileType				type of externalFile
//	tooltip					tooltip (if fileType is icon)

function ExternalFile (options) {
	if (options.url) 		this.url = options.url;
	if (options.fileName) 	this.fileName = options.fileName;
	else					this.fileName = options.user.userName + "/" + options.user.getNextExternalFileID() + "." + options.fileExtension;
	this.fileType = options.fileType;
	if (options.fileType == "icon") {
		if (options.tooltip) this.tooltip = options.tooltip;
		else				 this.tooltip = "";
	}
	
	this.matchesExternalFile = function (xf) {
		return ((this.fileType == xf.fileType) && (this.fileName == xf.fileName));
	}
}

return {
	makeDate: makeDate,
    GregorianDateFormatter: GregorianDateFormatter,
    checkDateAndTimeInputs: checkDateAndTimeInputs,
    HistoricalDate: HistoricalDate,
    parseBceDate: parseBceDate,
    maxHistoricalDate: maxHistoricalDate,
    minHistoricalDate: minHistoricalDate,
    makeBceYear: makeBceYear,
    whichEra: whichEra,
    getUTCOffset: getUTCOffset,
    Clock: Clock,
    ClockRate: ClockRate,
    Timeline: Timeline,
    Scenario: Scenario,
    HistoricalEvent: HistoricalEvent,
    User: User,
    ExternalFile: ExternalFile
};

});
