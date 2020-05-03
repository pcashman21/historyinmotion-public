// 						HISTORY IN MOTION WEB CLIENT
// CODE COPYRIGHT (c) 2013 - 2015 BY PAUL M. CASHMAN (North Reading, MA) and JOHN M. LEEN (Seattle, WA)
// ALL RIGHTS RESERVED.

/* Entry point, initialization, and UI interaction for History in Motion. */

require.config({
    paths: {
        async: '../third_party/async',
        jquery: '../third_party/jquery-1.10.2',
        jqueryui: '../third_party/jquery-ui-1.10.3.custom',
        jquerycookie: '../third_party/jquery.cookie',
        jscolor: '../third_party/jscolor/jscolor',  // Color picker widget from jscolor.com
        maptiler: '../third_party/klokantech'  // MapTiler library from www.maptiler.com
    },

    shim: {
        'jqueryui': {
            exports: '$',
            deps: ['jquery']
        },
        'jscolor': {
            exports: 'jscolor',
            deps: null
        },
    }
});

// Define a RequireJS module that is a convenience wrapper to load the Google Maps API asynchronously.
define('googlemaps', ['async!http://maps.googleapis.com/maps/api/js?libraries=visualization&key=PaulsGoogleApiKey'],
function () { return google; });


// Main module.

requirejs(['historical_time',
           'storage',
           'googlemaps',
           'maptiler',
           'jqueryui',
           'jscolor',
           'jquerycookie',
           ],
function (ht, storage, google, klokantech, $, jscolor) {

$(document).ready(function() {
    jscolor.init();

    var MYAPP = {};	/* Container object for HiM global variables */
    
    // List of timezones.  Eventually this may be gotten off the server or some other way.
    
    MYAPP.timeZones = [
			"Universal Time (UTC+0)",
			"Alaska (UTC-9)",
			"Argentina (UTC-3)",
			"Arizona (UTC-7)",
			"Atlantic (UTC-4)",
			"Australia Cap Terr (UTC+10)",
			"Australia Eastern (UTC+10)",
			"Australia NSW (UTC+10)",
			"Australia NT (UTC+9:30)",
			"Australia QLD (UTC+10)",
			"Australia SA (UTC+9:30)",
			"Australia Tasmania (UTC+10)",
			"Australia VIC (UTC+10)",
			"Australia Western (UTC+8)",
			"Bangladesh (UTC+6)",
			"Beijing (UTC+8)",
			"Bolivia (UTC-4)",
			"Brazil (UTC-3)",
			"Central (UTC-6)",
			"Chile (UTC-4)",
			"Colombia (UTC-5)",
			"Eastern (UTC-5)",
			"Ecuador (UTC-5)",
			"Egypt (UTC+2)",
			"Europe Central (UTC+1)",
			"Europe Eastern (UTC+2)",
			"Europe Western (UTC+1)",
			"Fiji (UTC+12)",
			"Greenwich Mean Time (UTC+0)",
			"Guam (UTC+10)",
			"Hawaii(UTC-10)",
			"Hong Kong (UTC+8)",
			"India (UTC+5:30)",
			"Indiana (UTC-5)",
			"Ireland (UTC+0)",
			"Israel (UTC+2)",
			"Japan (UTC+9)",
			"Korea (UTC+9)",
			"Micronesia (UTC+10)",
			"Mountain (UTC-7)",
			"New Zealand (UTC+12)",
			"Newfoundland (UTC-3:30)",
			"Pacific (UTC-8)",
			"Pakistan (UTC+5)",
			"Paraguay (UTC-4)",
			"Peru (UTC-5)",
			"Philippines (UTC+8)",
			"Portugal (UTC+0)",
			"Pretoria (UTC+2)",
			"Puerto Rico (UTC-4)",
			"Russia Moscow (UTC+3)",
			"Saskatchewan (UTC-6)",
			"Singapore (UTC+8)",
			"Taiwan (UTC+8)",
			"Thailand (UTC+7)",
			"United Arab Emirates (UTC+4)",
			"United Kingdom (UTC+0)",
			"Uruguay (UTC-3)",
			"Venezuela (UTC-4)",
			"Vietnam (UTC+7)",
			"West Africa (UTC+1)"
	];
	
    setupStage1();

    function setupStage1() {
    	MYAPP.HiMWebServer = "http://www.historyinmotion.info/index.html"; // URL of web server
        MYAPP.baseInterval = 100; 			/* Number of milliseconds to sleep during timeline player loop */
        MYAPP.pathAnimationInterval = 20; 	/* Number of milliseconds to sleep during GM's animation of direction of travel on a path */
        MYAPP.maxMsecToBounce = 3000; 		/* Max milliseconds during which an event placemark's icon can bounce to call attention to itself */
        MYAPP.dateTolerance = .01; 			/* Percentage by which one approximate HistoricalDate can differ from another HistoricalDate */
                                            /* and still be considered to be concurrent with it.  See HistoricalDate for details. */
        MYAPP.maxAllowableAnimationPolygons = 500; // When animating area events, this is the max number of intervening polygons to calculate 
        									// between the source and target area events.  
        MYAPP.map = null;					/* The current Google Map object */	
        MYAPP.mapLayers = null;				// Array of MapsEngineLayer objects currently being display.  These will be historical maps.
        MYAPP.mapID = null;					// ID of historical map, obtained from Google Gallery	
        MYAPP.historicalMapListIndex = -1;	// Index in MYAPP.historicalMapList of the selected/current historical map
        
        // In executeLoginDialog, we set click listeners for a <div> that the user can click when s/he forgot his/her username and/or password. 
        // We don't want to set the listener more than once.  Within one session, if the user(s) login and logout over and over, we need to make sure 
        // that the listeners are only set once.
        
        MYAPP.listenerSetForForgotUserNameOrPassword = false;
        
        // There are three cases to consider when opening a scenario:
        //		Case 1: User has clicked on top-level command File/Open 
        //		Case 2: User has clicked on top-level command Edit/Scenario 
        //		Case 3: User has deleted a scenario and now HiM must force the user to open another scenario 
        // When the dialog box for choosing a scenario is presented to the user, the three cases require different buttons to be shown:
        //		Case 1: Open, Cancel 
        //		Case 2: Delete, Cancel, Edit 
        //		Case 3: Open (and user cannot exit from the dialog without choosing)
        // The global variable MYAPP.caseForOpeningScenario distinguishes among these three.  In cases 1 and 2, its value is set in the 
        // command click listener.  In case 3, it is set in the deleteScenario function and in checkAndLoadScenarioFromTimer.  In the latter case, 
        // it's used when the user is logging in but has no "last scenario used" (i.e., this user has never logged in on this machine and has no
        // scenarios at all (even those created on other machines).  The zero value set here is not used; it's just a placeholder.
        
        MYAPP.caseForOpeningScenario = 0 ;	
        
        // Two globals to implement checking when it's safe to load a scenario.  One is a timer ID, the other is a boolean. 
        // Every 100 msec, wake up and check the boolean.  If false, keep on waiting.  If true, delete the timer and either load a scenario
        // (if there is one for the user who's logged in) or do nothing and the user can invoke New Scenario from the menu (New allows copying
        // an existing scenario for the user's personal use).
        // The reason we have to check if it's OK to load is to make sure the user login dialog is done.  Otherwise, loading the Google Map
        // for the scenario will be rendered over the login dialog box.
        
        MYAPP.OKToLoadScenario = false;		/* Boolean to indicate when it's OK to load a scenario.  */
        MYAPP.OKToLoadScenarioID = setInterval(checkAndLoadScenarioFromTimer,100);	/* ID of timer to check whether it's safe to proceed with loading a scenario */

        // When any editing operation occurs, check this name against the name of the scenario in MYAPP.scenario. If they are different, 
        // certain initializations of some editing fields must be done.  Once that initialization happens, set the variable to be the name
        // of the current scenario.
        
        MYAPP.nameOfScenarioBeingEdited = ""; 
        
        // When user invokes a command from the top-level menu, the command checks the value of MYAPP.commandInProgress to see if some top-level command 
        // is already in progress.  If it is, then HiM puts up a dialog box telling the user to finish what s/he's doing before starting something else.  When 
        // a top-level command finishes (whether by competing its operation or via the user canceling the command), MYAPP.commandInProgress is reset to null.
        
        MYAPP.commandInProgress = null;
        
        // When a user opens a scenario, check to make sure the scenario saved as the current working copy has been written to the server.  Prompt the user 
        // if it hasn't; if it isn't saved, all changes will be lost.
        
        MYAPP.workingCopyIsSaved = false;
        
        // Three global variables used in determining if visible events are located beyond the boundaries of the Google Maps viewport.
        
        MYAPP.eventsOutsideBounds = {};
        MYAPP.viewportBounds = {};
        MYAPP.maxLatLngInSector = {};
        
        // 							Global variables for icon management and selection 
        // The Icon Manager (IM) is an HTML construct for displaying the HiM Common Icon Library (CIL), the user's MyIcons library, and 
        // the current scenario's scenario-specific icon library (SSIL).  This is done via a dialog box with three tabs inside. The display 
        // can be accessed in one of two modes, "manage" or "select."  In manage mode, the user can add, remove, edit, and move icons.  In select 
        // mode, the user can select an icon for use in an event.
        // The CIL needs to be set up exactly once for the instance of the HiM client.  Even if one user logs out and another user logs in on the 
        // same client, the CIL will not change.  The CIL is set up below.  MyIcons needs to be set up when the user logs in, and all icons need to be 
        // removed from the MyIcons tab when the user logs out.  An SSIL needs to be set up when a scenario is loaded, and removed when another 
        // scenario is loaded.
        // There are two global variables that are used to control what happens when a user clicks on an icon in one of the tabs.  MYAPP.iconMode is 
        // set to either "manage" or "select," and indicates the mode of use.  This controls (1) whether the CIL tab is enabled or disabled (enabled for 
        // "select" mode, disabled for "manage" mode), and (2) whether the icon's value (i.e., its external file reference) is supplied to an input 
        // field in an event accordion, in the case of "select," or whether an editing menu dialog box is displayed, from which the user can choose 
        // an editing action.
        // The other global variable is MYAPP.selectModeProcessingFunction, and it holds a function which inserts the value of the icon into the appropriate 
        // event accordion input field.  Since there are different fields for which an icon can be supplied, there is no one function that handles all 
        // cases.  Instead, in the setup for the event accordion for each type of event, the setup code will assign the appropriate field-filling 
        // function to MYAPP.selectModeProcessingFunction.  If MYAPP.iconMode == "select", then MYAPP.selectModeProcessingFunction() will be called to 
        // handle the click event on that icon.
        
        MYAPP.iconMode = "";
        MYAPP.selectModeProcessingFunction = null;
        MYAPP.Mb = Math.pow(2,20);		// One megabyte
        MYAPP.maxUploadableFileSize = 20 * MYAPP.Mb; // 20Mb is max size of allowable external image file that user can upload
        MYAPP.maxUploadableFileSizeForMedia = 50 * MYAPP.Mb; // 50Mb is max size of allowable external video or audio file that user can upload
        MYAPP.changedMyIcons = false;  	// Flags to indicate whether the user's MyIcons IL and current SSIL changed during current icon-editing session 
        MYAPP.changedSSIL = false;		// This will determine whether to update the user object to the server, and whether to indicate the scenario object should be saved

        MYAPP.maxMTZipFileSize = 250 * MYAPP.Mb; // 250 Mb map size ought to be big enough for anyone
        
        // Global variables for handling scenario and timeline context displays 
        
        MYAPP.SOCisVisible = false;		// Scenario opening context 
        MYAPP.SCCisVisible = false;		// Scenario closing context 
        MYAPP.TOCisVisible = false;		// Timeline opening context 
        MYAPP.TCCisVisible = false;		// Timeline closing context
        
        // MYAPP.soundtrack is a way for the event handlers that enable a user to specify a soundtrack for any of the contexts to communicate with the 
        // scenario/timeline editing code that executes when a user clicks the Save button to create/edit the scenario or timeline. (See setupDescriptionSection
        // and the relevant scenario or timeline editing code for details.)  The properties of this object are sc_start_desc/sc_end_desc for scenarios and 
        // tl_start_desc/tl_end_desc for timelines.
        
        MYAPP.soundtrack = {};
        MYAPP.SOSisPlaying = false;	// Scenario opening soundtrack.  This is the only soundtrack we need to manage in this way.
        
        // Get the type and version of the browser.  Function is from http://stackoverflow.com/questions/2400935/browser-detection-in-javascript
        
        var b = (function(){
					var ua= navigator.userAgent, tem, 
					M= ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
					if(/trident/i.test(M[1])){
						tem=  /\brv[ :]+(\d+)/g.exec(ua) || [];
						return 'IE '+(tem[1] || '');
					}
					if(M[1]=== 'Chrome'){
						tem= ua.match(/\bOPR\/(\d+)/)
						if(tem!= null) return 'Opera '+tem[1];
					}
					M= M[2]? [M[1], M[2]]: [navigator.appName, navigator.appVersion, '-?'];
					if((tem= ua.match(/version\/(\d+)/i))!= null) M.splice(1, 1, tem[1]);
					return M.join(' ');
				})();
		MYAPP.browserType = b.substring(0,b.indexOf(" "));
        
        // Set the default options for all date pickers, including a minimum year of 1.

        var dateMin = new Date(1, 0, 1);
        dateMin.setFullYear(1);

        $.datepicker.setDefaults({
            showOn: "both",
            appendText: "(mm/dd/yyyy)",
            minDate: dateMin
        });
                                   
        /* Set up the button to play or pause a timeline.  */
        /* Ensure the user can't switch timelines while one is playing, only when it's paused. */
        
        $('#scenario_name').text("(no scenario loaded)");
        $("#browser_title").text("History in Motion");
        $('#play_button').button({
            text: false,
            icons: {primary: "ui-icon-play"}
        })
        .data({ "button-state": "playing" })
        .click(function() {
            var button = $('#play_button');
            if (button.data("button-state") == "playing")
                {
					MYAPP.intervalID = setInterval(tlPlay,MYAPP.baseInterval); /* global variable used to communicate between instances of the click function for play/pause button */
					button.button("option", {icons: { primary: "ui-icon-pause"}}).data({ "button-state": "paused" }).button("refresh");
					$('#Select_Timeline').attr("disabled", "true"); /* Can't switch timelines while one is playing */
                }
            else {
                clearInterval(MYAPP.intervalID);
                button.button("option", {icons: { primary: "ui-icon-play"}}).data({ "button-state": "playing" }).button("refresh");
                $('#Select_Timeline').removeAttr("disabled"); /* OK to switch timelines while one is paused */
            }
        })
        .tooltip({content: "Play/pause timeline" });
        
        // Set up tool buttons within the toolbar
        
        $("#tool_point_event").text("").append("<img src='icons/tool_point_event_1.png' title='Create point event' />").button()
        							   .click(function () {
        							   				$("#enclose-menu li:contains(New) li:contains(Point Event)").trigger("click");
        							   			})
        							   .tooltip();
        $("#tool_path_event").text("").append("<img src='icons/tool_path_event.png' title='Create path event' />").button()
        							   .click(function () {
        							   				$("#enclose-menu li:contains(New) li:contains(Path Event)").trigger("click");
        							   			})
        							   .tooltip();
        $("#tool_area_event").text("").append("<img src='icons/tool_area_event.png' title='Create area event' />").button()
        							   .click(function () {
        							   				$("#enclose-menu li:contains(New) li:contains(Area Event)").trigger("click");
        							   			})
        							   .tooltip();
        $("#tool_timeline").text("").append("<img src='icons/tool_timeline.png' title='Create timeline' />").button()
        							   .click(function () {
        							   				$("#enclose-menu li:contains(New) li:contains(Timeline)").trigger("click");
        							   			})
        							   .tooltip();
        $("#tool_edit_event").text("").append("<img src='icons/tool_edit_event.png' title='Edit event' />").button()
        							   .click(function () {
        							   				$("#enclose-menu li:contains(Edit) li:contains(Event)").trigger("click");
        							   			})
        							   .tooltip();
        $("#tool_edit_timeline").text("").append("<img src='icons/tool_edit_timeline.png' title='Edit timeline' />").button()
        							   .click(function () {
        							   				$("#enclose-menu li:contains(Edit) li:contains(Timeline)").trigger("click");
        							   			})
        							   .tooltip();
        $("#toolbar_button").text("").append("<img src='icons/tool_set.png' />").button().tooltip();
         
        // reEnableToolbarButton is invoked (1) upon HiM initialization and (2) whenever the toolbar is closed.  It queues a one-time 
        // click listener on the toolbar button, where that listener, when invoked, displays the toolbar and sets up a listener for the 
        // toolbar dialog box's "close" event.  When the toolbar is closed, the close event re-enables the toolbar button so the toolbar 
        // can be shown again, if desired.  This whole scheme prevents the toolbar from being displayed multiple times without being closed first.
        
         function reEnableToolbarButton () {
			$("#toolbar_button").button().one("click",function () {
														$("#toolbar_dialog").css("display","block")
																			.dialog({
																					height: 110,
																					width: 500,
																					position: "left top+40",
																					close: function () {
																								reEnableToolbarButton();
																							}
																				});
														});
		}
        reEnableToolbarButton();
        $("#slider-box").slider({
            slide: function(event, ui) { 
            setTimePosition(ui.value); },
        }).data("timelineID", -1); /* Set nonexistent timeline ID so initial timeline choice will force the setup of execution parameters */
    
		function makeTimeZoneMenu (jqSelect) {
			MYAPP.timeZones.forEach(function(z) {
				var option = $("<option>" + z + "</option>"); 
				jqSelect.append(option); 
			});
		}
		
		makeTimeZoneMenu($("#default_time_zone_creation"));	// Set up the time zone menus in the three places they're used
        makeTimeZoneMenu($("#event_start_time_zone"));
        makeTimeZoneMenu($("#tl_start_time_zone"));
        
        MYAPP.OPACITY_MAX_PIXELS = 57; // Width of opacity control image, used by Klokantech MapTiler code
         
         // Make menu of birth years for user account creation/editing
         
         var thisYear = new Date().getFullYear();
         var startYear = thisYear - 7; // C'mon -- no under under 7 years old will be using HiM
         var endYear = 1924;  // And I doubt that anyone over 90 will be, either
         var option;
         for (var i = startYear; i > endYear; i--) {
         	option = $("<option value='" + i + "'>" + i + "</option>");
         	$("#edit_user_year").append(option);
         }
         
         // Helper function to get URL query parameters (see below)
         
         function getURLParameter(sParam) {
			var sPageURL = window.location.search.substring(1);
			if (!sPageURL) return undefined;
			var sURLVariables = sPageURL.split('&');
			for (var i = 0; i < sURLVariables.length; i++)
			{
				var sParameterName = sURLVariables[i].split('=');
				if (sParameterName[0] == sParam)
				{
					return sParameterName[1];
				}
			}
		}
		
		// HiM URL parameters 
		// When invoking HiM, the URL may have parameters in any order.  All parameters are optional.  A full URL might look something like this:
		//		www.historyinmotion.info/index.html?ui=elem&edit=false&scen=Joe%20User+Battle%20of%20Saratoga&tl=First%20battle&embed=false
		// The parameters are as follows (* indicates default value):
		//	ui=		Which UI to use.  Values can be:
		//				*full  		Full UI with all fields for editing
		//				elem  		Elementary UI with only date, time, AM/PM for time specification.  Time zone defaults to UCT, era to CE, exact date, 
		//								plus time format editing leaves out those elements
		//	edit=	Whether the UI should offer editing capability or just viewing capability. Values can be:
		//				*true		Full editing capability included 
		//				false		No editing capability; just viewing
		//	scen=	Scenario to execute.  The value is the "permalink" which is a unique integer which is assigned by the server to each scenario.
		//	tl=		Timeline within the scenario.  If no scenario is specified, this parameter is ignored.  If no timeline is specified, or the specified 
		//				timeline doesn't exist within the scenario, Full Scenario is used.
		//	anon	If present, there is no user to log in.  This forces edit=false.  Also, scen= must have a non-null value.
		
		var ui = 	getURLParameter("ui");
		if ((ui == "full") || ui == "elem") MYAPP.ui = ui;
		else MYAPP.ui = "full";
		if (MYAPP.ui == "elem") {
			$(".not_elem").css("display","none");	// Turn off visibility on all UI elements not part of the elementary UI 
			
			// Default format guide for formatting historical dates.
			// The format object is structured as an array of 11 objects.  Each object describes the format element to occur at that 
			// position in a completed historical date format string.  Each array element has an object value which has at 
			// least these properties:
			//		rootName:	The "root name" of the HD element that displays this format option, e.g., day_of_week, month, date, etc.
			//					The names of HTML elements within this <div> have names based on this root name.
			//		display:	true iff this property is to be displayed 
			//		separator:	A string that follows the property value (e.g., blank, comma, colon, etc.)
			// The month and era properties have an additional sub-property:
			//		style:		Indicates the style in which to show this value (the HTML field value, e.g., BCE_CE or BC_AD
			// For month, this could be by name or by number (1-12).  For era, it's BCE or CE style vs. BC or AD style.
		
			MYAPP.defaultHistoricalDateFormatGuide = 
			[
				{ rootName: 	"day_of_week",		// 'Thursday, '
				  display:		true,
				  separator:	", "
				},
				{ rootName: 	"month",			// 'January '
				  display:		true,
				  separator:	" ",
				  style:		"name"
				},
				{ rootName: 	"date",				// '9, '
				  display:		true,
				  separator:	", "
				},
				{ rootName: 	"year",				// '2014 '
				  display:		true,
				  separator:	" "
				},
				{ rootName: 	"hour",				// '9:'
				  display:		true,
				  separator:	":"
				},
				{ rootName: 	"minute",			// '51'
				  display:		true,
				  separator:	" "
				},
				{ rootName: 	"AMPM",				// 'AM '
				  display:		true,
				  separator:	" "
				},
				{ rootName: 	"era",				// 'CE '
				  display:		false,
				  separator:	" ",
				  style:		"BCE_CE"
				},
				{ rootName: 	"second",			// '27 '
				  display:		false,
				  separator:	" "
				},
				{ rootName: 	"timezone",			// 'Eastern '
				  display:		false,
				  separator:	" "
				},
				{ rootName: 	"offset",			// '(UTC-5)'
				  display:		false,
				  separator:	""
				}
			];
		}
		else {
			MYAPP.defaultHistoricalDateFormatGuide = 
			[
				{ rootName: 	"day_of_week",		// 'Thursday, '
				  display:		true,
				  separator:	", "
				},
				{ rootName: 	"month",			// 'January '
				  display:		true,
				  separator:	" ",
				  style:		"name"
				},
				{ rootName: 	"date",				// '9, '
				  display:		true,
				  separator:	", "
				},
				{ rootName: 	"year",				// '2014 '
				  display:		true,
				  separator:	" "
				},
				{ rootName: 	"era",				// 'CE '
				  display:		true,
				  separator:	" ",
				  style:		"BCE_CE"
				},
				{ rootName: 	"hour",				// '9:'
				  display:		true,
				  separator:	":"
				},
				{ rootName: 	"minute",			// '51:'
				  display:		true,
				  separator:	":"
				},
				{ rootName: 	"second",			// '27 '
				  display:		true,
				  separator:	" "
				},
				{ rootName: 	"AMPM",				// 'AM '
				  display:		true,
				  separator:	" "
				},
				{ rootName: 	"timezone",			// 'Eastern '
				  display:		true,
				  separator:	" "
				},
				{ rootName: 	"offset",			// '(UTC-5)'
				  display:		true,
				  separator:	""
				}
			];
		}
		
		
		var edit = 	getURLParameter("edit"); // Not doing anything with this yet
		if (edit == undefined) MYAPP.edit = true;
		else if (edit == "false") MYAPP.edit = false;
		else if (edit == "true") MYAPP.edit = true;
		else if ((edit === true) || (edit === false)) MYAPP.edit = edit;
		else MYAPP.edit = true;
		
		var scen = 	getURLParameter("scen"); 
		MYAPP.permalink = ((scen == undefined) || isNaN(scen)) ? -1 : scen;
		
		var anon = getURLParameter("anon"); 
		if ((anon == "true") && (MYAPP.permalink >= 0)) {
			MYAPP.edit = false;
			MYAPP.anonymousUser = true;
		}
		else MYAPP.anonymousUser = false;
		
		if (!MYAPP.edit) {
			$("#css3menu1").css("display","none");
			$("#toolbar_button").css("display","none");
		}
                         
        // If there is a currently logged-in HiM user, find out who it was and welcome them back.  
        if (!MYAPP.anonymousUser) getCurrentLoggedInUser_Async().done(setupStage2);
        else MYAPP.OKToLoadScenario = true; // No need to wait for successful login, since there is no user
    }
    
    // makeHistoricalMapMenu takes a list of historical maps returned from storage.getMaps_Async and turns it into a set of of <option> elements 
	// that are children of the <select> element which is the second argument.  See storage.saveMap_Async to see the various object properties for 
	// different types of maps.
	
	function makeHistoricalMapMenu (historicalMapList,jqSelect) {
		jqSelect.empty();	// Remove any previous options
		historicalMapList.sort(function (x,y) {	if 		(x.title < y.title)  return -1;
												else if (x.title == y.title) return 0;
												else 						 return 1;
											  });
		jqSelect.append("<option value='-1'>None</option>");
		historicalMapList.forEach(function(z) {
			var option = $("<option value='" + z.mapID + "'>" + z.title + "</option>"); 
			jqSelect.append(option); 
		});
		jqSelect.unbind().on("change", historicalMapList, 
								function (event) {
									var historicalMapList = event.data; // Get the map list under which this handler was created
									var index = jqSelect.val();	// Get selected index 
									if (index < 0) {	// Option selected was "None" (no historical map)
										if (MYAPP.mapLayers) {
											MYAPP.mapLayers.forEach(function (z) { z.setMap(null); }); // Get rid of any historical maps 
											MYAPP.mapLayers = null;
											MYAPP.mapID = null;
										}
										MYAPP.historicalMapListIndex = -1;
										var oldBounds = MYAPP.map.getBounds();  // Re-create map.  This gets rid of any MapTiler callback and
										var mapOptions = {						// thus eliminates display of a MapTiler map.  Not necessary 
											zoom: MYAPP.scenario.scMapZoom,		// if this was a GM Engine map, but it doesn't hurt.
											center: MYAPP.scenario.scMapCenter,
											mapTypeId: google.maps.MapTypeId.ROADMAP,
											keyboardShortcuts: false /* Prevent Maps from handling the arrow keys used for timeline slider control */
										};
										MYAPP.map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
										MYAPP.map.fitBounds(oldBounds);
										return; // User can continue to zoom and pan the map from wherever it was left after the layer was displayed
									}
									else {
										if (MYAPP.mapLayers) {
											MYAPP.mapLayers.forEach(function (z) { z.setMap(null); }); // Get rid of any historical maps 
										}
										var hm; // Entry in historicalMapList of the desired historical map 
										for (var i=0; i < historicalMapList.length; i++) {
											if (historicalMapList[i].mapID == index) {
												hm = historicalMapList[i];
												break;
											}
										}
										switch (hm.manager) {
											case "MapTiler":	// Map was produced by MapTiler 
												var mapBounds = new google.maps.LatLngBounds(
																					new google.maps.LatLng(hm.bounds.south, hm.bounds.west),
																					new google.maps.LatLng(hm.bounds.north, hm.bounds.east)
																				);
												MYAPP.map.setCenter(new google.maps.LatLng(0,0));
												MYAPP.map.setZoom(Number(hm.minZoom));
												MYAPP.map.fitBounds(mapBounds);
												MYAPP.historicalMapListIndex = hm.mapID;
												var overlay = new klokantech.MapTilerMapType(MYAPP.map, storage.getMTMapURL(hm.mapID), mapBounds, hm.minZoom, hm.maxZoom);
												var opacitycontrol = new klokantech.OpacityControl(MYAPP.map, overlay);
												break;
										
											case "GME":	// Map is managed by Google Maps Engine
												MYAPP.map.setCenter(new google.maps.LatLng(hm.lat,hm.lng));
												MYAPP.map.setZoom(Number(hm.initial_zoom));
												MYAPP.mapLayers = addLayersToMap(MYAPP.map,hm.GME_ID,[hm.GME_layer_key]);
												MYAPP.mapID = hm.GME_ID;
												MYAPP.historicalMapListIndex = hm.mapID;
												break;
										}
									}
								});
	 }
    
	// Add the layers required to display this Google Maps Engine Map.
	//
	// @param {google.maps.Map} An existing google.maps.Map object.
	// @return An array of google.maps.visualization.MapsEngineLayer objects.
	
	function addLayersToMap (map,mapID,layerKeys) {
	  // Handles to the layers created.  
	  var layers = [];
	  for (var i = 0; i < layerKeys.length; ++i) {
	  	try {
			layers.push(new google.maps.visualization.MapsEngineLayer({
			  mapId: mapID,
			  layerKey: layerKeys[i],
			  map: map
			}));
		}
		catch (error) {
			var d = $("<div title='Map Unavailable'>We are sorry, but this historical map is not accessible at this time.</div>");
			d.dialog();
			console.log("Error while trying to display historical map.");
			console.log("mapID: " + mapID);
			console.log("layerKeys:"); console.log(layerKeys);
			console.log("Error message: " + error.message);
		}
	  }
	  return layers;
	}
	
	// Return true iff the logged-in user is the HiM system admin, false otherwise 
	
	function userIsSystemAdmin() { 
		return (MYAPP.currentLoggedInUser.userName == "HiM"); 
	}
    
    // Returns a promise of a stringified user.
    function getCurrentLoggedInUser_Async() {
        // Get the username and password from localStorage, but then ask the server for the authoritative copy of this user's data.
        var currentUser;
        if ($.cookie('him_google_user')) {
            currentUser = JSON.stringify({ 'userName': $.cookie('him_google_user'), 'password': 'x' });
        } else {
            currentUser = localStorage.getItem("HiMCurrentLoggedInUser");
        }
        if (currentUser == null || currentUser == undefined) {
            return $.Deferred().resolve(null).promise();
        } else {
            var x = $.parseJSON(currentUser);
            var deferredGetUser = $.Deferred();
            var deferredResult = $.Deferred();
            storage.getUser_Async(x.userName, x.password, deferredGetUser);
            deferredGetUser.done(function (status, user) { return deferredResult.resolve(user); })
            			   .fail(function () { $("<div title='Unable to Connect'>Could not connect to server to login <b>" + x.userName + "</b>.  You can continue working but might not be able to get data from or save data to the server.</div>").dialog({
													autoOpen: true,
													show: { duration: 600 },
													hide: { duration: 600 },
													position: "center"
												});
												return deferredResult.resolve(new ht.User({ "userName" : x.userName, "password" : x.password, "userData": x.userData }));
											});
			return deferredResult.promise();
        }
    }

    // Caches the current user in local storage.
    //
    // Returns nothing.  This function is synchronous, because it will only ever
    // access local storage.  (The server doesn't care who's currently logged in
    // on a client.)
    function setCurrentLoggedInUser(user) {
        $.removeCookie('him_google_user');
        localStorage.setItem("HiMCurrentLoggedInUser",
                             JSON.stringify(user.stringifyUser()));
    }
    
    // Delete current logged in user when logging out in order to force a login next time.
    
    function unsetCurrentLoggedInUser () {
        $.removeCookie('him_google_user');
    	localStorage.removeItem("HiMCurrentLoggedInUser");
    }

    function setupStage2(gotUser) {
        if (!((gotUser == null) || (gotUser == undefined))) { // Welcome back the current logged-in user, i.e., someone who logged in and may have
                                                              // quit HiM without logging out.
            MYAPP.currentLoggedInUser = new ht.User(gotUser);
            makeIconManagerTab($("#icons_MyIcons"),MYAPP.currentLoggedInUser.MyIcons); // Set up Icon Manager tab for user's MyIcons set
            var d = $("#welcome_back_dialog"); // The "Welcome back" <div> 
            d.text("Welcome back, " + MYAPP.currentLoggedInUser.userName);
            
            d.dialog({
                autoOpen: true,
                show: { duration: 600 },
                hide: { duration: 600 },
                position: "center"
            });
            setTimeout(function () { 
                d.dialog("close"); 
                MYAPP.OKToLoadScenario = true; // It's safe to load the scenario now that the login dialog is closed
            },3000);
        }
        else executeLoginDialog();
    }
    
    // executeLoginDialog puts up the login/create new user dialog, checks the user-provided inputs, and sets the current logged-in user.
    // It is invoked from two places: setupStage2 (when HiM is loaded for the first time) or after execution of the Logout command.
    
    function executeLoginDialog () {
     	// There is no current logged-in user
		var d = $("#login_or_create_dialog");	// The login/create user <div>
		clearAllErrors();
		var userName = null; 
		var password = null;
		$("#username").css("display", "inline-block").val(""); // The <input> tags to get the user name & password are initially set to 'display: none'
		$("#password").css("display", "inline-block").val(""); // because if they weren't, they would render on page load, and that is too soon
		if (!MYAPP.listenerSetForForgotUserNameOrPassword) {
			$("#forgot_username").click(function () {
											clearAllErrors();
											setError($("#username"),"useEmail","#336600");
											return;
										});
			$("#forgot_password").click(function () {
											clearAllErrors();
											userName = $("#username").val();
											if ((userName == null) || (userName == "")) {
												setError($("#username"),"blankUser");
												return;
											}
											setError($("#password"),"sentPwd","#336600");
											var deferredForgotPassword = $.Deferred();
											storage.userForgotPassword_Async(userName,deferredForgotPassword);
											deferredForgotPassword.done(function (status) {
												clearError($("#password"));
												if (status.code = "temp_sent") setError($("#password"),"pwdSentOK","#336600");
												else setError($("#password"),"pwdNotSent");
											})
											.fail(function () {
												clearError($("#password"));
												setError($("#password"),"pwdNotSent");
											})
			});
			MYAPP.listenerSetForForgotUserNameOrPassword = true;
		}
		d.dialog({
			autoOpen: true,
			show: { duration: 600 },
			hide: { duration: 600 },
			position: "center",
			modal: true,
			width: 380,
			buttons: [
				{ text: "Login", click: function() {
											clearAllErrors();
											userName = $("#username").val();
											password = $("#password").val();
											if ((userName == null) || (userName == "")) {
												setError($("#username"),"blankUser");
												return;
											} else {
												var deferredGetUser = $.Deferred();
												storage.getUser_Async(userName, password,deferredGetUser);
												// status is info returned by the server: a status code string and a data object (depending on the status code).
												// See web.js for details.
												deferredGetUser.done(function (status, user) { 
													var message, jQobject;
													var successfulLogin = false;
													switch (status.code) {
														case "logged_in_std":
															successfulLogin = true;
															break;
														case "logged_in_temp":
															successfulLogin = true;
															break;
														case "no_user":
															message = "noSuchUser"; jQobject = $("#username");
															break;
														case "bad_pwd":
															message = "badPassword"; jQobject = $("#password");
															break;
														default:
															message = "badStatus"; jQobject = $("#username");
															break;
													}
													if (successfulLogin) {
														MYAPP.currentLoggedInUser = user;
														makeIconManagerTab($("#icons_MyIcons"),MYAPP.currentLoggedInUser.MyIcons); // Set up Icon Manager tab for user's MyIcons set
														d.dialog("close");
														d = $("#welcome_back_dialog"); // The "Welcome back" <div> 
														d.text("Welcome back, " + MYAPP.currentLoggedInUser.userName);
														d.dialog({
															autoOpen: true,
															show: { duration: 600 },
															hide: { duration: 600 },
															position: "center"
														});
														setTimeout(function () { 
															d.dialog("close"); 
															MYAPP.OKToLoadScenario = true; // It's safe to load the scenario now that the login dialog is closed 
														},3000);
														setCurrentLoggedInUser(MYAPP.currentLoggedInUser);
														if (status.code == "logged_in_temp") $("#enclose-menu li:contains(Edit) li:contains(User)").trigger("click");
													}
													else {
														setError(jQobject,message);
													}
												})
												.fail(function () {
													setError($("#username"),"noSuchUser");
												});
											}
										} 
				},
				{ text: "New User", click: function() { 
												clearAllErrors();
												userName = $("#username").val();
												password = $("#password").val();
												if ((userName == null) || (userName == "")) {
													setError($("#username"),"blankUser");
												} 
												else if (userName.length > 40) {
													setError($("#username"),"userTooLong");
												}
												else if (password.length > 20) {
													setError($("#password"),"pwdTooLong");
												}
												else {
													d.dialog("close");
													editOrCreateUserAccount({	uOperation: "create",
																				uName:		userName,
																				uPassword:	password
																			});
												}
										   } 
				}
			]
		});

	}
	
	// updateUser invokes storage.updateUser_Async after packaging up the current values of the userData fields.  This is invoked from FILE/ICONS when 
	// the user has edited his MyIcons icon library, or from editEvent when the user has uploaded one or more files to the server (and thus advanced the 
	// user's file counter stored in the user object).
	
	function updateUser() {
		var userData = JSON.stringify({ uEmail: 		MYAPP.currentLoggedInUser.userData.uEmail,
										uOptIn: 		MYAPP.currentLoggedInUser.userData.uOptIn,
										uYearOfBirth: 	MYAPP.currentLoggedInUser.userData.uYearOfBirth,
										uRole:			MYAPP.currentLoggedInUser.userData.uRole,
										uReason:		MYAPP.currentLoggedInUser.userData.uReason,
										MyIcons:		MYAPP.currentLoggedInUser.MyIcons,
										nextExternalFileID: MYAPP.currentLoggedInUser.nextExternalFileID
									});
		var deferredOperation = $.Deferred();
		storage.updateUser_Async(MYAPP.currentLoggedInUser.userName, MYAPP.currentLoggedInUser.password, userData, deferredOperation);
		deferredOperation.done(function (user) { 
										MYAPP.currentLoggedInUser = user; 
										setCurrentLoggedInUser(MYAPP.currentLoggedInUser); 
									})
		.fail(function () {
			$("<div title='Unable To Update User'>Unable to access the server to update your user record.  Any files you uploaded in this session might be overwritten.  To be safe, do not upload files until you are able to log in successfully again.</div>").dialog();
		});
	}
    
	// checkAndLoadScenarioFromTimer is called as a callback from a timer when the user is logging in, in which case no argument scenarioToLoad is supplied.
	// checkAndLoadScenarioFromTimer checks if it is OK to load a scenario.  If not, it returns.  If it is, and if the user has 
    // a most recent scenario named in userName_mostRecentScenaro, then it is loaded.  If there is no scenario, the function returns and the user can
    // select New Scenario from the menu.
	//
    // checkAndLoadScenario is called as a straight function when the user explicitly wants to load an existing scenario (supplied as the argument).
	
    function checkAndLoadScenarioFromTimer() {
		if (!MYAPP.OKToLoadScenario) return;	// It's not safe yet to load the scenario
        
        clearInterval(MYAPP.OKToLoadScenarioID); // It's safe, so no need to continue to check if it's OK to load scenario
        getInitialScenarioToWorkOn(); // Load the last scenario worked on, or force new scenario creation, or force choice of existing scenario
    }
    
    // getInitialScenarioToWorkOn insures that there is a scenario to be worked on when the user logs in.  There are three cases:
    // 1.	Load the current scenario (last one user was working on).    Compare change dates of server copy vs. working 
	// 		copy to see if it REALLY is the authoritative copy.
	// 2.	If there was no last scenario for this user, get the list of scenario names for him/her.  If this is empty, force scenario creation. 
	// 3.	If there was no last scenario, but the user has some scenarios, force selection and opening of one of them.
	//
	// In addition to the above, at this point we know we have a logged-in user, so load the Common Icon Library.
    
    function getInitialScenarioToWorkOn () {
    	var mostRecentScenario;
    	if (!MYAPP.anonymousUser) {
			var deferredGetCIL = $.Deferred();
			storage.getCommonIcons_Async(deferredGetCIL); // Get the Common Icon Library from the server
			deferredGetCIL.done(function (CIL) { 
				$("#icons_HiM").empty(); //Remove any previously stored common icons to make room for a fresh set
				makeIconManagerTab($("#icons_HiM"),CIL); // Set up structure for the HiM CIL tab
				$("#icon_tabs").tabs();  // Make the tabs active.  At this point the enclosing <div> is invisible.  Visibility will be turned on in click listener for FILE/ICON...
			})
			.fail(function () {
				$("<div title='Unable To Access Server'>Unable to get the Common Icon Library from the server.</div>").dialog();
			});
			mostRecentScenario = storage.getScenarioWorkingCopy(MYAPP.currentLoggedInUser.userName);
		}
    	if (MYAPP.permalink > 0) {	// HiM client was invoked by user's clicking on a permalink (URL with "&scen=X", where X is unique integer 
    								// specifying the scenario to load.  
    		var deferredGetPermalink = $.Deferred();
    		storage.getScenarioWithPermalink_Async(MYAPP.permalink,deferredGetPermalink);
    		deferredGetPermalink.done(function(JSONifiedScenario) {
    			checkAndLoadScenario(JSONifiedScenario);
    		})
    		.fail(function() {
    			$("<div title='Unable To Load Scenario'>Scenario number " + MYAPP.permalink + " could not be found or loaded from the server.</div>").dialog();
    			MYAPP.permalink = -1;
    			getInitialScenarioToWorkOn (); // Try again, but this time ignore the (bad) permalink
    		});
    	}
    	// We'll only get here if there is a real (i.e., not anonymous user).  Anonymous user must be called with a valid permalink; that is checked earlier.
        else if (mostRecentScenario) checkAndLoadScenario(mostRecentScenario);
        else {
        	var scenarioNamesArray = [];
			getScenarioNames_Async().done(function(scenarioNamesArray) { // Get the list of this user's scenario names list
				MYAPP.caseForOpeningScenario = 3; // Forces user to create or open one; doesn't allow user to exit otherwise
				if (scenarioNamesArray.length == 0) { // There aren't any scenarios for this user, so force him to create one 
					$("#enclose-menu li:contains(New) li:contains(Scenario)").trigger("click");
				}
				else { // There is at least one scenario, so force a selection of opening one
					$("#enclose-menu li:contains(File) li:contains(Open...)").trigger("click");
				}
			});
        }
    }

	// saveWorkingCopy saves the current scenario as a local working copy.
	//
	//		cleanCopyFromServer		true if this scenario was just loaded from the server or will be written to the server just after this function is called 
	//								false if this call represents an editing update to the scenario that is just made locally and needs to be written to the server 
	//									(or explicitly discarded by the user)

    function saveWorkingCopy(cleanCopyFromServer) {
    	MYAPP.workingCopyIsSaved = cleanCopyFromServer; // Working copy has been changed locally but not saved to the server
        saveCurrentScenarioName();
        storage.saveScenarioWorkingCopy(MYAPP.currentLoggedInUser.userName, MYAPP.scenario);
    }
    
    // saveAuthoritativeCopy_Async writes the scenario to the server.  
    //		newScenario				true => this is a new scenario to be created on the server
    //								false => this is an existing scenario to be updated on the server 
    //		deferredSaveScenario	jQuery deferred object to be resolved or rejected based on server response

    function saveAuthoritativeCopy_Async(newScenario, deferredSaveScenario) {
    	MYAPP.workingCopyIsSaved = true;
        return storage.saveScenario_Async(MYAPP.currentLoggedInUser.userName,
                                          MYAPP.currentLoggedInUser.password,
                                          MYAPP.scenario.scName,
                                          MYAPP.scenario, 	   // Save the scenario itself in storage
                                          newScenario, deferredSaveScenario);
    }
    
    // checkAndLoadScenario takes the  JSONified, stringified scenario and recreates the beginning and ending HistoricalDates, the timelines, the locations, and the
	// events.  All the other fields are just basic types.
	//
	// scenarioToLoad			a JSONified, stringified scenario to make into a Scenario object 
	// cleanCopyFromServer		true if this is a clean copy from the server
	//							false otherwise
	// deferredScenarioIsLoaded	jQuery $.Deferred object which is resolved when the scenario is fully loaded.  This is necessary because if a scenario has 
	//								a historical map, getting that map is an asynchronous operation, and so calling checkAndLoadScenario must be treated 
	//								as an asynchronous operation even in cases when it isn't (i.e., there is no historical map to retrieve)

	function checkAndLoadScenario(scenarioToLoad,cleanCopyFromServer,deferredScenarioIsLoaded) {
		// If there is no deferred object passed as a parameter, the caller works correctly regardless of whether this function works synchronously or 
		// asynchronously.  (The only case found so far (11/12/14) where the asynchrony matters is when the user is asking to edit a scenario that is 
		// (1) not the one currently loaded, and (2) has a historical map.)  So let's just create a deferred object within checkAndLoadScenario and pass it 
		// to finishLoadingScenario.  When it is resolved there, no caller will care.  
	
		if (deferredScenarioIsLoaded == undefined) deferredScenarioIsLoaded = $.Deferred();
		
		// Before we load the scenario, check if we have a GM map listener for the current scenario, and if so, remove it.  This listener 
		// checks for map resizing.  A new one will be created below in this function.
		if (MYAPP.mapListener != undefined) google.maps.event.removeListener(MYAPP.mapListener);
		var timelines = [];
		var externalFileList = [];
		var x = $.parseJSON(scenarioToLoad); // Make the JSONified stored string into a Javascript object.
										 				// The object is the stringified version of the scenario.
										 	
		// Recreate the Timeline objects
	
		for (var i=0; i < x.scTimelines.length; i++) {
			externalFileList = [];
			if (x.scTimelines[i].externalFileList != undefined) {
				for (var j=0; j < x.scTimelines[i].externalFileList.length; j++) {
					externalFileList[j] = new ht.ExternalFile(x.scTimelines[i].externalFileList[j]);
				}
			}
			timelines[i] = new ht.Timeline(x.scTimelines[i].ID,			// ID for Draft Riots scenario was generated as part of loading that
										   x.scTimelines[i].title,		// JSON file.  For all other/new timelines, it's assigned when the TL
										   x.scTimelines[i].description,// is created and is the max TL ID for this scenario (0, if no TLs) plus 1.
										   x.scTimelines[i].enabled,
										   x.scTimelines[i].displayPathEventNames,
										   new ht.HistoricalDate(x.scTimelines[i].begin.GMT, x.scTimelines[i].begin.circa),
										   new ht.HistoricalDate(x.scTimelines[i].end.GMT, x.scTimelines[i].end.circa),
										   new ht.Clock(new ht.ClockRate(x.scTimelines[i].clock.clockRateNominal.historicalDeltaTAmount,
													  x.scTimelines[i].clock.clockRateNominal.historicalDeltaTUnit,
													  x.scTimelines[i].clock.clockRateNominal.wallClockDeltaTAmount,
													  x.scTimelines[i].clock.clockRateNominal.wallClockDeltaTUnit)),
											x.scTimelines[i].utcOffset,
											x.scTimelines[i].timeZone,
											x.scTimelines[i].format,	// The format guide for this timeline may be undefined, but that is OK -- they're optional
											x.scTimelines[i].start_desc,
											x.scTimelines[i].end_desc,
											x.scTimelines[i].startSoundtrack,
											x.scTimelines[i].endSoundtrack,
											externalFileList);
		}
		
		// If a historical map is specified, find it in the historical map list and process it according to its mapType.
		if (x.scHistoricalMapListIndex == undefined) x.scHistoricalMapListIndex = -1; // -1 is the value of "None" in historical map menus
		if (x.scHistoricalMapListIndex >= 0) {	// Create the Google map and process the historical map according to its type
			deferredGetMap = $.Deferred();
			storage.getMap_Async(x.scHistoricalMapListIndex,deferredGetMap);
			deferredGetMap.done(function(map) {
				switch (map.manager) {
					case "GME":		
						var mapCenter = new google.maps.LatLng(
												parseFloat(x.scMapCenter.lat, 10),
												parseFloat(x.scMapCenter.lng, 10));
						var mapOptions = {
							zoom: x.scMapZoom,
							center: mapCenter,
							mapTypeId: google.maps.MapTypeId.ROADMAP,
							keyboardShortcuts: false /* Prevent Maps from handling the arrow keys used for timeline slider control */
						};
						MYAPP.map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);	
						// If a historical map is specified via its GM mapID and layer key(s), add the map layers
						if (x.scMapID && x.scMapLayerKeys) MYAPP.mapLayers = addLayersToMap(MYAPP.map,x.scMapID,x.scMapLayerKeys);
						break;
					case "MapTiler":
						var mapCenter = new google.maps.LatLng(0,0);
						var mapOptions = {
							zoom: Number(map.minZoom),
							center: mapCenter,
							mapTypeId: google.maps.MapTypeId.ROADMAP,
							keyboardShortcuts: false /* Prevent Maps from handling the arrow keys used for timeline slider control */
						};
						MYAPP.map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
						var mapBounds = new google.maps.LatLngBounds(
															new google.maps.LatLng(map.bounds.south, map.bounds.west),
															new google.maps.LatLng(map.bounds.north, map.bounds.east)
														);
						MYAPP.map.fitBounds(mapBounds);
						mapCenter = MYAPP.map.getCenter(); // Needed because the iOS app needs the true map center, not (0,0)
						MYAPP.historicalMapListIndex = map.mapID;
						var overlay = new klokantech.MapTilerMapType(MYAPP.map, storage.getMTMapURL(map.mapID), mapBounds, Number(map.minZoom), Number(map.maxZoom));
						var opacitycontrol = new klokantech.OpacityControl(MYAPP.map, overlay);
						break;
				}
				finishLoadingScenario(x,mapCenter,timelines,cleanCopyFromServer,deferredScenarioIsLoaded);
			})
			.fail(function () {
				$("<div title='Server Unavailable'>Unable to get the historical map for this scenario from server.</div>").dialog();
				finishLoadingScenario(x,mapCenter,timelines,cleanCopyFromServer,deferredScenarioIsLoaded); // Continue loading the scenario -- user will just have to live without historical map
			});
		}
		else {	// There is no historical map for this scenario
			var mapCenter = new google.maps.LatLng(
											parseFloat(x.scMapCenter.lat, 10),
											parseFloat(x.scMapCenter.lng, 10));
			var mapOptions = {
				zoom: x.scMapZoom,
				center: mapCenter,
				mapTypeId: google.maps.MapTypeId.ROADMAP,
				keyboardShortcuts: false /* Prevent Maps from handling the arrow keys used for timeline slider control */
			};
			MYAPP.map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
			finishLoadingScenario(x,mapCenter,timelines,cleanCopyFromServer,deferredScenarioIsLoaded);
		}
	}
	
	// finishLoadingScenario completes the scenario loading after the Google map is set up (with or without a historical map as the case may be).
	// 		x						the de-JSONified scenario retrieved from the server
	//		mapCenter				center of Google Map for this Scenario
	//		timelines				array of Timeline objects for scenario 
	// 		cleanCopyFromServer		true if this is a clean copy from the server
	//								false otherwise
	// 		deferredScenarioIsLoaded	jQuery $.Deferred object which is resolved when the scenario is fully loaded.  This is necessary because if a scenario has 
	//								a historical map, getting that map is an asynchronous operation, and so calling checkAndLoadScenario must be treated 
	//								as an asynchronous operation even in cases when it isn't (i.e., there is no historical map to retrieve)
	
	function finishLoadingScenario(x,mapCenter,timelines,cleanCopyFromServer,deferredScenarioIsLoaded) {
		var locations = [];
		var events = [];
		var externalFileList = [];
		
		// Recreate the ExternalFiles (references to uploaded files in the opening and closing contexts of the scenario 
		
		if (x.scExternalFileList != undefined) {
			for (var i=0; i < x.scExternalFileList.length; i++) {
				externalFileList[i] = new ht.ExternalFile(x.scExternalFileList[i]);
			}
		}
		
		// Recreate the events and locations of the scenario.  
	
		for (var i=0; i < x.scLocations.length; i++) {
			locations[i] = new ht.HistoricalEvent(x.scLocations[i], MYAPP.map); 
			if (locations[i].externalFileList) {
				for (var j=0; j < locations[i].externalFileList.length; j++) {
					 locations[i].externalFileList[j] = new ht.ExternalFile(locations[i].externalFileList[j]); // Make the plain Object into an ExternalFile object
				}
			}
		}
		for (var i=0; i < x.scEvents.length; i++) 	 { 
			events[i] 	= new ht.HistoricalEvent(x.scEvents[i], MYAPP.map); 
			if (events[i].externalFileList) {
				for (var j=0; j < events[i].externalFileList.length; j++) {
					 events[i].externalFileList[j] = new ht.ExternalFile(events[i].externalFileList[j]); // Make the plain Object into an ExternalFile object
				}
			}
			
			// In any time span where the event is made visible, there should be click and right-click GM event listeners set up to display the 
			// event description (click) and edit information (right-click).  Save the IDs of the listeners.  When the time span of visibility ends,
			// clear the listeners.  This process will be repeated for each time span during which the event is made visible.  (No need to do this for
			// locations, because they have their listeners set up once for any instantiation of the scenario.)
			
			events[i].GMclickListenerID = null;
			events[i].GMrightClickListenerID = null;
		}
		
		var SSIL = [];	// If there is a scenario-specific icon library (SSIL), recreate it as a set of ExternalFile objects.
		if (x.scSSIL) {
			for (var i=0; i < x.scSSIL.length; i++) SSIL[i] = new ht.ExternalFile(x.scSSIL[i]);
		}
		MYAPP.scenario = new ht.Scenario(x.scName,
										 x.scAuthor,
										 x.scCopyright,
										 x.scChangeDates,
										 { mapCenter: mapCenter, 
										   mapZoom: x.scMapZoom,
										   mapID: x.scMapID,
										   mapLayerKeys: x.scMapLayerKeys,
										   historicalMapListIndex: x.scHistoricalMapListIndex 
										 },
										 locations,
										 events,
										 new ht.HistoricalDate(x.scBegin.GMT,x.scBegin.circa),
										 new ht.HistoricalDate(x.scEnd.GMT,x.scEnd.circa),
										 timelines,
										 (x.scDefaultEra) ? x.scDefaultEra : "CE",
										 (x.scDefaultTimeZone) ? x.scDefaultTimeZone : "Universal Time (UTC+0)",
										 (x.scFormat) ? x.scFormat : MYAPP.defaultHistoricalDateFormatGuide,
										 SSIL,
										 x.scStartDesc,
										 x.scEndDesc,
										 x.scStartSoundtrack,
										 x.scEndSoundtrack,
										 externalFileList
										 );
		$("#icons_SSIL").empty(); // Remove any icons in previously loaded scenario's SSIL
		makeIconManagerTab($("#icons_SSIL"),MYAPP.scenario.scSSIL); // Set up Icon Manager tab for this scenario-specific icon library
		MYAPP.scenario.scChangeDates.lastOpenedDate = new Date();
		MYAPP.min_epoch = MYAPP.scenario.scBegin.GMT;
		MYAPP.max_epoch = MYAPP.scenario.scEnd.GMT;
	
		// For each of the locations, make it visible and set up an event handler for the mouse click to display the location description.
		// Also set up an event handler for right-click to invoke function to edit or delete the location.
	   
		MYAPP.scenario.scLocations.forEach(function(spec, index) {
			var GMobject;		// The marker, polyline, or polygon
		
			if 		(spec.marker) 		GMobject = spec.marker;	
			else if (spec.polyline)		GMobject = spec.polyline; 
			else if (spec.GMpolygon)	GMobject = spec.GMpolygon;	
		
			GMobject.setVisible(true);
			if (spec.AEmarker) spec.AEmarker.setVisible(true); // If this is an area event with an icon, make the icon visible
			if (!(spec.description))  spec.description = "";
			spec.infoWindow = new google.maps.InfoWindow({
									content: "<b>" + spec.name + "</b><p>" + spec.description + "</p>" });
			spec.GMclickListenerID = google.maps.event.addListener(GMobject, 'click', function(event) {
																						if (GMobject == spec.marker) spec.infoWindow.open(GMobject.map,spec.marker);
																						else {
																							spec.infoWindow.setPosition(event.latLng);
																							spec.infoWindow.open(GMobject.map);
																						}
																						spec.infoWindow.setZIndex(1000); // Place the description infoWindow in front of open hover windows of any concurrent events
																					});
			spec.GMrightClickListenerID = google.maps.event.addListener(GMobject, 'rightclick', function (event) {
																										if (!MYAPP.edit) return; // editing is not allowed
																										setupToEditEvent(MYAPP.scenario.scLocations[index].eventID,GMobject,true);
																									});
		});
	
		// This sort should be unnecessary, as every insertion of a new event will be in its sorted place and every deletion
		// doesn't change the sort order of the existing sorted events.

		MYAPP.scenario.scEvents.sort(function (left, right) {
			switch (left.begin.compareHistoricalDate(right.begin,MYAPP.dateTolerance)) {
				case "before":     return -1;
				case "concurrent": return  0;
				case "after":      return  1;
			}
		});
		
		$("#scenario_name").text(MYAPP.scenario.scName); // Set the scenario name in the HiM framework HTML
		$("#browser_title").text(MYAPP.scenario.scName); // Set the scenario name in the browser tab
		
		// If there is a timeline or scenario context displayed, close it before trying to open one for this scenario.  Also stop any soundtracks that 
		// may be playing.
		
		if (MYAPP.SOCisVisible) $("#scenario_opening_context").dialog("close").css("display","none");
		if (MYAPP.SCCisVisible) $("#scenario_closing_context").dialog("close").css("display","none");
		if (MYAPP.TOCisVisible) $("#timeline_opening_context").dialog("close").css("display","none");
		if (MYAPP.TCCisVisible) $("#timeline_closing_context").dialog("close").css("display","none");
		operateMedia("sc_start_desc_soundtrack","stop");
		operateMedia("sc_end_desc_soundtrack","stop");
		operateMedia("tl_start_desc_soundtrack","stop");
		operateMedia("tl_end_desc_soundtrack","stop");
		
		// If there is an opening context for this scenario, display it, but only if the scenario is being loaded for execution, not editing.
		// Similarly, start the soundtrack, if any.
		
		if ((MYAPP.commandInProgress == null) || (MYAPP.commandInProgress == "FILE/OPEN")) {
			if (MYAPP.scenario.scStartDesc != "") {
				$("#scenario_opening_context").empty().append(MYAPP.scenario.scStartDesc).css("display","block").dialog({ 	autoOpen: true,
																															show: { duration: 600 },
																															hide: { duration: 600 },
																															title: MYAPP.scenario.scName + ": Introduction",
																															width: 700,
																															height: 400,
																															beforeClose: function (event, ui) {
																																			MYAPP.SOCisVisible = false;
																																			operateMedia(MYAPP.scenario.scStartSoundtrack,"stop");
																																			return true;
																																		 }
			
																														});
				MYAPP.SOCisVisible = true;
			}
			operateMedia(MYAPP.scenario.scStartSoundtrack,"start",
						((MYAPP.browserType == "Firefox") && (MYAPP.scenario.scStartDesc == ""))); // Start the soundtrack, if there is one. 
		}
		
		
	
		setupScenarioTimelinesAndListeners({
												setupTimelineSelectListener: (MYAPP.scenario.scTimelines.length > 0)
		});
		
        // Now that the scenario (NOT one specified as a permalink) is loaded, store the working copy in local storage.
        // When checkAndLoadScenario is called initially to load the scenario from the working copy, we don't know if it really is the latest copy.
		// Get its lastModified date and compare it to the one on the server.  (Must exclude the permalink case because the permalinked scenario 
		// might originally come from a different user, so trying to get the current scenario (i.e., using the current scenario name and the current 
		// user's name) might result in the scenario's not being found.)
		
		if (MYAPP.permalink < 0) {
			if (cleanCopyFromServer == undefined) {	
				var workingCopyLastModified = new Date(x.scChangeDates.lastModifiedDate).getTime();
				var deferredGetScenario = $.Deferred();
				getCurrentScenario_Async(deferredGetScenario);
				deferredGetScenario.done(function(s) {
											s = $.parseJSON(s); 
											var authoritativeCopyLastModified = new Date(s.scChangeDates.lastModifiedDate).getTime();
											cleanCopyFromServer = (workingCopyLastModified == authoritativeCopyLastModified);
											saveWorkingCopy(cleanCopyFromServer);
											deferredScenarioIsLoaded.resolve(); 
										})
									.fail(function() {
											$("<div title='Unable To Connect To Server'>Unable to verify that you are using the latest copy of <b>" + x.scName +
												"</b>.  You can edit this local copy, but you may miss or overwrite changes you may have created on another computer.</div>")
												.dialog({	autoOpen: true,
															show: { duration: 600 },
															hide: { duration: 600 },
															position: "center",
															width: 400	
														});
											deferredScenarioIsLoaded.resolve();
											});
			}
			else saveWorkingCopy(cleanCopyFromServer);
			deferredScenarioIsLoaded.resolve();
		}
		else {	
		// Scenario was loaded via permalink.  Need to determine if this is a scenario owned by this user.  If it is, then OK to save it as the working 
		// copy with cleanCopyFromServer = true.  If it is not owned by the user, then save the working copy with cleanCopyFromServer = true, but also save 
		// the authoritative copy to the server under this user's name.  Note that the server will detect if there is a name conflict with a scenario 
		// for which this user is the owner; if so, the server will generate a new name and return it to the client, and then we can save that new 
		// name as part of the scenario when it is saved as the working copy and authoritative copy.
			if (MYAPP.anonymousUser) return; // No need to save scenario under a unique name for this user, since there isn't a user 
			var permalink = MYAPP.permalink;
			MYAPP.permalink = -1; // Reset it so if current user logs out and another user logs in, we don't re-load this permalinked scenario.
			var deferredMakeScenarioUniqueForThisUser = $.Deferred();
			storage.makeScenarioUniqueForThisUser_Async(MYAPP.currentLoggedInUser, permalink, deferredMakeScenarioUniqueForThisUser);
			deferredMakeScenarioUniqueForThisUser.done(function(result) { // See storage.makeScenarioUniqueForThisUser_Async for explanation of result
				if (result.nameChanged) {
					MYAPP.scenario.scName = result.newName;	// Server had to generate a modified (new) name for the scenario to make its name unique for this user
					$("#scenario_name").text(MYAPP.scenario.scName); // Set the scenario name in the HiM framework HTML
					$("#browser_title").text(MYAPP.scenario.scName); // Set the scenario name in the browser tab
				}
				if (!result.userWasOwner) {
					masterReplaceExternalFileReferences(true, // Replace original owner's icon references as well as the other external files
														function () {	serverUnavailable({	op: "CopyFiles",
																							name: MYAPP.scenario.scName,
																							clear: false,
																							extraText: ". Cannot make copies of external files specific to this scenario."
																							})
																	},								// External file copy on server failed
    											 		function () {	},								// We're not in the middle of processing a command, so the empty function can be called to "indicate" completion
    											 		function () { 	saveWorkingCopy(true); },		// Callback when scenario is saved on server
    											 		function () {	$("<div title='Unable To Connect To Server'>Unable to update copy of <b>" + MYAPP.scenario.scName +
																			"</b>.  You can edit this local copy, but be sure to FILE/SAVE it later to the server.</div>")
																			.dialog({	autoOpen: true,
																						show: { duration: 600 },
																						hide: { duration: 600 },
																						position: "center",
																						width: 400	
																					});
																		}
														);
				}
				else saveWorkingCopy(true);
				deferredScenarioIsLoaded.resolve();
			})
			.fail(function() {
				// Do nothing.  In particular, don't make the current permalinked scenario the working copy.  That would make the client's view of the 
				// scenarios the user owns out of sync with the server's database view.  The user can continue to play with the permalinked scenario, but 
				// unless he dies a FILE/SAVE or FILE/SAVE AS, it will be subsequently as if he never saw this scenario.
				deferredScenarioIsLoaded.resolve();
			});
		}
	}
	
	// setupScenarioTimelinesAndListeners is called to do one of two things: initialize a set of timelines for a scenario, along with the Timeline
	// select box change listener, the document keypress listener, the GM bounds_changed event listener, and the time display click listener 
	// when a scenario is loaded, OR to do the same thing when the scenario is refreshed.
	// The difference between the two situations is that in the latter, (a) it is not necessary to queue a click listener for the Select Timeline HTML element, 
	// because it's already there, and (b) the time slider position, and current time set from it, is not necessarily 0.
	//
	// setupScenarioTimelinesAndListeners takes one argument, options, which is an object with the following elements:
	//		setupTimelineSelectListener		true when the scenario is being loaded, false when it is being refreshed
	
	function setupScenarioTimelinesAndListeners (options) {
		// Set up the menu of enabled timelines from which to select one to play.
	
		$('#Select_Timeline').empty(); // First get rid of timeline selection options from  the previous scenario (if there was one) 
		MYAPP.scenario.scTimelines.forEach(function(tl) {
			if (tl.enabled) { 
				var option = $("<option>" + tl.title + "</option>").data("timelineID",tl.ID); /* Associate the timeline's ID with the selection */
				$('#Select_Timeline').append(option); /* The timeline's title and ID */
			}
		});
		
		// If there are no timelines for this scenario (e.g., it's just been created and no events or TLs have been created for it), then several things
		// need to be cleared or reset:
		//		1. Blank out any previously displayed time
		//		2. Set time slider position to 0
		//		3. Remove any data associated with previous timeline
		//		4. Set timeline ID to bogus value (-1) so initial timeline choice will force the setup of execution parameters  
		//		5. Remove click event handler for timeline selection
		//		6. Disable the timeline play button
	
		$(document).unbind("keydown"); // Always unbind, or there will be as many listeners as there are scenarios with timelines opened in this session
		if (MYAPP.scenario.scTimelines.length == 0) {	
			$('#current_time').text("");   	
			$("#slider-box").slider({
        						slide: function(event, ui) { 
        								setTimePosition(ui.value); },
        						value: 0,
        						max: 0,
        						min: 0
    						}).removeData().data("timelineID", -1);  
			$('#Select_Timeline_Form').unbind("change");
			$('#play_button').button("disable");
			if (!options.setupTimelineSelectListener) return;
		}
		else {
			$('#play_button').button("enable");
			$("#slider-box").slider({
        					slide: function(event, ui) { 
        								setTimePosition(ui.value); },
    						}).data("timelineID", -1); /* Set nonexistent timeline ID so initial timeline choice will force the setup of execution parameters */
		}
		 
		// From this point on in the function, we know there is at least one timeline in this scenario and in the Select_Timeline <select> element.
		
		// When user clicks to make a timeline selection, calculate the upper limit of the slider so that the minimum change in slider position, 
		// given the timeline's duration and clock rate, and the sleep interval for the timeline play loop (which is the same for all timelines),
		// is 1. Anything less than 1 is effectively ignored by the jQuery UI slider widget.
		//  
		// The $('#Select_Timeline') click listener takes an optional parameter positionArray (jQuery's .trigger API wants to pass an array)
		// which has one or two elements, which is the position at which to initialize this timeline.  The element positionArray[0] can be one of two values:
		//		"max"				Set the position to be the maximum for the slider
		//		"recalc", oldHD		Set the position to be that number corresponding to the next array value, oldHD, which is a HistoricalDate
		//
		// Need to unbind the Select_Timeline "on change" listener, or else repeated FILE/OPENs in a session will pile up multiple copies of the listener.
		
		$('#Select_Timeline').unbind("change").on("change",function (event,optionalOperation,optionalOldHD) {
			var initialPosition = 0;
			var x=document.getElementById("Select_Timeline").selectedIndex;
			var y=document.getElementById("Select_Timeline").options;
			var deltaPos; /* Increment of the time slider to advance slider by */
			var ID = $(y[x]).data("timelineID"); /* Get ID of the selected timeline */
			var tl; /* The user-selected timeline to play */
			var tlDuration; /* Historical-time duration of the tl, in seconds */
			var scaleFactor = 1; /* Factor by which to scale up the max value of the slider and multiply deltaPos to get it to 1 */
			for (var i=0; i < MYAPP.scenario.scTimelines.length; i++) {
				if (ID == MYAPP.scenario.scTimelines[i].ID) { tl = MYAPP.scenario.scTimelines[i]; break; }
			}
			tlDuration = tl.end.calculateHistoricalDuration(tl.begin)/1000;
			deltaPos = (100 * (MYAPP.baseInterval/1000)) / (tlDuration / tl.clock.clockRateImplied.historicalDeltaTAmount);
			if (deltaPos < 1) {
				scaleFactor = 1 / deltaPos;
				deltaPos = 1;
			}
			/* Set max possible value of time slider for this tl, and stash the deltaPos, tl's duration, and entire tl in the slider jQuery object */
			$("#slider-box").slider("option", "max", 100 * scaleFactor).data( {"deltaPos": deltaPos, "tlDuration": tlDuration, "timeline": tl, "timelineID": ID});
			if (optionalOperation != undefined) {
				if (optionalOperation == "max") initialPosition = 100 * scaleFactor;
				else if (optionalOperation == "recalc") {
					initialPosition = tl.convertHistoricalDateToPosition(optionalOldHD);
				}
				else { console.log("Unknown operation "); console.log(optionalOperation); }
			} 
			// Go through all events in the current scenario.  For each path and area event, use the new TL's implied clock rate to calculate the number of 
			// intervals to divide the path/area into to get a smooth growth pattern.
			
			MYAPP.scenario.calculateGrowthIncrements(MYAPP.baseInterval,tl.clock.clockRateImplied,MYAPP.maxAllowableAnimationPolygons);
			
			// Attach a historical-date format guide object to #current_time for use in formatting dates.  Use the one from the selected TL 
			// if it exists, or from the current scenario otherwise.  (The latter will always have one, even if it is only the default.)
			
			if (tl.format != undefined) $("#current_time").data({ "format": tl.format,			    "format_source": "timeline" });
			else						$("#current_time").data({ "format": MYAPP.scenario.scFormat,"format_source": "scenario"});
			setTimePosition(initialPosition); 				/* Set time display to initial value for this timeline */
			$("#slider-box").slider("value",Math.floor(initialPosition)).data("fractionalPosition",initialPosition - Math.floor(initialPosition));	/* Set time slider to initial value for this timeline */
		});
		
		/* The user can press the arrow keys to advance the clock in discrete manual mode (up/down) or discrete event mode */
		/* (left/right).  Note that if the timeline <select> element has the focus, it will catch the up/down arrows, which */
		/* is OK.  The user just needs to move the focus by clicking elsewhere if s/he wants to use those arrows to move */
		/* the timeline. */
	
		/* Note than when the Google Maps canvas is created below, we disable keyboard shortcuts so GM doesn't handle the arrow keys too. */
		
		// Setting this event listener must happen only when a scenario is loaded.  Since it listens for an event on the entire document,
		// if we set it before the scenario is loaded and the user pressed one of the listened-for keys, it would blow up because the
		// scenario-specific global variables will not have been set yet.
	
		$(document).keydown(function(e) {
			if ((e.which < 37) || (e.which > 40)) return; // We only care about the arrow keys
			var s = $("#slider-box");
			var maxPosition = s.slider("option", "max"); /* Timeline-dependent max position of time slider  */
																		/* Set when user clicks to select a timeline */
			var minPosition = s.slider("option", "min"); /* Min position of time slider (never changes) */
			
			// Despite use the the scale factor, set the in the $('#Select_Timeline_Form') change listener, it is possible that the time of an event does
			// not correspond to a slider position which is an integer. But the slider only understands integer positions.  So we need to save the
			// fractional part of the position as a data item attached to the $("#slider-box"), in order to calculate the exact HistoricalDate
			// corresponding to that position.  If we only relied on $("#slider-box").slider("value"), we would get the integer part only, and end up
			// with a HistoricalDate that is just a little earlier than the event start, and would be stuck there.
			
			var fractionalPart = s.data("fractionalPosition");
			if (fractionalPart == undefined) fractionalPart = 0;
			var position = s.slider("value") + fractionalPart; /* Current position of the time slider */
			var deltaPos = s.data("deltaPos"); /* Increment of the time slider to advance slider by in continuous clock mode */
															  /* This is set when user clicks to select a timeline */ 
			deltaPos = deltaPos * (1000/MYAPP.baseInterval);  /* If up/down arrow pressed, change position equivalent to one second of wall-clock time */
			var tl = s.data("timeline");	/* Timeline being managed by this slider */
			var currentHD = tl.convertPositionToHistoricalDate(position);
			switch (e.which) {
				case 38: /* Up-arrow: Move forward in time by a fixed amount */
					position = position + deltaPos;
					break;
				case 40: /* Down-arrow: Move backward in time by a fixed amount */
					position = position - deltaPos;
					break;
				case 37: /* Left-arrow: Move backward to previous event's start time */
					if (MYAPP.commandInProgress != null) {
						if ((MYAPP.commandInProgress.indexOf("NEW") > -1) ||
					        (MYAPP.commandInProgress.indexOf("EDIT") > -1)) return; // Arrow key may be used to move in a text field in scenario or event editing or creation
					}
					// Find the first event (if any) whose start time is before the current HistoricalDate.
					var foundEarlierEvent = false;
					for (var i=MYAPP.scenario.scEvents.length-1; i > -1; i--) {
						if (MYAPP.scenario.scEvents[i].begin) {
							if (MYAPP.scenario.scEvents[i].begin.compareHistoricalDate(currentHD,MYAPP.dateTolerance) == "before") {
								var newPosition = tl.convertHistoricalDateToPosition(MYAPP.scenario.scEvents[i].begin);
								foundEarlierEvent = true;
							
								// If the difference between the old and new positions is < 1, then keep looping.  
								// This can arise because times do not correspond exactly to integer positions, so while
								//    an event's start time might be 9:00:00 AM, the corresponding position, when converted
								//    back to a time, might be 9:00:04 AM.  So if we didn't have this "delta position >= 1" check,
								//    we would be stuck on the same event, because 9:00:00 AM is always before 9:00:04 AM.
							
								if (Math.abs(position - newPosition) >= 1) {
									position = newPosition;
									break;
								}
							}
						}
					}
					if (!foundEarlierEvent)  { 
						var earliestPossiblePosition = tl.convertHistoricalDateToPosition(MYAPP.scenario.scEvents[0].begin);
						if (position < earliestPossiblePosition) position = earliestPossiblePosition;
					}
					break;
				case 39: /* Right-arrow: Move forward to the next event's start time */
					if (MYAPP.commandInProgress != null) {
						if ((MYAPP.commandInProgress.indexOf("NEW") > -1) ||
					        (MYAPP.commandInProgress.indexOf("EDIT") > -1)) return; // Arrow key may be used to move in a text field in scenario or event editing or creation
					}
					// Find the first event (if any) whose start time is after the current HistoricalDate.
					var foundLaterEvent = false;
					for (var i = 0; i < MYAPP.scenario.scEvents.length; i++) {
						if (MYAPP.scenario.scEvents[i].begin) {
							if (MYAPP.scenario.scEvents[i].begin.compareHistoricalDate(currentHD,MYAPP.dateTolerance) == "after") {
								var newPosition = tl.convertHistoricalDateToPosition(MYAPP.scenario.scEvents[i].begin);
								// See above explanation for delta position check.
								foundLaterEvent = true;
							
								if (Math.abs(position - newPosition) >= 1) {
									position = newPosition;
									break;
								}
							}
						}
					}
					if (!foundLaterEvent)  { 
						var last = MYAPP.scenario.scEvents.length - 1;
						var ultimatePosition = tl.convertHistoricalDateToPosition(MYAPP.scenario.scEvents[last].begin);
						if (position > ultimatePosition) position = ultimatePosition;
					}
					break;
				default:
					return;
			}
			if (position > maxPosition) { position = maxPosition; }
			else if (position < minPosition) { position = minPosition; };
			s.slider("value", Math.floor(position)).data("fractionalPosition",position - Math.floor(position)); /* Set both the slider position... */
			setTimePosition(position);   /* ...and the time position (what events are visible) */
			return;
		}); 
		
		// Create a GM listener for the "bounds_changed" event.  This is triggered whenever the user zooms in or out or moves the map 
		// either manually or by clicking on one of the "sector" buttons set up in setTimePosition.  The purpose of the listener is to 
		// reset the MYAPP.viewportBounds object properties.  
		
		MYAPP.mapListener = google.maps.event.addListener(MYAPP.map, "bounds_changed",
			function (event) {
				// Initialize one of the three global variable objects in MYAPP that hold information about the viewport 
				// (i.e., the portion of the map that is in view) and the events that are visible (from a time perspective) but are beyond the 
				// boundaries of the viewport.  The purpose of this is to be able, at every point in time, to display buttons at the four sides and 
				// four corners of the map if there are visible events outside the current viewport.  This will enable the user to click on a 
				// button and redraw the map to include the visible events in the sector where the user has clicked the button.  (The user could 
				// choose to use the zoom control to zoom out.)
				//
				// The object is (see setTimePosition for the other two):
				//			Object					Properties					Type		Meaning			
				//		MYAPP.viewportBounds 	north, south, east, west 		n/s: lat,	The lat or lng of the viewport border
				//									 							e/w: lng			
			
				MYAPP.viewportBounds = {	north: MYAPP.map.getBounds().getNorthEast().lat(),
											east:  MYAPP.map.getBounds().getNorthEast().lng(),
											south: MYAPP.map.getBounds().getSouthWest().lat(),
											west:  MYAPP.map.getBounds().getSouthWest().lng()
										};
				var s = $("#slider-box");
				// If there is a current timeline and the time slider is currently paused, call setTimePosition with the current position 
				// in order to force a redraw of the sector buttons based on the new viewport's changed bounds.  If there is no current 
				// timeline, then it doesn't matter if the map is resized, because there is no time which determines which events are 
				// visible.
				if ((s.data("timeline") != undefined) && ($("#play_button").data("button-state") == "playing")) {
					setTimePosition(s.slider("value") + s.data("fractionalPosition"),false);
				}
			});
		
		// Set up a click listener on #current_time to display the current time format and let the user change the formatting.
		// Unbind any previous click listener first.
		
		$("#current_time").unbind("click").click(function () {
			// This click function can only be invoked when the timeline is NOT playing.  But we must make sure of two things:
			//		1. The timeline should not play while the time formatter dialog is open.
			//		2. The user cannot change timelines while the timeline formatter for this timeline is open.  (Allowing the TL to change could lead to 
			//			confusion on the user's part as to which timeline the time formatter is referring to.)
			// So disable both of those and re-enable tem before exiting.
		
			$('#play_button').button("disable");
			$('#Select_Timeline').prop("disabled","disabled");
			var formatGuide = $("#current_time").data("format"); // Set at time a TL was selected 
			
			// The format object is structured as an array of 11 objects.  Each object describes the format element to occur at that 
			// position in a completed historical date format string.  Each array element has an object value which has at 
			// least these properties:
			//		rootName:	The "root name" of the HD element that displays this format option, e.g., day_of_week, month, date, etc.
			//					The names of HTML elements within this <div> have names based on this root name.
			//		display:	true iff this property is to be displayed 
			//		separator:	A string that follows the property value (e.g., blank, comma, colon, etc.)
			// The month and era properties have an additional sub-property:
			//		style:		Indicates the style in which to show this value (the HTML field value, e.g., BCE_CE or BC_AD
			// For month, this could be by name or by number (1-12).  For era, it's BCE or CE style vs. BC or AD style.
			
			var sortableHDelement = $("<div id='sortable_hd_elements'></div>"); // The parent of all the HD element format options 
			
			// Insert the HD format element options in the order given by formatGuide.  Set whether it's checked or not (i.e., the user wants 
			// that element displayed in historical dates) and the separator default.
			
			for (var i=0; i < formatGuide.length; i++) {
				$("#show_" + formatGuide[i].rootName).prop("checked",formatGuide[i].display); // Element may be checked or not
				$("#separator_" + formatGuide[i].rootName + " option").prop('selected',false).filter(function() {	// Find the option element that is the default separator, and set the selection to be it
																								return $(this).val() == formatGuide[i].separator; 
																							  }).prop('selected', true);
				// For month and era, set the user's defaults for style
				if ((formatGuide[i].rootName == "month") || (formatGuide[i].rootName == "era")) {
					$("input:radio[name=" + formatGuide[i].rootName + "_style_option]").prop("checked", false).filter(function () {
																														return ($(this).val() == formatGuide[i].style); 
																													}).prop("checked",true);
				}
				sortableHDelement.append($("#" + formatGuide[i].rootName + "_div"));  // Append the <div> for this format option in the order in which the user specified it 
			}
			$("input:radio[name=format_attachment_option]").prop("checked", false).filter(function () {
																					return ($(this).val() == $("#current_time").data("format_source")); 
																				}).prop("checked",true);
			$("#sortable_placeholder").empty().append(sortableHDelement);
			$(".moveable").css("display","block");
			var d = $("#hd_formatter_div").css("display", "block");	// The historical date formatter <div>
  			$("#sortable_hd_elements").sortable({ 	axis: "y",
  													cursor: "move",
  													items: ".moveable",
  													placeholder: "empty_space"
  												});
  			d.dialog({
				autoOpen: true,
				show: { duration: 600 },
				hide: { duration: 600 },
				position: "right",
				width: 550,
				close: function (event, ui) {  
							$('#play_button').button("enable");
							$('#Select_Timeline').prop("disabled",false);
						},
				buttons: [
					{ text: "Cancel", click: function() {
												d.dialog("close");
											 } 
					},
					{ text: "Save", click: function() {
												var tl = $("#slider-box").data("timeline"); // Current timeline
												var newFormat = [];
												var sortableHDelementInput = $("#sortable_hd_elements").sortable("toArray");
												for (var i=0; i< sortableHDelementInput.length; i++) {
													var rootName = sortableHDelementInput[i].substring(0,sortableHDelementInput[i].indexOf("_div"));
													newFormat[i] = { rootName:	rootName, // strip trailing _div to get element root name
																	 display:  	$("#show_" + rootName).is(":checked"),
																	 separator:	$("#separator_" + rootName).val()
																   };
													if ((rootName == "month") || (rootName == "era")) { 
														newFormat[i].style = $("input:radio[name=" + rootName + "_style_option]:checked").val();
													}
												}
												var formatSourceChoice = $("input:radio[name=format_attachment_option]:checked").val();
												var formatSourceOriginal = $("#current_time").data("format_source");
												$("#current_time").data({ "format": newFormat,"format_source": formatSourceChoice }); // And always make it the current format guide
												var index; // index of current TL in scTimelines array
												for (var i=0; i < MYAPP.scenario.scTimelines.length; i++) {
														if (tl.ID == MYAPP.scenario.scTimelines[i].ID) {
															index = i;
															break;
														}
												}
												
												// Update the timeline and scenario as follows:
												//		Orig Format Source		New Format Source	Action 
												//			Timeline				Timeline		Update TL in memory and in scTimelines array of current scenario 
												//			Timeline				Scenario		Delete TL format property from TL in memory and in scTimelines array 
												//													Update scFormat in current scenario 
												//			Scenario				Timeline		Update TL in memory and in scTimelines array of current scenario 
												//			Scenario				Scenario		Update scFormat in current scenario 
												// Always save a working copy of the scenario and update the format cached in the #current_time HTML element 
												
												if 		((formatSourceOriginal == "timeline") && (formatSourceChoice == "timeline")) {
													tl.format = newFormat;	// Update the current timeline cached in the slider-box element 
													MYAPP.scenario.scTimelines[index].scFormat = newFormat; // Update the current timeline in the scenario TL array
												}
												else if	((formatSourceOriginal == "timeline") && (formatSourceChoice == "scenario")) {
													delete tl.format;	// Remove the format guide from the TL both in memory and in the scenario TL array 
													delete MYAPP.scenario.scTimelines[index].scFormat;
													MYAPP.scenario.scFormat = newFormat;
												}
												else if ((formatSourceOriginal == "scenario") && (formatSourceChoice == "timeline")) {
													tl.format = newFormat;
													MYAPP.scenario.scTimelines[index].scFormat = newFormat; // Update the current timeline in the scenario TL array
												}
												else if ((formatSourceOriginal == "scenario") && (formatSourceChoice == "scenario")) {
													MYAPP.scenario.scFormat = newFormat;
												}
												saveWorkingCopy(false); // Save working copy of scenario
												d.dialog("close");
												if ($('#play_button').data("button-state") == "playing") 	// Time slider is paused, so force refresh of time display with new format 
													setTimePosition($("#slider-box").slider("value") + $("#slider-box").data("fractionalPosition"),false);
											}
					}
				]
			});					
									
		});
		
		// Had to wait to be sure the Select_Timeline and GM bounds_changed event listeners defined before we invoke the 
		// Select_Timeline change event.  That eventually calls setTimePosition, which needs to know the map viewport bounds 
		// set by the GM bounds_changed listener.
		
		$('#Select_Timeline').trigger("change"); /* Initialize timeline menu selection (user can override selection */
	}
	
	// findMaxLatLngInAllSectors takes a (lat,lng) pair.  If this point is outside the viewport, set the sector variable 
	// MYAPP.eventOutsideBounds[sector] to be true for this iteration through setTimePosition (i.e., for the current historical date 
	// as given by the time slider's position), where [sector] is the sector (N, S, E, W, NE, NW, SE, SW) where the point falls.  At the 
	// end of a complete setTimePosition pass through all visible points, the sector variables that are true are the ones where visible 
	// events occur that are outside the viewport.  These are the sectors for which sector buttons will be displayed (set in 
	// setTimePosition).
	// At the same time, if the point in a sector is outside the viewport, determine if it is the farthest point (from the viewport 
	// boundary to that sector) encountered for that sector in this iteration.
	
	function findMaxLatLngInAllSectors (lat,lng) {
		var north = (lat > MYAPP.viewportBounds.north); // These are true iff the (lat,lng) is outside the viewport bounds
		var south = (lat < MYAPP.viewportBounds.south);
		var east =  (lng > MYAPP.viewportBounds.east);
		var west =  (lng < MYAPP.viewportBounds.west);
		var x, y; 
		
		// NORTH sector
		
		if (north && !east && !west) {
			MYAPP.eventsOutsideBounds.north = true;
			if (lat > MYAPP.maxLatLngInSector.north.lat()) {
				MYAPP.maxLatLngInSector.north = new google.maps.LatLng(lat, MYAPP.maxLatLngInSector.north.lng());
			}
		}
		
		// NORTHEAST sector
		
		else if (north && east) {
			MYAPP.eventsOutsideBounds.northeast = true;
			x = (lat > MYAPP.maxLatLngInSector.northeast.lat()) ? lat : MYAPP.maxLatLngInSector.northeast.lat();  // We want the farthest point in the sector, so get the 
			y = (lng > MYAPP.maxLatLngInSector.northeast.lng()) ? lng : MYAPP.maxLatLngInSector.northeast.lng();  // extreme lat and lng, even if they come from different points
			MYAPP.maxLatLngInSector.northeast = new google.maps.LatLng(x,y);
		}
		
		// NORTHWEST sector
		
		else if (north && west) {
			MYAPP.eventsOutsideBounds.northwest = true;
			x = (lat > MYAPP.maxLatLngInSector.northwest.lat()) ? lat : MYAPP.maxLatLngInSector.northwest.lat();  // We want the farthest point in the sector, so get the 
			y = (lng < MYAPP.maxLatLngInSector.northwest.lng()) ? lng : MYAPP.maxLatLngInSector.northwest.lng();  // extreme lat and lng, even if they come from different points
			MYAPP.maxLatLngInSector.northwest = new google.maps.LatLng(x,y);
		}
		
		// EAST sector
		
		else if (east && !north && !south) {
			MYAPP.eventsOutsideBounds.east = true;
			if (lng > MYAPP.maxLatLngInSector.east.lng()) {
				MYAPP.maxLatLngInSector.east = new google.maps.LatLng(MYAPP.maxLatLngInSector.east.lat(),lng);
			}
		}
		
		// SOUTH sector
		
		else if (south && !east && !west) {
			MYAPP.eventsOutsideBounds.south = true;
			if (lat < MYAPP.maxLatLngInSector.south.lat()) {
				MYAPP.maxLatLngInSector.south = new google.maps.LatLng(lat, MYAPP.maxLatLngInSector.south.lng());
			}
		}
		
		// SOUTHEAST sector
		
		else if (south && east) {
			MYAPP.eventsOutsideBounds.southeast = true;
			x = (lat < MYAPP.maxLatLngInSector.southeast.lat()) ? lat : MYAPP.maxLatLngInSector.southeast.lat();  // We want the farthest point in the sector, so get the 
			y = (lng > MYAPP.maxLatLngInSector.southeast.lng()) ? lng : MYAPP.maxLatLngInSector.southeast.lng();  // extreme lat and lng, even if they come from different points
			MYAPP.maxLatLngInSector.southeast = new google.maps.LatLng(x,y);
		}
		
		// SOUTHWEST sector
		
		else if (south && west) {
			MYAPP.eventsOutsideBounds.southwest = true;
			x = (lat < MYAPP.maxLatLngInSector.southwest.lat()) ? lat : MYAPP.maxLatLngInSector.southwest.lat();  // We want the farthest point in the sector, so get the 
			y = (lng < MYAPP.maxLatLngInSector.southwest.lng()) ? lng : MYAPP.maxLatLngInSector.southwest.lng();  // extreme lat and lng, even if they come from different points
			MYAPP.maxLatLngInSector.southwest = new google.maps.LatLng(x,y);
		}
		
		// WEST sector
		
		else if (west && !north & !south) {
			MYAPP.eventsOutsideBounds.west = true;
			if (lng < MYAPP.maxLatLngInSector.west.lng()) {
				MYAPP.maxLatLngInSector.west = new google.maps.LatLng(MYAPP.maxLatLngInSector.west.lat(),lng);
			}
		}
	}
	
	// displayArrow does two things:
	//		1. It creates and displays a sector button whose icon is an arrow pointing in the sector's direction.
	//		2. As part of (1), it creates a callback function which, when invoked, will cause GM to expand the viewport to include the 
	//			farthest point of that sector, and thus bring into the user's view all the events in that sector (as well as the current 
	//			viewport) which are visible at this time, but which were hitherto not visible in the viewport.
	
	function displayArrow (sector) {
        var mapSectorsToIcons = {	north:		"n",
        							south: 		"s",
        							east:		"e",
        							west:		"w",
        							northeast:	"ne",
        							northwest:	"nw",
        							southeast:	"se",
        							southwest:	"sw"
        						};
        // Note the unbind("click").  When the viewport is resized, displayArrow may get called multiple times as the user does the resizing,  
        // and we only want ONE click listener for the sector as a result of that resizing.
		$("#arrow-" + sector).unbind("click").button({  text: false,
														icons: { primary: "ui-icon-arrowthick-1-" + mapSectorsToIcons[sector] }
													}).click(function () {
																MYAPP.map.fitBounds(MYAPP.map.getBounds().extend(MYAPP.maxLatLngInSector[sector]))
																clearArrow(sector);
															}).css("display","block").button("enable");								
	}
	
	// clearArrow makes the button for a given sector invisible.
	
	function clearArrow (sector) {
		$("#arrow-" + sector).css("display","none");
	}
	
	// clearArrows destroys all sector buttons that may be present in this iteration of setTimePosition.
	
	function clearArrows () {
		for (var prop in MYAPP.eventsOutsideBounds) {
			if (MYAPP.eventsOutsideBounds[prop]) $("#arrow-" + prop).button("destroy");
		}
	}
	
	// serverUnavailable is invoked when the HiM client is unable to get a specific scenario or list of scenario names from the server.  It perform the following actions:
	//	1. Puts up a dialog box explaining the problem.
	//	2. Sets the displayed scenario name to "(no scenario loaded)"
	//	3. Blanks out the GM map canvas and sets MYAPP.map to null
	//	4. Sets MYAPP.scenario to null 
	//	5. Removes all timelines from the timeline selection drop-down and unbinds the "change" event listener
	//	6. Blanks out the current time 
	//	7. Resets the time slider to 0, disables the "play" button, and removes all attached data 
	//
	// The single argument is an option object which can have the following components:
	//		op			The operation that was attempted
	//		name		Name of the scenario that couldn't be loaded
	//		clear   	true => clear the current scenario; false => leave it as is
	//		extraText	Extra text to include in message to user re inability to get scenario list.  Can explain the implications of the problem.
	
	function serverUnavailable (options) {
		if (options.clear) {
			$('#scenario_name').text("(no scenario loaded)");
			$("#browser_title").text("History in Motion");
			$('#Select_Timeline').empty();
			$('#current_time').text("");   	
			$("#slider-box").slider({
								slide: function(event, ui) { 
										setTimePosition(ui.value); },
								value: 0,
								max: 0,
								min: 0
							}).removeData().data("timelineID", -1);  
			$('#Select_Timeline_Form').unbind("change");
			$('#play_button').button("disable");
			MYAPP.map.setMapTypeID(null);
			MYAPP.map = null;
			MYAPP.scenario = null;
		}
		if (options.extraText == undefined) options.extraText = "";
		var dialogDiv;
		switch (options.op) {
			case "CopyFiles":
				dialogDiv = $("<div title='Unable To Do Save As'>Unable to do Save As for scenario <b>" + options.name + "</b> " + options.extraText + "</div>");
				break;
			case "GetScenario":
				dialogDiv = $("<div title='Unable To Get Scenario'>Unable to get <b>" + options.name + "</b> from server.</div>");
				break;
			case "GetScenarioList":
				dialogDiv = $("<div title='Unable To Get Scenario List'>Unable to get list of scenario names from server. " + options.extraText + "</div>");
				break;
		}
		dialogDiv.dialog({
			autoOpen: true,
			show: { duration: 600 },
			hide: { duration: 600 },
			position: "center"
		});
}
	
	// Both getScenario (defined in storage.js) and getCurrentScenario (which calls getScenario) return a promise to provide a JSONified version
    // of the scenario using a scenario key formed from the function arguments.
	
	function getCurrentScenario_Async(deferredGetScenario) {
		return storage.getScenario_Async(MYAPP.currentLoggedInUser.userName,
                                         MYAPP.currentLoggedInUser.password,
                                         MYAPP.scenario.scName,deferredGetScenario);
	}
	
	// saveCurrentScenarioName sets the name of the scenario being edited (MYAPP.nameOfScenarioBeingEdited) to the name of the scenario being made
	// current.
	
	function saveCurrentScenarioName() {
		MYAPP.nameOfScenarioBeingEdited = MYAPP.scenario.scName;
	}
	
	// deleteScenario_Async deletes all external files that are specific to the scenario, namely, all the icons (if any) in the scenario-specific icon 
	// library (SSIL) and all the external files named in any of the events' externalFileLists.  Then it tells the server to delete the scenario.
	//
	// After deletion: if the user has no scenarios left, trigger the event for the New Scenario dialog.  If there is 1 scenario left, load it.  If >1 scenarios
	// are left, trigger the Open Scenario dialog.
	//
	// The parameter deleteScenarioName was the one taken from a list presented to the user generated from the scenario key list, so there is 
	// no need to error-check it.
	
	function deleteScenario_Async(deleteScenarioName) {
		var deferredGetScenario = $.Deferred();
		storage.getScenario_Async(MYAPP.currentLoggedInUser.userName,		// Get the scenario so we can extract all the external file names and delete the files
                                  MYAPP.currentLoggedInUser.password,
                                  deleteScenarioName,
                                  deferredGetScenario).done(function (JSONifiedScenario) {
            var x = $.parseJSON(JSONifiedScenario);
            deferredIgnore = $.Deferred(); // We're not concerned about when any of these calls complete or whether they complete successfully
            if (x.scSSIL) {
            	var SSIL = [];
				for (var i=0; i < x.scSSIL.length; i++) { 			// Delete every external file (icon) in the SSIL for the scenario to be deleted
					SSIL[i] = new ht.ExternalFile(x.scSSIL[i]);		// By definition, none of these icons is shared with any other scenario
					storage.deleteExternalFile_Async(SSIL[i],deferredIgnore);
				}
			}
			var locations = [];
			for (var i=0; i < x.scLocations.length; i++) {
				locations[i] = new ht.HistoricalEvent(x.scLocations[i], MYAPP.map); // Doesn't matter that MYAPP.map is not the right map for this scenario
				if (locations[i].externalFileList) {
					for (var j=0; j < locations[i].externalFileList.length; j++) {
						 locations[i].externalFileList[j] = new ht.ExternalFile(locations[i].externalFileList[j]); // Make the plain Object into an ExternalFile object
						 storage.deleteExternalFile_Async(locations[i].externalFileList[j],deferredIgnore);
					}
				}
			}
			var events = [];
			for (var i=0; i < x.scEvents.length; i++) 	 { 
				events[i] 	= new ht.HistoricalEvent(x.scEvents[i], MYAPP.map); 	// Doesn't matter that MYAPP.map is not the right map for this scenario
				if (events[i].externalFileList) {
					for (var j=0; j < events[i].externalFileList.length; j++) {
						 events[i].externalFileList[j] = new ht.ExternalFile(events[i].externalFileList[j]); // Make the plain Object into an ExternalFile object
						 storage.deleteExternalFile_Async(events[i].externalFileList[j],deferredIgnore);
					}
				}
			}
			storage.deleteScenario_Async(MYAPP.currentLoggedInUser.userName,	// Now that the server has gotten all requests to delete the scenario's external files, 
										 MYAPP.currentLoggedInUser.password,	// we can delete the scenario itself
										 deleteScenarioName).done(function() {
				var deferredGetScenarioList = $.Deferred();
				storage.getScenarioList_Async(MYAPP.currentLoggedInUser.userName, MYAPP.currentLoggedInUser.password, deferredGetScenarioList);
				deferredGetScenarioList.done(function(scenarioNames) {
					if (scenarioNames.length == 0) {
						MYAPP.caseForOpeningScenario = 3;
						$("#enclose-menu li:contains(New) li:contains(Scenario)").trigger("click");
					}
					else if (scenarioNames.length == 1) {
						var deferredGetScenario = $.Deferred();
						storage.getScenario_Async(MYAPP.currentLoggedInUser.userName,
												  MYAPP.currentLoggedInUser.password,
												  scenarioNames[0], deferredGetScenario);
						deferredGetScenario.done(checkAndLoadScenario)
										   .fail(function () { serverUnavailable({ 	op: "GetScenario",
																					clear: true,
																					name: scenarioNames[0] })
											});
					}
					else {
						MYAPP.caseForOpeningScenario = 3;
						editScenario("open");
					}
				})
				.fail(function() { serverUnavailable({ op: "GetScenarioList",
														 clear: false }); 
				});
			});
        })
        .fail(function () { serverUnavailable({ op: "GetScenario",
												clear: false }); 
        });
	}
	
	// renameCurrentScenario updates the current User object in MYAPP.currentLoggedInUser by renaming the scenario key of the current scenario
	// in the user's scenario key list.  It is saved at index 0 of that array, which is the position of the last used scenario.  Also, the current
	// scenario is written to the server, since it may have been updated.
	
	function renameCurrentScenario (oldScenarioName,deferredRenameCurrentScenario) {
		var deferredRenameScenario = $.Deferred();
        storage.renameScenario_Async(MYAPP.currentLoggedInUser.userName, oldScenarioName, MYAPP.scenario.scName, MYAPP.scenario, deferredRenameScenario)
        		.done(function () { deferredRenameCurrentScenario.resolve(); })
        		.fail(function () { deferredRenameCurrentScenario.reject(); });
	}
	
	// Helper function to create an alphabetized array of this user's scenario names.  Each array entry is a pair [k, name] where
	// k is the index of the scenario in the list and name is its name (shorn of the user's name and "+" separator).

	function getScenarioNames_Async() {
		var deferredGetScenarioList = $.Deferred();
		var deferredResult = $.Deferred();
        storage.getScenarioList_Async(MYAPP.currentLoggedInUser.userName, MYAPP.currentLoggedInUser.password, deferredGetScenarioList);
        deferredGetScenarioList.done(function(scenarioNames) {
            var scenarioNamesArray = [];
            for (var i = 0; i < scenarioNames.length; i++) {
                scenarioNamesArray[i] = { index: i,
                                          name: scenarioNames[i]
                                        }
            }
            var resultArray = scenarioNamesArray.sort(function (x,y) {
                                                        if   (x.name > y.name) 		return 1; 
                                                        else if (x.name < y.name) 	return -1; 
                                                        else 						return 0; 
                                                    });
            return deferredResult.resolve(resultArray);
        })
        .fail(function() { serverUnavailable({ op: "GetScenarioList",
            										 clear: false });
            			   deferredResult.reject();
        }); 
        return deferredResult.promise();
	}
			
   	/* tlPlay plays a timeline in continuous clock mode.  It's called back from the setInterval timer loop initiated */
	/* when the user clicks the "play" button. */
    
    function tlPlay() {
    	if (!$("#slider-box").data("timeline")) return; // There is no timeline (scenario has just been created, but user cliked "play" button)
        var x=document.getElementById("Select_Timeline").selectedIndex;
        var y=document.getElementById("Select_Timeline").options;
        var position = $("#slider-box").slider("value"); /* Current position of the time slider */
        var deltaPos = $("#slider-box").data("deltaPos"); /* Increment of the time slider to advance slider byin continuous clock mode */
                                                          /* This is set when user clicks to select a timeline */
        var maxPosition = $("#slider-box").slider("option", "max"); /* Timeline-dependent max position of time slider  */
                                                                    /* Set when user clicks to select a timeline */
        var minPosition = $("#slider-box").slider("option", "min"); /* Min position of time slider (never changes) */
        var ID = $(y[x]).data("timelineID"); /* Get ID of the selected timeline */
        var tl; /* The user-selected timeline to play */
        for (var i=0; i < MYAPP.scenario.scTimelines.length; i++) {
            if (ID == MYAPP.scenario.scTimelines[i].ID) { tl = MYAPP.scenario.scTimelines[i]; break; }
        }
        position = position + deltaPos;
        if (position > maxPosition) /* Don't exceed the max position of the slider */
        {
            $('#play_button').trigger("click"); /* Trigger event of pressing on the "play" button */
                                                /* In effect, this pauses the playing of the tl */
            position = maxPosition;					
        }
        $("#slider-box").slider("value", Math.floor(position)).data("fractionalPosition",position - Math.floor(position)); /* Set both the slider position... */
        setTimePosition(position);                  /* ...and the time position (what events are visible) */
    }
    
    // Updates the display of points, given a position of the time slider.  Called as a slider callback, and also during
    // initialization.  Takes two parameters:
    //		pos				The position on the time slider 
    //		updateContext	Optional parameter (default is true)
    //							true	Display the appropriate context and/or soundtrack, if the time calls for it 
    //							false	Do not display context and/or soundtrack regardless of the time.  This distinguishes 2 cases when setTimePosition is 
    //									called other than to update the visibility of events:
    //										1. When GM detects the map bound have changed and we need to force a redraw of the visible events based on the new bounds
    //										2. When the time format has changed and we need to force a redisplay of the historical time with the new format 
    
    function setTimePosition(pos,updateContext) {
    	var OKtoDisplayContext = ((updateContext == undefined) || updateContext);
        var tl = $("#slider-box").data("timeline");
        var tlID = tl.ID;
        var epoch = tl.begin.GMT + (pos/$("#slider-box").slider("option", "max")) * ($("#slider-box").data("tlDuration") * 1000);
        var hd = new ht.HistoricalDate(epoch, tl.circa);
        $('#current_time').text(new ht.GregorianDateFormatter(tl.utcOffset,$('#current_time').data("format"),tl.timeZone).format(hd));
        
        // Display or hide opening or closing context(s).  The rules are:
        //	1. Only display a context if this is part of timeline execution, not because setTimePosition is being called as part of a command (e.g., FILE/REFRESH).
        //	2. Only display a context if it is not visible at present.
        //	3. Only close a context if it is visible at present.  (Contexts can also be closed manually by the user.)
        //	4. If hd and start time/end time of the timeline are concurrent, then:
        //		a. If the timeline is the FSTL and the scenario has a opening/closing context, then display it.
        //		b. If the timeline is not the FSTL and the timeline has an opening/closing context, then display it.
        //	5. If hd and start time/end time of the timeline are NOT concurrent, then close any open context.
        
        if ((MYAPP.commandInProgress == null) && OKtoDisplayContext) { // We're executing a timeline, not in a command like FILE/REFRESH
        	if (tl.title == "Full Scenario") { // Check for scenario opening and closing context
        		if (pos == 0) {	// Make sure any open context from any other timeline is closed.
					if (MYAPP.TOCisVisible) $("#timeline_opening_context").dialog("close").css("display","none");
					if (MYAPP.TCCisVisible) $("#timeline_closing_context").dialog("close").css("display","none");
					operateMedia("tl_start_desc_soundtrack","stop");	// Stop any soundtrack from the previously selected timeline, 
					operateMedia("tl_end_desc_soundtrack","stop");	// regardless of whether it had a context
				}
        		if (pos == 0) {						// We're at start of timeline
        			if ((MYAPP.scenario.scStartDesc != "") && 	// There is an opening context
        			     !MYAPP.SOCisVisible) {					// It's not visible
						$("#scenario_opening_context").empty().append(MYAPP.scenario.scStartDesc).css("display","block").dialog({ 	autoOpen: true,
																																	show: { duration: 600 },
																																	hide: { duration: 600 },
																																	title: MYAPP.scenario.scName + ": Introduction",
																																	width: 700,
																																	height: 400,
																																	beforeClose: function (event, ui) {
																																					MYAPP.SOCisVisible = false;
																																					operateMedia(MYAPP.scenario.scStartSoundtrack,"stop");
																																					return true;
																																				 }
		
																																});
						MYAPP.SOCisVisible = true;
					}
					operateMedia(MYAPP.scenario.scStartSoundtrack,"start",
								 ((MYAPP.browserType == "Firefox") && (MYAPP.scenario.scStartDesc == ""))); // Start the soundtrack, if there is one. 
				}
				else if (pos == $("#slider-box").slider("option", "max")) {	// We're at end of timeline 
						 if ((MYAPP.scenario.scEndDesc != "") &&					// There is a closing context 
						     !MYAPP.SCCisVisible) {									// It's not visible
								 $("#scenario_closing_context").empty().append(MYAPP.scenario.scEndDesc).css("display","block").dialog({ 	autoOpen: true,
																																			show: { duration: 600 },
																																			hide: { duration: 600 },
																																			title: MYAPP.scenario.scName + ": Conclusion",
																																			width: 700,
																																			height: 400,
																																			beforeClose: function (event, ui) {
																																							MYAPP.SCCisVisible = false;
																																							operateMedia(MYAPP.scenario.scEndSoundtrack,"stop");
																																							return true;
																																						 }
			
																																		});
								MYAPP.SCCisVisible = true;
						}
						operateMedia(MYAPP.scenario.scEndSoundtrack,"start",
									 ((MYAPP.browserType == "Firefox") && (MYAPP.scenario.scEndDesc == ""))); // Start the soundtrack, if there is one.
				}
				else if ((pos > 0) && (pos < $("#slider-box").slider("option", "max"))) { // We're neither at the beginning nor the end of the timeline
						if (MYAPP.SOCisVisible) $("#scenario_opening_context").dialog("close").css("display","none");
						if (MYAPP.SCCisVisible) $("#scenario_closing_context").dialog("close").css("display","none");
						operateMedia("sc_start_desc_soundtrack","stop");	// Stop any soundtrack from the previously selected timeline, 
						operateMedia("sc_end_desc_soundtrack","stop");	// regardless of whether it had a context
				}
			}
			else {	// We're executing a timeline other than the FSTL, so check for this timeline's contexts
				if (pos == 0) {	// We're at the start of a timeline other than FSTL.  Make sure any open contexts are closed.
					if (MYAPP.SOCisVisible) $("#scenario_opening_context").dialog("close").css("display","none");
					if (MYAPP.SCCisVisible) $("#scenario_closing_context").dialog("close").css("display","none");
					if (MYAPP.TOCisVisible) $("#timeline_opening_context").dialog("close").css("display","none");
					if (MYAPP.TCCisVisible) $("#timeline_closing_context").dialog("close").css("display","none");
					operateMedia("sc_start_desc_soundtrack","stop");
					operateMedia("sc_end_desc_soundtrack","stop");
					operateMedia("tl_start_desc_soundtrack","stop");
					operateMedia("tl_end_desc_soundtrack","stop");
				}
				if (pos == 0) { 				// We're at start of timeline
        			if ((tl.start_desc != "") && 	// There is an opening context
        			    !MYAPP.TOCisVisible) {		// It's not visible
						$("#timeline_opening_context").empty().append(tl.start_desc).css("display","block").dialog({ 	autoOpen: true,
																														show: { duration: 600 },
																														hide: { duration: 600 },
																														title: tl.title + ": Introduction",
																														width: 700,
																														height: 400,
																														position: { my: "left top", at: "left bottom", of: $("#MapTab_Framework")},
																														beforeClose: function (event, ui) {
																																		MYAPP.TOCisVisible = false;
																																		operateMedia(tl.startSoundtrack,"stop");
																																		return true;
																																	 }

																													});
						MYAPP.TOCisVisible = true;
					}
					operateMedia(tl.startSoundtrack,"start",
								 ((MYAPP.browserType == "Firefox") && (tl.start_desc == ""))); // Start the soundtrack, if there is one.
				}
				else if (pos == $("#slider-box").slider("option", "max")) {	// We're at end of timeline 
						 if ((tl.end_desc  != "") &&								// There is a closing context 
						     !MYAPP.TCCisVisible) {									// It's not visible
							 $("#timeline_closing_context").empty().append(tl.end_desc).css("display","block").dialog({ autoOpen: true,
																														show: { duration: 600 },
																														hide: { duration: 600 },
																														title: tl.title + ": Conclusion",
																														width: 700,
																														height: 400,
																														position: { my: "left top", at: "left bottom", of: $("#MapTab_Framework")},
																														beforeClose: function (event, ui) {
																																		MYAPP.TCCisVisible = false;
																																		operateMedia(tl.endSoundtrack,"stop");
																																		return true;
																																	 }

																													});
							MYAPP.TCCisVisible = true;
					}
					operateMedia(tl.endSoundtrack,"start",
								 ((MYAPP.browserType == "Firefox") && (tl.end_desc == ""))); // Start the soundtrack, if there is one.   
				}
				else if ((pos > 0) && (pos < $("#slider-box").slider("option", "max"))) { // We're neither at the beginning nor the end of the timeline
						if (MYAPP.TOCisVisible) $("#timeline_opening_context").dialog("close").css("display","none");
						if (MYAPP.TCCisVisible) $("#timeline_closing_context").dialog("close").css("display","none");
						operateMedia("tl_start_desc_soundtrack","stop");
						operateMedia("tl_end_desc_soundtrack","stop");
				}
				if (hd.compareHistoricalDate(MYAPP.scenario.scBegin) == "concurrent") { // We're in a timeline other than the FSTL, but we're at the start time for the scenario
					if ((MYAPP.scenario.scStartDesc != "") && 								  // There is an opening context for the scenario
        				!MYAPP.SOCisVisible) {												  // It's not visible
							$("#scenario_opening_context").empty().append(MYAPP.scenario.scStartDesc).css("display","block").dialog({ 	autoOpen: true,
																																		show: { duration: 600 },
																																		hide: { duration: 600 },
																																		title: MYAPP.scenario.scName + ": Introduction",
																																		width: 700,
																																		height: 400,
																																		beforeClose: function (event, ui) {
																																						MYAPP.SOCisVisible = false;
																																						operateMedia(MYAPP.scenario.scStartSoundtrack,"stop");
																																						return true;
																																					 }
		
																																	});
							MYAPP.SOCisVisible = true;
					}
					operateMedia(MYAPP.scenario.scStartSoundtrack,"start",
								 ((MYAPP.browserType == "Firefox") && (MYAPP.scenario.scStartDesc == ""))); // Start the soundtrack, if there is one. 
				}
				else if (hd.compareHistoricalDate(MYAPP.scenario.scEnd) == "concurrent") { // We're in a timeline other than the FSTL, but we're at the end time for the scenario
						 if ((MYAPP.scenario.scEndDesc != "") &&								 // There is a closing context for the scenario 
						     !MYAPP.SCCisVisible) {												 // It's not visible
							 $("#scenario_closing_context").empty().append(MYAPP.scenario.scEndDesc).css("display","block").dialog({ 	autoOpen: true,
																																		show: { duration: 600 },
																																		hide: { duration: 600 },
																																		title: MYAPP.scenario.scName + ": Conclusion",
																																		width: 700,
																																		height: 400,
																																		beforeClose: function (event, ui) {
																																						MYAPP.SCCisVisible = false;
																																						operateMedia(MYAPP.scenario.scEndSoundtrack,"stop");
																																						return true;
																																					 }
			
																																	});
							MYAPP.SCCisVisible = true;
					}
					operateMedia(MYAPP.scenario.scEndSoundtrack,"start",
									 ((MYAPP.browserType == "Firefox") && (MYAPP.scenario.scEndDesc == ""))); // Start the soundtrack, if there is one.
				}
				else if ((hd.compareHistoricalDate(MYAPP.scenario.scBegin) != "concurrent") && (hd.compareHistoricalDate(MYAPP.scenario.scEnd) != "concurrent")) { // We're neither at the beginning nor the end of the timeline
						if (MYAPP.SOCisVisible) $("#scenario_opening_context").dialog("close").css("display","none");
						if (MYAPP.SCCisVisible) $("#scenario_closing_context").dialog("close").css("display","none");
						operateMedia("sc_start_desc_soundtrack","stop");
						operateMedia("sc_end_desc_soundtrack","stop");
				}
			}
		}
        
        // Initialize two of the three global variable objects in MYAPP that hold information about the viewport 
		// (i.e., the portion of the map that is in view) and the events that are visible (from a time perspective) but are beyond the 
		// boundaries of the viewport.  The purpose of this is to be able, at every point in time, to display buttons at the four sides and 
		// four corners of the map if there are visible events outside the current viewport.  This will enable the user to click on a 
		// button and redraw the map to include the visible events in the sector where the user has clicked the button.  (The user could 
		// choose to use the zoom control to zoom out.)
		//
		// Note that the values in the objects are all valid for ONE iteration through setTimePosition.  
		//
		// The two objects are (see checkAndLoadScenario for the other):
		//			Object						Properties					Type		Meaning			
		//		MYAPP.eventsOutsideBounds 	north, south, east, west, 	Boolean		True iff there is at least one event in the sector that is visible (see setTimePosition)
		//									northeast, northwest, 						but is beyond the viewport in this sector (relative to the viewport)
		//									southeast, southwest
		//		MYAPP.maxLatLngInSector		north, south, east, west, 	LatLng		For each sector, the LatLng of the visible event that is farthest away from the viewport
		//									northeast, northwest, 							
		//									southeast, southwest
		//
		// NOTE: We only want to do this initialization and (later in setTimePosition) checking of visible events against the viewport bounds 
		// if the viewport bounds are defined.  When a scenario is loaded, GM may not finish loading the map before setTimePosition is called 
		// as part of setting up the initial timeline choice (Select_Timeline change event listener).  In that case, the viewport bounds are 
		// undefined.  We will just ignore this case and not bother to indicate the presence of events outside the viewport, because as soon 
		// as the user does something to change the historical time (thus invoking setTimePosition), the map will have finished loading and 
		// the viewport bounds will have been defined.
		
		var viewportBoundsDefined = !(MYAPP.viewportBounds.north == undefined);
		if (viewportBoundsDefined) {
			clearArrows(); // Delete all sector buttons from previous iteration
			MYAPP.eventsOutsideBounds = { 	north:		false,
											south:		false,
											east:		false,
											west:		false,
											northeast:	false,
											northwest:	false,
											southeast:	false,
											southwest:	false
										};
			var center = MYAPP.map.getCenter();
		
			// The initial values for the sector properties in MYAPP.maxLatLngInSector are as follows:
			//
			//	1. For north, east, south, and west, it is the point (LatLng) in the center of the viewport boundary for that sector.
			// 	2. For the other sectors, it is the "corner point" where two viewport boundaries intersect (e.g., the northern and eastern).
		
			MYAPP.maxLatLngInSector = {	north:		new google.maps.LatLng(MYAPP.viewportBounds.north, center.lng()),
										east:		new google.maps.LatLng(center.lat(), MYAPP.viewportBounds.east),
										south:		new google.maps.LatLng(MYAPP.viewportBounds.south, center.lng()),
										west:		new google.maps.LatLng(center.lat(), MYAPP.viewportBounds.west),
										northeast:	new google.maps.LatLng(MYAPP.viewportBounds.north, MYAPP.viewportBounds.east),
										northwest:	new google.maps.LatLng(MYAPP.viewportBounds.north, MYAPP.viewportBounds.west),
										southeast:	new google.maps.LatLng(MYAPP.viewportBounds.south, MYAPP.viewportBounds.east),
										southwest:	new google.maps.LatLng(MYAPP.viewportBounds.south, MYAPP.viewportBounds.west)
									};
        }
        MYAPP.scenario.scEvents.forEach(function(spec, index) {
            if (!(spec.begin)) {
                spec.marker.setVisible(false);
                return;
            };
            var beginDateComparison = spec.begin.compareHistoricalDate(hd,MYAPP.dateTolerance);
            var endDateComparison = spec.end.compareHistoricalDate(hd,MYAPP.dateTolerance);
            var makeVisible = !((beginDateComparison == "after") || (endDateComparison == "before"));
            var GMobject; 		// This will be the marker, polyline, or polygon to be made visible
        	if 		(spec.marker) 		GMobject = spec.marker;	
        	else if (spec.polyline)		GMobject = spec.polyline;  
        	else if (spec.GMpolygon)	GMobject = spec.GMpolygon;
        	if (spec.marker) {	
        		GMobject.setVisible(makeVisible);
        		
        		// If a placemark event is just beginning on this timer cycle, cause its icon to bounce for up to MYAPP.maxMsecToBounce
				//
				// Here's how to distinguish the cases:
				//
				// Case (Transition)		Condition								Action
				// invisible -> visible		(  makeVisible  && !(spec.timerID))		Start the icon bouncing, start a timer, save its ID in spec.timerID
				// visible -> visible		(  makeVisible  &&   spec.timerID )		None
				// visible -> invisible		(!(makeVisible) &&   spec.timerID )		Stop timer, delete object property spec.timerID
				// invisible -> invisible	(!(makeVisible) && !(spec.timerID))		None
				//
				// Note that we use setTimeout as the timer.  When it wakes up, it stops the bouncing and deletes the timer.  The visible -> invisible
				// case is still necessary if the historical time passes the event's end and there is still time left to bounce.
			
				
				if 		(  makeVisible  && !(spec.timerID)) {
					spec.marker.setAnimation(google.maps.Animation.BOUNCE);
					spec.timerID = setTimeout(function() { 
						spec.marker.setAnimation(null);
						clearTimeout(spec.timerID); }, MYAPP.maxMsecToBounce);
					if (!spec.hoverWindow) {
						spec.hoverWindow = new google.maps.InfoWindow({ content: spec.name,
																		disableAutoPan: true  // If we don't disable auto-pan on hover windows attached to moving events, Google Maps 
														  									  // will "fight" the user and prevent him from panning away from that moving event
						 											});
						google.maps.event.addListener(GMobject, 'mouseover', function (event) { spec.hoverWindow.open(GMobject.map,spec.marker); });
						google.maps.event.addListener(GMobject, 'mouseout', function () { spec.hoverWindow.close(); });
					}
					google.maps.event.trigger(GMobject, 'mouseover');  // Force display of event title
				}
				else if	(!(makeVisible) &&   spec.timerID )	{
					spec.marker.setAnimation(null);
					clearTimeout(spec.timerID);
					delete spec.timerID;
					spec.hoverWindow.close();
				}
        	}
        	
        	else if (spec.polyline && makeVisible) { // Make a path event visible
        		if (spec.animationIconStyle == "Arrow (entire path only)") { // If animation icon style is an arrow, let GM handle the animation
        			GMobject.setVisible(makeVisible); // First, make the entire path visible
        		
        			// If the object is a polyline (i.e., a path), then start the animation it (if it is being made visible), leave the animation going
					// (if it already was visible), stop the animation (if it is being made invisible), or do nothing (if it already was invisible).
					//
					// Here's how to distinguish the cases:
					//
					// Case (Transition)		Condition								Action
					// invisible -> visible		(  makeVisible  && !(spec.timerID))		Make and place the polyline symbol, start a timer, save its ID in spec.timerID
					// visible -> visible		(  makeVisible  &&   spec.timerID )		None
					// visible -> invisible		(!(makeVisible) &&   spec.timerID )		Stop timer, delete object property spec.timerID
					// invisible -> invisible	(!(makeVisible) && !(spec.timerID))		None
			
					if 		(  makeVisible  && !(spec.timerID)) {
						spec.polyline.setOptions({
							 icons: [{
								icon: {
									path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
									scale: 4,
									strokeColor: spec.polyline.strokeColor
									},
								offset: '100%'
							}]
						});
						var count = 0;
						spec.timerID = setInterval(function() {
														count = (count + 1) % 200;
														var icons = spec.polyline.get('icons');
														icons[0].offset = (count / 2) + '%';
														spec.polyline.set('icons', icons);
														}, MYAPP.pathAnimationInterval);
					}
				}
				else { // Animation icon style is not an arrow, i.e., it's a placemark or a custom icon.  Handle the animation ourselves.
					var index = spec.lastSubsegmentIndex; // Find the first subsegment to process on this call to setTimePosition
					var indexSliderPos = spec.lastSubsegmentIndexSliderPos; // And its associated position on the slider (for the current timeline)
					var limit = spec.pathSubsegments.length - 1;
					if (spec.animationPathChoice == "Entire path") {
						GMobject.setVisible(makeVisible); // Make the entire path visible
						if      (indexSliderPos < pos) {	// Find the index of the path segment that is current for this time
								for (var i = index; i < limit; i++) {
									if (spec.pathSubsegments[i].sliderPos < pos) {
										index++;
									}
									else break;
								}
							}
						else if (indexSliderPos > pos) {
							for (var i = index; i >= 0; i--) {
								if (spec.pathSubsegments[i].sliderPos >= pos) {
									index--;
								}
								else break;
							}
						}
					}
					else { // We have to show either the past or future path only
						if (index == 0) {
							GMobject.setVisible(false);	// Turn off visibility of entire path
							GMobject.strokeOpacity = 0.1; // Make the path event barely visible, if at all
							GMobject.setVisible(true);  // Turn it back on
						}
						if (spec.animationPathChoice == "Past only") {
							
							// The basic idea of the algorithm is as follows.  When setTimePosition(pos) is called, look at the current slider position pos 
							// vs. the slider position of the last subsegment that was processed in the previous invocation.  (Assume that the user has 
							// specified that only the past path should be shown; the future path algorithm is identical except the booleans for turning 
							// a subsegment's visibility on or off are reversed.) If the last subsegment's slider position is less than the current position, 
							// then that subsegment is earlier in time, so proceed from that subsegment to the present time, turning on the visibility of the intervening 
							// subsegments.  If the last subsegment's slider position is greater than the current position, then it is later in time, so 
							// proceed from the subsegment just before the last one processed and work backward in time to the current position, turning off 
							// the visibility of the intervening subsegments.
						
							if      (indexSliderPos < pos) {
								for (var i = index; i < limit; i++) {
									if (spec.pathSubsegments[i].sliderPos < pos) {
										spec.pathSubsegments[i].GMsegment.setVisible(true);
										index++;
									}
									else break;
								}
							}
							else if (indexSliderPos > pos) {
								for (var i = index; i >= 0; i--) {
									if (spec.pathSubsegments[i].sliderPos >= pos) {
										spec.pathSubsegments[i].GMsegment.setVisible(false);
										index--;
									}
									else break;
								}
							}
						}
						else { // Path option is "Future only", so turn on all subsegments as the path event transitions from invisible to visible
							if (index == 0) {  
								for (var i=0; i < limit; i++) spec.pathSubsegments[i].GMsegment.setVisible(true);
							}
							if      (indexSliderPos < pos) {
								for (var i = index; i < limit; i++) {
									if (spec.pathSubsegments[i].sliderPos < pos) {
										spec.pathSubsegments[i].GMsegment.setVisible(false);
										index++;
									}
									else break;
								}
							}
							else if (indexSliderPos > pos) {
								for (var i = index; i >= 0; i--) {
									if (spec.pathSubsegments[i].sliderPos >= pos) {
										spec.pathSubsegments[i].GMsegment.setVisible(true);
										index--;
									}
									else break;
								}
							}
						}
					}
					if (index >= limit) index = limit-1;
					else if (index < 0) index = 0;
					spec.lastSubsegmentIndex = index; // First subsegment to process on next call to setTimePosition
					spec.lastSubsegmentIndexSliderPos = spec.pathSubsegments[index].sliderPos; // And its associated slider position
					// If there is an icon specified for this path event's animation, display it 
					if ((spec.animationIconStyle == "Placemark") || (spec.animationIconStyle == "Custom icon")) {
						if (spec.animationIconOnPath) {
							spec.animationIconOnPath.setPosition(spec.pathSubsegments[index].latLng);
						}
						else { // Create an icon for this animation and place it on the start of the path
							spec.animationIconOnPath = new google.maps.Marker({	position: spec.pathSubsegments[index].latLng,
																				visible: true,
																				map: MYAPP.map
																			});
							if ((spec.animationIconStyle == "Custom icon") && (spec.animationIcon != "")) {
								spec.animationIconOnPath.setIcon({
																	url: spec.animationIcon
																});  
							}
						}
						if (!spec.hoverWindow) {
							spec.hoverWindow = new google.maps.InfoWindow({ content: spec.name, 
																			disableAutoPan: true  // If we don't disable auto-pan on hover windows attached to moving events, Google Maps 
														  										  // will "fight" the user and prevent him from panning away from that moving event
																		});
							google.maps.event.addListener(spec.animationIconOnPath, 'mouseover', function (event) { spec.hoverWindow.open(GMobject.map,spec.animationIconOnPath); });
							google.maps.event.addListener(spec.animationIconOnPath, 'mouseout', function () { spec.hoverWindow.close(); });
						}
						google.maps.event.trigger(spec.animationIconOnPath, (tl.displayPathEventNames ? 'mouseover' : 'mouseout'));  // Force display of event title
					}
				}
        	}
        	
        	else if (spec.polyline && !makeVisible) {
        		GMobject.setVisible(makeVisible); // Turn off visibility 
        		GMobject.strokeOpacity = spec.opacity; // Restore original stroke opacity, which may have been changed
        		if (spec.pathSubsegments) {				// If the path was broken into subsegments, make them invisible as path event 
        			if ((spec.lastSubsegmentIndex != 0) // transitions from visible to invisible
        				|| ((spec.lastSubsegmentIndex == 0) && (spec.animationPathChoice == "Future only"))) {										  
						var limit = spec.pathSubsegments.length - 1;
						for (var i=0; i < limit; i++) spec.pathSubsegments[i].GMsegment.setVisible(false);
						spec.lastSubsegmentIndex = 0; // Ready to start processing the 0-th subsegment on next transition of path event from invisible to visible
        			}
        		}
        		if (spec.timerID) {	// If there was a timer (because GM is doing the arrow animation), then kill it
					clearInterval(spec.timerID);
					delete spec.timerID;
        		}
        		if ((spec.animationIconStyle == "Placemark") || (spec.animationIconStyle == "Custom icon")) {
					if (spec.animationIconOnPath) { // Get rid of the icon on the path and its GM click listeners
						spec.animationIconOnPath.setMap(null);
						google.maps.event.clearListeners(spec.animationIconOnPath,"click");
						google.maps.event.clearListeners(spec.animationIconOnPath,"rightclick");
						google.maps.event.clearListeners(spec.animationIconOnPath,"mouseover");
						google.maps.event.clearListeners(spec.animationIconOnPath,"mouseout");
						spec.animationIconClickListenerID = null;
						spec.animationIconRightClickListenerID = null;
						delete spec.animationIconOnPath;
						delete spec.hoverWindow;
					}
				}
        	}
        	
        	else if (spec.GMpolygon) {
        		GMobject.setVisible(makeVisible);
        		// If this area event has an image (icon), then display or make it invisible, as the current time dictates
        		if (spec.AEmarker) {
        			var wasVisible = spec.AEmarker.getVisible(); // Was the marker visible on the last iteration?  Used below so we don't get jitter in display of hover window
        			spec.AEmarker.setVisible(makeVisible);
        			if (!spec.hoverWindow) {
						spec.hoverWindow = new google.maps.InfoWindow({ content: spec.name, 
																		disableAutoPan: true  // If we don't disable auto-pan on hover windows attached to moving events, Google Maps 
														  									  // will "fight" the user and prevent him from panning away from that moving event
																	});
						google.maps.event.addListener(spec.AEmarker, 'mouseover', function (event) { spec.hoverWindow.open(GMobject.map,spec.AEmarker); });
						google.maps.event.addListener(spec.AEmarker, 'mouseout', function () { spec.hoverWindow.close(); });
					}
					if (tl.displayPathEventNames) {
						if      ( wasVisible && !makeVisible) google.maps.event.trigger(spec.AEmarker,'mouseout');  // Close display of event title 
						else if (!wasVisible &&  makeVisible) google.maps.event.trigger(spec.AEmarker,'mouseover');  // Force display of event title 
					}
        		}
        		if (spec.animationTargetAreaEvent >= 0) { // There is animation for this event
					var index = spec.lastSubsegmentIndex; // Find the first subsegment to process on this call to setTimePosition
					var indexSliderPos = spec.lastSubsegmentIndexSliderPos; // And its associated position on the slider (for the current timeline)
					var currentHDisNotBeforeTargetAEbegin = (hd.compareHistoricalDate(MYAPP.scenario.findEvent(spec.animationTargetAreaEvent).event.begin) != "before");
					
					// If this event is a source event for animation, and its time has past but the target area event hasn't started yet, then 
					// make any intermediate animation polygons invisible, if they haven't already been made so.
					
					if (!makeVisible && spec.pathSubsegments && currentHDisNotBeforeTargetAEbegin) {
						if (spec.lastSubsegmentIndex != 0) {
							for (var i=0; i < spec.pathSubsegments.length; i++) { 
								spec.pathSubsegments[i].GMsegment.setVisible(false);
								if (spec.AEmarker) { 
									spec.AEmarker.setVisible(false); // Same for the icon, if there is one
									if (spec.hoverWindow) spec.hoverWindow.close();
								}
							}
							spec.lastSubsegmentIndex = 0; // Ready to start processing the 0-th subsegment on next transition of path event from invisible to visible
						}
					}
					else { // Whether or not the source AE has ended, the target AE hasn't begun, so display any necessary intermediate polygons
				
						// The basic idea of the algorithm is as follows.  When setTimePosition(pos) is called, look at the current slider position pos 
						// vs. the slider position of the last subsegment that was processed in the previous invocation. If the last subsegment's slider position 
						// is less than the current position, then that subsegment is earlier in time, so proceed from that subsegment to the present time:
						// if spec.animationFillPath is true, turn on the visibility of the intervening subsegments; otherwise turn off the visibility of the subsegment 
						// at index (= spec.lastSubsegmentIndex) and turn on the visibility of the subsegment just before the current position pos.  
						// If the last subsegment's slider position is greater than the current position, then it is later in time, so 
						// proceed from the subsegment just before the last one processed and work backward in time to the current position, turning off 
						// the visibility of the intervening subsegments.

						if      (indexSliderPos < pos) {
							for (var i = index; i < spec.pathSubsegments.length; i++) {
								if (spec.pathSubsegments[i].sliderPos < pos) {
									spec.pathSubsegments[i].GMsegment.setVisible(spec.animationFillPath);
									if (spec.AEmarker) { 
										spec.AEmarker.setVisible(spec.animationFillPath);
										spec.AEmarker.setPosition(spec.pathCenterLine[i]);
										if (tl.displayPathEventNames) google.maps.event.trigger(spec.AEmarker, 'mouseover');  // Force display of event title 
									}
									index++;
								}
								else  { 
									index--;
									spec.pathSubsegments[index].GMsegment.setVisible(true);
									if (spec.AEmarker) { 
										spec.AEmarker.setVisible(true);
										spec.AEmarker.setPosition(spec.pathCenterLine[index]);
										if (tl.displayPathEventNames) google.maps.event.trigger(spec.AEmarker, 'mouseover');  // Force display of event title 
									}
									break;
								}
							}
						}
						else if (indexSliderPos > pos) {
							for (var i = index; i >= 0; i--) {
								if (spec.pathSubsegments[i].sliderPos >= pos) {
									spec.pathSubsegments[i].GMsegment.setVisible(false);
									if (spec.AEmarker) { 
										spec.AEmarker.setVisible(false);
										spec.AEmarker.setPosition(spec.pathCenterLine[i]);
										if (tl.displayPathEventNames) google.maps.event.trigger(spec.AEmarker, 'mouseout');  // Force display of event title 
									}
									index--;
								}
								else { 
									index++;
									spec.pathSubsegments[index].GMsegment.setVisible(true);
									if (spec.AEmarker) { 
										spec.AEmarker.setVisible(true);
										spec.AEmarker.setPosition(spec.pathCenterLine[index]);
										if (tl.displayPathEventNames) google.maps.event.trigger(spec.AEmarker, 'mouseover');  // Force display of event title 
									}
									break;
								}
							}
						}
						if (index >= spec.pathSubsegments.length) index = spec.pathSubsegments.length-1;
						else if (index < 0) index = 0;
						if ((index == 0) && spec.AEmarker) spec.AEmarker.setVisible(GMobject.getVisible());
						spec.lastSubsegmentIndex = index; // First subsegment to process on next call to setTimePosition
						spec.lastSubsegmentIndexSliderPos = spec.pathSubsegments[index].sliderPos; // And its associated slider position
					}
				}
        	}
            
            // If the marker is being displayed, either create a GM InfoWindow for it or display the previously created one, 
            // attach it to the marker, and open it if/when the marker is clicked.  Also, create a right-click listener to invoke
            // the editor on the event, if the user so chooses.
            //
            // If the marker is being made invisible, close the infoWindow (if it exists and clear the right-click listener.
        	
        	if (makeVisible) {
        		if (spec.GMclickListenerID == null) {
					spec.GMclickListenerID = google.maps.event.addListener(GMobject, 'click', function(event) {
																									if (!(spec.infoWindow)) {	// Create an infoWindow for this marker and save it
																											var formatGuide = ($('#current_time').data("format")) ? $('#current_time').data("format") : MYAPP.defaultHistoricalDateFormatGuide;
																											spec.infoWindow = new google.maps.InfoWindow({
																												content: "<b>" + spec.name + "</b><p><i>Starts: " + new ht.GregorianDateFormatter(tl.utcOffset,formatGuide,tl.timeZone).format(spec.begin) + "</i></p>" +
																														"<p><i>Ends: " + new ht.GregorianDateFormatter(tl.utcOffset,formatGuide,tl.timeZone).format(spec.end) + "</i></p>" +
																														"<p>" + spec.description + "</p>"
																											});
																										}
																										spec.infoWindow.setZIndex(1000); // Place the description infoWindow in front of open hover windows of any concurrent events
																										if (GMobject == spec.marker) {
																											google.maps.event.trigger(GMobject, 'mouseout');  // Close hover window
																											spec.infoWindow.open(GMobject.map,spec.marker);
																										}
																										else {
																											spec.infoWindow.setPosition(event.latLng);
																											spec.infoWindow.open(GMobject.map);
																										}
																				});
					spec.GMrightClickListenerID = google.maps.event.addListener(GMobject, 'rightclick', function (event) {
																											if (!MYAPP.edit) return; // no editing allowed
																											setupToEditEvent(spec.eventID,GMobject,true);
																					});
					if ((spec.polyline) && ((spec.animationIconStyle == "Placemark") || (spec.animationIconStyle == "Custom icon")) ){
						// For path events with either placemark or custom icons for animation, make the icon respond to left and right clicks
						if (spec.animationIconListenerID == null) {
							spec.animationIconClickListenerID = google.maps.event.addListener(spec.animationIconOnPath, 'click', function(event) {
																											if (!(spec.infoWindow)) {	// Create an infoWindow for this marker and save it
																													var formatGuide = ($('#current_time').data("format")) ? $('#current_time').data("format") : MYAPP.defaultHistoricalDateFormatGuide;
																													spec.infoWindow = new google.maps.InfoWindow({
																														content: "<b>" + spec.name + "</b><p><i>Starts: " + new ht.GregorianDateFormatter(tl.utcOffset,formatGuide,tl.timeZone).format(spec.begin) + "</i></p>" +
																																"<p><i>Ends: " + new ht.GregorianDateFormatter(tl.utcOffset,formatGuide,tl.timeZone).format(spec.end) + "</i></p>" +
																																"<p>" + spec.description + "</p>"
																													});
																												}
																												spec.infoWindow.open(GMobject.map,spec.animationIconOnPath);
																						});
							spec.animationIconRightClickListenerID = google.maps.event.addListener(spec.animationIconOnPath, 'rightclick', function (event) {
																													setupToEditEvent(spec.eventID,GMobject,true);
																							});
						}
					}
				}
       	 	}	
       	 	else { // Since the marker is being made invisible, close the infoWindow as well, if it exists (the marker may not yet have
       	 		   // been displayed, and so may not have an infoWindow).  Clear the rightclick (edit/delete) listener as well.
				if (spec.infoWindow) { spec.infoWindow.close(); }
				if (spec.GMclickListenerID != null) {
					google.maps.event.clearListeners(GMobject,"click");
					google.maps.event.clearListeners(GMobject,"rightclick");
					spec.GMclickListenerID = null;
					spec.GMrightClickListenerID = null;
				}
       	 	}
       	 	
       	 	// If the event is visible, determine if its lat/lng falls within the current viewport, or if not, in which sector outside the 
       	 	// viewport it falls.  For a point event, this is simply that lat/lng of the marker.  For path and area events, find the two 
       	 	// pairs (minLat, minLng) and (maxLat, maxLng) among all the points the define the path or area.  Note that we don't care if any 
       	 	// *specific* point corresponds to the min or max points; if there is any point, one of whose components is an extreme, then we 
       	 	// need to record that extreme lat or lng.
       	 	
       	 	if (makeVisible && viewportBoundsDefined) {
       	 		if 		(spec.marker) findMaxLatLngInAllSectors(spec.lat, spec.lng);
       	 		else if (spec.path) {
       	 			var minLat = spec.path[0].lat;
       	 			var maxLat = minLat;
       	 			var minLng = spec.path[0].lng;
       	 			var maxLng = minLng;
       	 			for (var j=1; j < spec.path.length; j++) {
       	 				if 		(spec.path[j].lat < minLat) minLat = spec.path[j].lat;
       	 				else if (spec.path[j].lat > maxLat) maxLat = spec.path[j].lat;
       	 				if		(spec.path[j].lng < minLng) minLng = spec.path[j].lng;
       	 				else if (spec.path[j].lng > maxLng) maxLng = spec.path[j].lng;
       	 			}
       	 			findMaxLatLngInAllSectors(minLat,minLng);
       	 			findMaxLatLngInAllSectors(maxLat,maxLng);
       	 		}
       	 		else if (spec.polygon) {
       	 			var minLat = spec.polygon[0].lat;
       	 			var maxLat = minLat;
       	 			var minLng = spec.polygon[0].lng;
       	 			var maxLng = minLng;
       	 			for (var j=1; j < spec.polygon.length; j++) {
       	 				if 		(spec.polygon[j].lat < minLat) minLat = spec.polygon[j].lat;
       	 				else if (spec.polygon[j].lat > maxLat) maxLat = spec.polygon[j].lat;
       	 				if		(spec.polygon[j].lng < minLng) minLng = spec.polygon[j].lng;
       	 				else if (spec.polygon[j].lng > maxLng) maxLng = spec.polygon[j].lng;
       	 			}
       	 			findMaxLatLngInAllSectors(minLat,minLng);
       	 			findMaxLatLngInAllSectors(maxLat,maxLng);
       	 		}
       	 	}
    	});
    	
    	// Having run through all visible points in this iteration and determined which, if any, sectors contain points 
		// beyond the viewport, cause the arrow buttons to be displayed for those sectors.
		
		if (viewportBoundsDefined) {
			for (var prop in MYAPP.eventsOutsideBounds) {
				if (MYAPP.eventsOutsideBounds[prop]) displayArrow(prop);
				else clearArrow(prop);
			}
		}
	}
	
	// Function to play a soundtrack.  Parameters are:
	//		soundtrack		a string with HTML describing the soundtrack (<audio> or <video> tag for an uploaded audio or video file, 
	//																	  <iframe> for an audio or video file on the Internet)
	//						OR a string holding one of "sc_start_desc_soundtrack","sc_end_desc_soundtrack", "tl_start_desc_soundtrack", or "tl_end_desc_soundtrack" 
	//						   In this latter case, the implied operation is "stop".
	//		operation		"start" or "stop"
	//		appendToBody	true => append the soundtrack (as jQuery element) to the <body> (see below)
	//						false => append the soundtrack (as jQuery) element to the context's dialog box (see below)
	// To start a soundtrack, operateMedia appends it to the appropriate context, or the <body> of the HTML:
	//		1. If the client's browser is Firefox AND there is no context, then append the soundtrack (if it exists) to the <body> HTML tag.  This is 
	//			a Firefox quirk: if there is no context, there is no visible element to append the soundtrack to, and Firefox will not play a soundtrack 
	//			that is not part of a visible HTML element.  Safari and Chrome will play such a soundtrack.
	//		2. If the client's browser isn't Firefox, or if it is but there is a visible context, append the soundtrack to the context.
	// For an <iframe> whose element is set to autoplay (this is set in the src URL when the audio or video is specified during scenario or timeline creation 
	// or editing), this is sufficient.  For an uploaded audio or video file, the HTML5 media API is used to tell the tag to play.  To stop a soundtrack, 
	// operateMedia simply removes the element whose ID matches the one in the soundtrack.
	
	function operateMedia(soundtrack,operation,appendToBody) {
		var mapDescriptorToContext = {	sc_start_desc_soundtrack: $("#scenario_opening_context"),	// Maps the id of the HTML tag for the soundtrack to the 
										sc_end_desc_soundtrack:   $("#scenario_closing_context"),	// jQuery element to which to attach it
										tl_start_desc_soundtrack: $("#timeline_opening_context"),
										tl_end_desc_soundtrack:   $("#timeline_closing_context")
									};
		var descriptors = ["sc_start_desc_soundtrack","sc_end_desc_soundtrack", "tl_start_desc_soundtrack", "tl_end_desc_soundtrack"];
		for (var i=0; i<descriptors.length; i++) { 
			if (descriptors[i] == soundtrack) {			// If this is the id of a soundtrack, stop the soundtrack
				$("#" + soundtrack).removeClass("soundtrack").remove();
				if (i == 0) MYAPP.SOSisPlaying = false;	// If it's the scenario opening soundtrack, note that it's not playing
				return;
			}
		}
		if (soundtrack.length == 0) return;	// There is no soundtrack
		var splitArray = (soundtrack.indexOf("'") > -1) ? soundtrack.split("'") : soundtrack.split('"');
		var mediaElementId, index = -1;
		for (var i=0; i < splitArray.length; i++) {
			if (splitArray[i].indexOf("id=") > -1) {
				index = i + 1;
				break;
			}
		}
		if (index == -1) {console.log("Could not find media element ID in tag: " + soundtrack); return; } // This should never happen
		mediaElementId = splitArray[index];
		if (operation == "stop")  {
			$("#" + mediaElementId).remove();
			if (mediaElementId.indexOf("sc_start") > -1) { 
				MYAPP.SOSisPlaying = false; 
			}
		}
		else {	// Start the media.  Only need to explicitly start <audio> or <video> tags; <iframe>s will auto-play
			if ($(".soundtrack").length > 0) return; // There is already a soundtrack in progress, so don't start another
			if (mediaElementId.indexOf("sc_start") > -1) { // We're starting the opening soundtrack of the scenario
				if (MYAPP.SOSisPlaying) return;			   // If it's already playing, don't start it again
				MYAPP.SOSisPlaying = true;
			}
			var targetOfAppend = (appendToBody) ? $("body") : mapDescriptorToContext[mediaElementId];
			targetOfAppend.append($(soundtrack).addClass("soundtrack"));	// Add "soundtrack" as a class to the soundtrack element (audio, video, iframe)
			if ((splitArray[0].indexOf("<Video") > -1) || (splitArray[0].indexOf("<Audio") > -1)) { // so we can keep track that there is only one at a time
				var myMedia = document.getElementById(mediaElementId);
				myMedia.play();
			}
		}
	}
    
    // Error message display/clearing functions
    //
    // All HTML for HiM is constructed with in the following DOM style:
    //		<label for="field_name">Field Name: </label><input type="text" id="field_name" />
	//		<div class="errorMessage"><p></p></div>
	// where the field_name is the name of the field and the input element type can be any legal choice.  The key thing here is that after the <label> and
	// <input> elements is the structure <div><p></p></div>.  This spaces out the vertical layout between this field and the next, but also is the place
	// where we can hang an error message if the contents of field_name are not what we expect.  We can get to the error message field by navigating via
	// jQuery to $("#field_name").next().children() and using .text() to set the error message and .css() to set the color of the text.  The jqObject parameter
	// is the jQuery object which is the HTML <input> element whose input needs to be flagged (field_name, in the above example).
	//
	// There are some HiM input fields that have to be encased in a <div> for this to work.  For example, the date input fields use the jQuery datepicker
	// widget, which puts a button after the input field, so the user can explicitly invoke the widget.  Therefore the <label> and <input> tags have to be
	// in a <div>, i.e., 
	//			<div id="field_encasing_div>
	//				<label for="field_name">Field Name: </label><input type="text" id="field_name" />
	//			</div>
	// and the setError function is invoked on $("#field_encasing_div").
	//
	// All error messages are invoked by a code which is the selector in an object that holds all error messages.
	
	function setError(jqObject, errorCode, errorColor) {
		var message = MYAPP.errorMessages.hasOwnProperty(errorCode) ? MYAPP.errorMessages[errorCode] : "Undefined error code: " + errorCode;
		var color = (errorColor == undefined) ? "#ff3300" : errorColor;
		var prevMessage = jqObject.next().children().text();	// Is there already an error message?
		if (prevMessage.length > 0) {
			jqObject.next().append($("<p>" + message + "</p>")).css("color", color);
		}
		else jqObject.next().children().text(message).css("color", color);
		return;
	}
	
	function clearError(jqObject) {
		jqObject.next().children().text("");
		return;
	}
	
	function clearAllErrors() { // Find all errorMessage <div>s and set the text of their children to blank.
		$(".errorMessage").children().each(function (index) {
												$(this).text("");
											});
	}
	
	MYAPP.errorMessages = {
		badDate:		"Date is not valid",
		badEmail:		"Invalid email address format",
		badHTU:			"Number of historical time units is not a whole number",
		badMonth:		"Month is not valid",
		badPassword:	"Incorrect password for this user",
		badProtocol:	"URL must start with http:// or https://",
		badScenario:	"Data does not describe a valid scenario",
		badStatus:		"Server returned unknown status",
		badTime:		"Time is not valid",
		badWCU:			"Number of wall-clock units is not whole number",
		blankUser:		"Must supply non-blank user name",
		cantCheckTitles:"Cannot get list of map titles from server",
		deleteFail:		"Unable to delete icon on server",
		duplMapTitle:	"Map of that name already exists",
		duplScenario:	"Scenario of this name already exists",
		fileTooBig:		"Cannot handle image file > " + MYAPP.maxUploadableFileSize + "Mb",
		iconPathMismatch: "Arrow icon style must have 'Entire path' specified",
		latBounds:		"Latitude must be between -90 and 90",
		latIsNaN:		"Latitude must be a number between -90 and 90",
		lngBounds:		"Longitude must be between -180 and 180",
		lngIsNaN:		"Longitude must be a number between -180 and 180",
		mediaTooBig:	"Cannot handle media file > " + MYAPP.maxUploadableFileSizeForMedia + "Mb",
		needDate:		"Can't specify a time without a date",
		needEnd:		"Can't have end date without start date",
		needEvent:		"Please choose an event, or cancel",
		needScenario:	"Must supply name of scenario",
		needStart:		"Can't have start date without end date",
		needTime:		"Need a time for this event",
		needUser:		"Must supply name of user you are copying from",
		needWCU:		"Must give a number of wall-clock units",
		needZip:		"You must select a zip file",
		noBlank: 		"Field must not be blank",
		noEmail:		"Must supply email to enable password reset",
		noEmailMatch:	"Email addresses do not match",
		noIcon:			"Must choose or specify a custom icon",
		nonPosHTU:		"Number of historical time units must be positive",
		nonPosWCU:		"Number of wall-clock units must be positive",
		noPassMatch:	"Passwords do not match",
		noScenario:		"User does not have that scenario",
		noScenarioData:	"Must provide an EXPORTed scenario string",
		noSlash:		"Name may not contain '/' or '+'",
		noSuchUser:		"No such user in the database",
		noURL:			"Could not find URL within the embed code",
		notAudio:		"File is not an audio file",
		notBefore:		"Start time is not before end time",
		notEmbed:		"This is not the Embed code from YouTube/Vimeo",
		notImage:		"Cannot use non-image file as icon",
		notURL:			"Must be a URL, not a local file",
		notVideo:		"File is not a video file",
		notZip:			"Must be a zip file (compressed archive)",
		plsWait:		"Please wait while file uploads to server",
		pwdNotSent:		"Temp password could not be emailed",
		pwdTooLong:		"Password is longer than 20 characters",
		pwdSentOK:		"Temp password successfully emailed",
		sentPwd:		"Sending temp password to your email",
		targetTime:		"Start time of target event is before source event start time",
		tooBig:			"Cannot handle zip files > " + Math.floor(MYAPP.maxMTZipFileSize/MYAPP.Mb) + " Mb",
		tooLong:		"Name must be 30 characters or less",
		tooLongScen:	"Name must be 30 characters or less",
		uploadFail:		"Unable to upload file to server",
		useEmail:		"Try to login with your email address",
		userExists:		"User of this name already exists",
		userTooLong:	"User name is longer than 40 characters",
		whichIsIt:		"Icon specified, but custom icon style not chosen"
	};
	
	// tellUserToFinish is called when all the following circumstances are true:
	//		1. User has deleted a scenario, AND
	//		2. User is in either the New Scenario or Open Scenario dialog, AND
	//		3. User is trying to cancel out of the dialog or close it (via the escape key or clicking the x to close the box) WITHOUT having
	//			completed either creating a new scenario or choosing to open an existing one.
	// The user must complete either the creation or selection so HiM has a valid current scenario.  tellUserToFinish puts up a dialog box telling
	// the user to finish the operation.
	
	function tellUserToFinish(operation) {
		operation = (operation == "create") ? "Creating" : "Opening";
		var gerund = (operation == "Creating") ? "creating" : "opening";
		var d = $("<div><p>Please finish " + gerund + " a scenario.</p></div>");
		d.dialog({
			autoOpen: true,
			show: { duration: 600 },
			hide: { duration: 600 },
			position: "center",
			width: 400,
			title: "Must Complete " + operation + " A Scenario",
			buttons: [
				{ text: "OK", click: function () { d.dialog("close") }
				}
			]
		});
	}
	
	// isAnotherCommandInProgress checks the global variable MYAPP.operationInProgress.  If it is null, then no other command is in progress and the command 
	// the user has just invoked may proceed.  That command becomes the value of MYAPP.operationInProgress until it is cleared by commandCompleted().  Otherwise, 
	// there is a command already in progress and the user is warned that s/he can't start that command until the current one completes.
	// Argument:
	//		command		The command the user wants to invoke 
	// Returns:
	//		true		There is a command already in progress 
	//		false		No command was in progress 
	
	function isAnotherCommandInProgress (command) {
		if (MYAPP.commandInProgress == null) {
			MYAPP.commandInProgress = command;
			return false;
		}
		var d = $("<div title='Command In Progress'>The command <b>" + MYAPP.commandInProgress + "</b> is already in progress.  You must finish that first before executing <b>" + command + "</b>.</div>");
		d.dialog({
			autoOpen: true,
			show: { duration: 600 },
			hide: { duration: 600 },
			position: "center",
			width: 400,
			buttons: [
				{ text: "OK", click: function() {
											d.dialog("close");
									  	 } 
				}
			]
		});
		return true;
	}
	
	function commandCompleted () {
		MYAPP.commandInProgress = null;
	}
	
	// Helper function to create a dialog box with all the images of the icons in the HiM icon library.  Called in editEvent when the user 
	// wants to select an icon rather than use the default or provide a file name.   Returns the jQuery structure representing the dialog box.
	
	function setupIconPicker() {
		MYAPP.iconMode = "select";
    	$("#icon_tabs").tabs("enable"); // Enable all tabs for HiM CIL if we're selecting an icon.  (One or more tabs have been disabled by FILE/ICONS command.)
    	$("#icon_add_files").css("display","none"); // Hide the button to add an icon file
    	return $("#icon_dialog_box").dialog({
    									autoOpen: false,
										title: "Select An Icon",
										show: { duration: 600 },
										hide: { duration: 600 },
										position: "left top+45",
										width: 600
									});
	}
	
	// Helper function to set up the Description areas in event, scenario, and timeline creation and editing.
	// Parameters:
	//		jqDescriptionSection			jQuery object which is the <div> for the entire description section 
	//		jqTextArea						jQuery object which is the <input> textarea to be filled/edited 
	//		buttonPrefix					the text string that prefaces the names of the <button>s within the description section
	//		externalFileList				object consisting of ExternalFile objects referenced in this description section 
	//		externalFilesAddedThisSession	object consisting of ExternalFile objects added in this session (in case the user cancels and the list of external files in the description has to be rolled back)
	
	function setupDescriptionSection (jqDescriptionSection,jqTextArea,buttonPrefix,externalFileList,externalFilesAddedThisSession) {  
		clearAllErrors(); // In case there were any error messages previously in the file selection, image, or URL dialogs	
		jqDescriptionSection.next().children().filter($("button")).each(function (index) {	// Turn on all the buttons for editing the description
														$(this).button().data({ "button-state": "off" });
													});
		var textFormatButtonHandler = function (event) {
			var state = $(this).data("button-state");
			var currentTextareaInput = jqTextArea.val();
			var tag;
			switch ($(event.target).text()) {
				case "B":
					tag = (state == "off") ? "<b>" : "</b>";
					break;
				case "I":
					tag = (state == "off") ? "<i>" : "</i>";
					break;
				case "U":
					tag = (state == "off") ? "<u>" : "</u>";
					break;
			}
			state = (state == "off") ? "on" : "off";
			jqTextArea.val(currentTextareaInput + tag);
			$(this).data({"button-state": state});
			jqTextArea.focus(); // Put the cursor back into the textarea.  It's placed at the end of user input, which doesn't include the tag just inserted.
		};
		$("#" + buttonPrefix + "button_bold").click(textFormatButtonHandler);
		$("#" + buttonPrefix + "button_italic").click(textFormatButtonHandler);
		$("#" + buttonPrefix + "button_underline").click(textFormatButtonHandler);
	
		// FileButtonHandler is invoked as follows.  If the user clicks on "Image File" to upload a local file to the server, URLButtonHandler handles the 
		// click and puts up a dialog box with an <input type="file"> element.  FileButtonHandler is bound to that input element.  If the user chooses a 
		// file, FileButtonHandler creates an ExternalFile object for the file and uploads it to the server.  If this succeeds, it then uses the new name 
		// of the saved file as the value for the src tag within the <img> element in the event's description.  FileButtonHandler closes the file selection 
		// dialog box which unbinds the change listener, since that will get rebound the next time the user clicks on "Image File".
	
		var FileButtonHandler = function (event) {
			var files = event.target.files; // FileList object.
			var f = files[0];
			// Only process image files or PDFs
			if (!(f.type.match('image.*') || (f.type == "application/pdf"))) {
				setError($("#file_input"),"notImage");
				return;
			}
			else if (f.size > MYAPP.maxUploadableFileSize) {
				setError($("#file_input"),"fileTooBig");
				return;
			}
			clearAllErrors();
			var externalFile = new ht.ExternalFile({ user: MYAPP.currentLoggedInUser,
													 fileType: "image",
													 fileExtension: f.name.substr(f.name.lastIndexOf(".")+1)
											});
			var deferredFileSavedToServer = $.Deferred();
			storage.saveExternalFile_Async(externalFile,f,deferredFileSavedToServer);
			deferredFileSavedToServer.done(function(imageURL) {
				event.data.dialog("close");  // event.data points to the dialog object, so close it
				externalFile.url = imageURL; // imageURL is the fully specified URL 
				externalFileList.push(externalFile); // Add to external file list for this event, scenario or timeline
				externalFilesAddedThisSession.push(externalFile); // Add to external file list for this editing session
				jqTextArea.val(jqTextArea.val() + "<img src='" + imageURL + "'/>");
			})
			.fail(function () {
				setError($("#file_input"),"uploadFail");
			});
		};

		// URLButtonHandler handles clicks on the Image URL and Link buttons in the Description section of the accordion widget.
		// It puts up a dialog box that is customized depending on which button was pressed.  if the Link button was clicked, the dialog box asks for 
		// a string that can be interpreted as a URL and an optional string to display in lieu of the URL.  If the Image URL button was clicked, the dialog 
		// box prompts for a URL only.
			
		var URLButtonHandler = function (event) {
			var caseType;
			$("#embed_code_div").css("display","none");	// Only needed when getting soundtrack info for YouTube or Vimeo video
			switch ($(event.target).text()) {
				case "Image URL":
					caseType = "Image URL";
					$("#URL_input_div").css("display","block");
					$("#link_text_div").css("display","none");
					$("#image_file_input_div").css("display","none");
					break;
				case "Image File":
					caseType = "Image File";
					$("#URL_input_div").css("display","none");
					$("#link_text_div").css("display","none");
					$("#file_input").replaceWith($("#file_input").clone()); // See http://forum.jquery.com/topic/how-to-clear-a-file-input-in-ie
					$("#image_file_input_div").css("display","block");
					break;
				case "Link":
					caseType = "Link";
					$("#URL_input_div").css("display","block");
					$("#link_text_div").css("display","block");
					$("#image_file_input_div").css("display","none");
					break;
			}
			if ((caseType == "Image URL") || (caseType == "Link")) {
				$("#URL_input").val("");		// Blank out any previous input		
				$("#link_text_input").val("");
				var d = $("#URL_dialog").css("display", "block");
				d.dialog({
					autoOpen: true,
					show: { duration: 600 },
					hide: { duration: 600 },
					position: "center",
					width: 600,
					title: "Provide URL",	// Set the title of the dialog box
					buttons: [
						{ text: "Cancel", click: function() {
														d.dialog("close").css("display","none");
														jqTextArea.focus(); // Put the cursor back into the textarea.  It's placed at the end of user input, which doesn't include the tag just inserted.
												 } 
						},
						{ text: "Save", click: function() {
														URLorFilename = $("#URL_input").val();
														var colon = URLorFilename.indexOf(":");
														var protocol = "";
														var protocolOK = true;
														if (colon > -1) {
															protocol = URLorFilename.substr(0,colon); 
															protocolOK = (protocol == "http") || (protocol == "https");
														}
														if ((URLorFilename.length == 0) || (!protocolOK) || (colon < 0)) {
															if (URLorFilename.length == 0) 	setError($("#URL_input"),"noBlank");
															if (!protocolOK)				setError($("#URL_input"),"badProtocol");
															if (colon < 0)					setError($("#URL_input"),"notURL");
														}
														else {
															var tag;
															clearAllErrors();
															switch (caseType) {
																case "Image URL":
																	tag = "<img src='" + URLorFilename + "'/>";
																	break;
																case "Link":
																	var linkText = $("#link_text_input").val();
																	if (linkText == "") linkText = URLorFilename;
																	tag = "<a href='" + URLorFilename + "' target='_blank'>" + linkText + "</a>";
																	break;
																default:
																	tag = "Not image or link";
																	break;
															}
															jqTextArea.val(jqTextArea.val() + tag);
															d.dialog("close").css("display","none");
															jqTextArea.focus(); // Put the cursor back into the textarea.  It's placed at the end of user input, which doesn't include the tag just inserted.
															return;
														}
												}
						}
					]
				});
			}
			else { // "Image File" clicked
				var d = $("#URL_dialog").css("display", "block");
				$("#file_input").bind("change",d,FileButtonHandler); // Pass the jQuery dialog object to the handler so we can close it
				d.dialog({
					autoOpen: true,
					show: { duration: 600 },
					hide: { duration: 600 },
					position: "center",
					width: 600,
					close: function () { $("#file_input").unbind(); },
					title: "Provide Local File Name"	// Set the title of the dialog box
				});
			}
		};
		$("#" + buttonPrefix + "button_image").click(URLButtonHandler);
		$("#" + buttonPrefix + "button_link").click(URLButtonHandler);
		$("#" + buttonPrefix + "button_image_file").click(URLButtonHandler);
		
		if (buttonPrefix == "") return; // We're done setting up for an event description
		
		// Selection of soundtrack.  This is relevant for scenarios and contexts, but not (at present, 11/4/14) for events.  Soundtrack selection proceeds as follows:
		//		1. User clicks "Select Soundtrack" button.
		//		2. The button has a click listener that puts up a dialog box with a <select> element that has choices for soundtrack sources (e.g., upload a video file, use YouTube video, etc.).
		//		3. The <select> element has an "on change" listener that puts up a dialog box appropriate to the selection (similar to URLButtonHandler above).
		//		4. The "on change" listener has cases for the different source choices, wich fall into three categories:
		//			a. Files to be uploaded (i.e., local audio or video files).  These are handled by binding FileButtonHandlerForSoundtrack to the <input> element for file selection.
		//			b. A URL (audio file on the web).
		//			c. Embed code from a site like YouTube or Vimeo.
		//		The "on change" listener will put up the appropriate HTML and handle the Cancel/Save for cases 4b and 4c, or bind FileButtonHandlerForSoundtrack to handle case 4a.
		//
		//	There are three parts to returning the selected soundtrack:
		//		1. The value to be stored in the scenario or timeline.
		//		2. Where exactly to store the value.
		//		3. Checking the user-supplied value for correctness.
		//	1. The value to be stored is as follows:
		//		a. For an uploaded video or audio file, the value is the <video> or <audio> tag with the source being the URL returned from the server for the uploaded file.
		//		b. For a YouTube or Vimeo video, it is the <iframe> provided by YT or Vm, with only the source attribute and no others.  Height and width of the iframe must be set to zero.
		//		c. For an audio URL, turn that into an <iframe> with the source being the URL.  As in 1b, height and width must be set to zero.
		//	2. The value to be stored is in the global object MYAPP.soundtrack.  This object is set to {} when a scenario or timeline is created or edited, as part of the setup for creation/editing.
		//	   When a soundtrack value is supplied, the value is set for the object's attribute held in the buttonPrefix, i.e.:
		//			MYAPP.soundtrack[buttonPrefix] = soundtrackValue;
		//	   When the user clicks the Save button for the scenario or timeline and all input values are retrieved and checked, that code will look for the 
		//	   object keys sc_start_desc/sc_end_desc or tl_start_desc/tl_end_desc as appropriate and retrieve the soundtrack values, if they exist.
		//	3. By the time the user clicks the Save button for the scenario or timeline, the dialog box for the soundtrack is gone, so any checking and correction 
		//	   of the user-supplied entry must be done while that dialog box is on the screen.  The error-checking is case-specific.  It ends when the user either 
		//	   supplies a syntactically correct entry for URLs or embedded code or an existing file of the appropriate type for files to be uploaded, or simply 
		//	   cancels the operation to supply a soundtrack.
		
		// Define the handler for processing media (audio and video) file uploads.
		
		var mediaFileButtonHandler = function (event) {
			clearAllErrors();
			var files = event.target.files; // FileList object.
			var f = files[0];
			var buttonPrefix = event.data.buttonPrefix; // Have to pass in the buttonPrefix with the event data
			// Only process files of the type appropriate to the type of upload the user specified
			var mediaType = event.data.option.substring(0,event.data.option.indexOf(" "));
			if (!(f.type.match(mediaType.toLowerCase() + '.*'))) {
				setError($("#file_input"),"not" + mediaType);
				return;
			}
			if (f.size > MYAPP.maxUploadableFileSizeForMedia ) {
				setError($("#file_input"),"mediaTooBig");
				return;
			}
			clearAllErrors();
			var externalFile = new ht.ExternalFile({ user: MYAPP.currentLoggedInUser,
													 fileType: mediaType,
													 fileExtension: f.name.substr(f.name.lastIndexOf(".")+1)
											});
			var deferredFileSavedToServer = $.Deferred();
			storage.saveExternalFile_Async(externalFile,f,deferredFileSavedToServer);
			deferredFileSavedToServer.done(function(mediaURL) {
				event.data.dialogObj.dialog("close");  // event.data.dialogObj points to the dialog object, so close it
				externalFile.url = mediaURL; // mediaURL is the fully specified URL 
				externalFileList.push(externalFile); // Add to external file list for this scenario or timeline
				externalFilesAddedThisSession.push(externalFile); // Add to external file list for this editing session
				MYAPP.soundtrack[buttonPrefix] = "<" + mediaType  
													 + " id='" + buttonPrefix +  "soundtrack'"
													 + " width='0' height='0'>"
													 + "<source src='" + mediaURL + "' type='" + f.type + "'>"
													 + "Your browser does not support the " + mediaType + " tag."
													 + "</" + mediaType + ">";
			})
			.fail(function () {
				setError($("#file_input"),"uploadFail");
			});
		};
		
		// Define the handler for <select> tag options
		
		var soundtrackOptionChangeHandler = 		
			function (event) {
				var caseType;
				var buttonPrefix = event.data.buttonPrefix;
				event.data.dialogObj.dialog("close").css("display","none"); // Close the source selection dialog box
				var optionSelected = $(event.target).find("option:selected").val();
				$("#embed_code_div").css("display","none");
				$("#link_text_div").css("display","none");
				switch (optionSelected) {
					case "Remove":	// Remove both the pending soundtrack selection (if there is one), and remove the soundtrack selection in 
									// the scenario or timeline when the entire editing/creation session is saved
						MYAPP.soundtrack[buttonPrefix] = "";
						break;
					case "Video upload":
					case "Audio upload":
						$("#URL_input_div").css("display","none");
						$("#file_input").replaceWith($("#file_input").clone()); // See http://forum.jquery.com/topic/how-to-clear-a-file-input-in-ie
						$("#image_file_input_div").css("display","block");
						var d = $("#URL_dialog").css("display", "block");
						$("#file_input").bind("change",
											  { dialogObj: d, 							// Pass along the dialog box to close
											    option: optionSelected,					// Which oundtrack source option was chosen
											    buttonPrefix: buttonPrefix	// And the buttonPrefix (e.g., sc_start_desc_)
											  }, 
											  mediaFileButtonHandler); // Pass the jQuery dialog object to the handler so we can close it
						d.dialog({
							autoOpen: true,
							show: { duration: 600 },
							hide: { duration: 600 },
							position: "center",
							width: 600,
							close: function () { $("#file_input").unbind(); },
							title: "Provide Local " + ((optionSelected == "Video upload") ? "Video" : "Audio") + " File Name"	// Set the title of the dialog box
						});
						break;
					case "Audio URL":
						$("#URL_input_div").css("display","block");
						$("#image_file_input_div").css("display","none");
						$("#URL_input").val("");		// Blank out any previous input		
						$("#link_text_input").val("");
						var d = $("#URL_dialog").css("display", "block");
						d.dialog({
							autoOpen: true,
							show: { duration: 600 },
							hide: { duration: 600 },
							position: "center",
							width: 600,
							title: "Provide Audio URL",	// Set the title of the dialog box
							buttons: [
								{ text: "Cancel", click: function() {
																d.dialog("close").css("display","none");
														 } 
								},
								{ text: "Save", click: function() {
																var URL = $("#URL_input").val();
																var colon = URL.indexOf(":");
																var protocol = "";
																var protocolOK = true;
																if (colon > -1) {
																	protocol = URL.substr(0,colon); 
																	protocolOK = (protocol == "http") || (protocol == "https");
																}
																if ((URL.length == 0) || (!protocolOK) || (colon < 0)) {
																	if (URL.length == 0) 	setError($("#URL_input"),"noBlank");
																	if (!protocolOK)		setError($("#URL_input"),"badProtocol");
																	if (colon < 0)			setError($("#URL_input"),"notURL");
																}
																else {
																	clearAllErrors();
																	d.dialog("close").css("display","none");
																	MYAPP.soundtrack[buttonPrefix] = "<iframe id='" + buttonPrefix + "soundtrack'"
																										 + " width='0' height='0'"
																										 + " src='" + URL  + "'>"
																										 + "</iframe>";
																}
														}
								}
							]
						});
						break;
					case "YouTube":
					case "Vimeo":
						$("#embed_code_div").css("display","block");
						$("#embed_code_input").val("");
						$("#URL_input_div").css("display","none");
						$("#link_text_div").css("display","none");
						$("#image_file_input_div").css("display","none");
						var d = $("#URL_dialog").css("display", "block");
						d.dialog({
							autoOpen: true,
							show: { duration: 600 },
							hide: { duration: 600 },
							position: "center",
							width: 600,
							title: "Cut/Paste Embed Code From " + optionSelected + " Website",	// Set the title of the dialog box
							buttons: [
								{ text: "Help", click: function () {
															var s = "<div>At YouTube, find your desired video and click on the <b>Share</b> link just below the video.  Then click on the <b>Embed</b> link and copy the text that is displayed and highlighted.  ";
															s = s + "Paste the text into the <b>Embed</b> window in History <i>in Motion</i>.";
															s =	s + "<br><p>At Vimeo, the <b>Share</b> link is the little paper airplane icon at the top right of the video.  Copy and paste the <b>Embed</b> code that Vimeo displays.</p>";
															s = s + "<p>Remember, use the YouTube/Vimeo <b>Embed</b> code, not the <b>Link</b> code.</p></div>";
															s = $(s);
															s.dialog({	autoOpen: true,
																		show: { duration: 600 },
																		hide: { duration: 600 },
																		position: "center",
																		title: 'Using YouTube/Vimeo Video As Soundtrack',
																		width: 600
																		});
														}
								},
								{ text: "Cancel", click: function() {
																d.dialog("close").css("display","none");
														 } 
								},
								{ text: "Save", click: function() {
																var embedCode = $("#embed_code_input").val();
																
																// There is no way in jQuery to test a string for its being valid HTML (unless you use a jQuery plugin).
																// So let's do some rudimentary checks:
																//		1. Is there an <iframe> tag?  If not, error.
																//		2. Does the tag have a src= attribute?  If not, error.
																//		3. Is the value of the src attribute a syntactically valid URL, at least in terms of having the right protocol?  If not, error.
																// We'll extract the URL and make our own <iframe>, because YouTube and Vimeo have a lot of extra stuff we don't want.  If the URL 
																// turns out to be invalid, that's the user's problem.	
																// A typical piece of embed code would look something like this:
																//		<iframe width="420" height="315" src="https://www.youtube.com/embed/xToPCaNxaow" frameborder="0" allowfullscreen></iframe>	
																
																var iframeIndex = embedCode.indexOf("<iframe ");	// Make sure this is there.  If the user picked up the YouTube or Vimeo "share" link only, that won't work.
																var URL = "";
																var splitArray = (embedCode.indexOf("'") > -1) ? embedCode.split("'") : embedCode.split('"');
																var foundURL = false;
																for (var i=0; i < splitArray.length; i++) {
																	if (splitArray[i].indexOf("src=") > -1) {
																		URL = splitArray[i+1]; // URL follows the src attribute
																		foundURL = true;
																		break;
																	}
																}
																
																if ((embedCode.length == 0) || (URL.length == 0) || (iframeIndex < 0)) {
																	if (embedCode.length == 0)  	setError($("#embed_code_input"),"noBlank");
																	if (URL.length == 0)			setError($("#embed_code_input"),"noURL");
																	if (iframeIndex < 0)			setError($("#embed_code_input"),"notEmbed");
																}
																else {
																	clearAllErrors();
																	d.dialog("close").css("display","none");
																	MYAPP.soundtrack[buttonPrefix] = "<iframe id='" + buttonPrefix + "soundtrack'"
																										 + " width='0' height='0'"
																										 + " src='" + URL  + "?rel=0&autoplay=1'>"
																										 + "</iframe>";
																}
														}
								}
							]
						});
				}
			};
			
		// Define the handler for the "Select Soundtrack Source" button.  
		
		var selectSoundtrackButtonHandler =
			function (event) {
				var buttonPrefix = event.data.buttonPrefix;
				var soundtrackTextCurrent = "No soundtrack."
				if (!((MYAPP.commandInProgress == "NEW/SCENARIO") || (MYAPP.commandInProgress == "NEW/TIMELINE"))) { // If user's creating a new scenario or timeline, 
																														 // don't try to get the current soundtrack from the current scenario or timeline
					switch (buttonPrefix) {
						case "sc_start_desc_":
							if (MYAPP.scenario.scStartSoundtrack != "") soundtrackTextCurrent = MYAPP.scenario.scStartSoundtrack;
							break;
						case "sc_end_desc_":
							if (MYAPP.scenario.scEndSoundtrack != "") soundtrackTextCurrent = MYAPP.scenario.scEndSoundtrack;
							break;
						case "tl_start_desc_":
							if (MYAPP.timelineBeingEdited.startSoundtrack != "") soundtrackTextCurrent = MYAPP.timelineBeingEdited.startSoundtrack;
							break;
						case "tl_end_desc_":
							if (MYAPP.timelineBeingEdited.endSoundtrack != "") soundtrackTextCurrent = MYAPP.timelineBeingEdited.endSoundtrack;
							break;
					}
				}
				
				var soundtrackText = "No soundtrack selection pending.";
				if ((MYAPP.soundtrack[buttonPrefix] != undefined) && (MYAPP.soundtrack[buttonPrefix] != "")) soundtrackText = MYAPP.soundtrack[buttonPrefix];
				else if (MYAPP.soundtrack[buttonPrefix] == "") soundtrackText = "No soundtrack selected.";
				else {
					if (!((MYAPP.commandInProgress == "NEW/SCENARIO") || (MYAPP.commandInProgress == "NEW/TIMELINE"))) { // If user's creating a new scenario or timeline, 
																														 // don't try to get the current soundtrack from the current scenario or timeline
						switch (buttonPrefix) {
							case "sc_start_desc_":
								if (MYAPP.scenario.scStartSoundtrack != "") soundtrackText = MYAPP.scenario.scStartSoundtrack;
								break;
							case "sc_end_desc_":
								if (MYAPP.scenario.scEndSoundtrack != "") soundtrackText = MYAPP.scenario.scEndSoundtrack;
								break;
							case "tl_start_desc_":
								if (MYAPP.timelineBeingEdited.startSoundtrack != "") soundtrackText = MYAPP.timelineBeingEdited.startSoundtrack;
								break;
							case "tl_end_desc_":
								if (MYAPP.timelineBeingEdited.endSoundtrack != "") soundtrackText = MYAPP.timelineBeingEdited.endSoundtrack;
								break;
						}
					}
				}
				
				$("#soundtrack_display_current").text("").text(soundtrackTextCurrent);	// Display current soundtrack, if one exists
				$("#soundtrack_display_pending").text("").text(soundtrackText);	// Display pending selected soundtrack, if one exists
			
				$("#soundtrack_source_selection option").prop('selected',false).filter(function() {	// Find the option element that is the default ("None"), and set the selection to be it
																										return $(this).val() == "None"; 
																									  }).prop('selected', true);
				var d = $("#soundtrack_source_selection_div").css("display", "block");
				$("#soundtrack_source_selection").unbind("change").bind("change",
																   { buttonPrefix: buttonPrefix,	// Pass along the buttonPrefix
																     dialogObj: d },
																     soundtrackOptionChangeHandler);
				d.dialog({
					autoOpen: true,
					show: { duration: 600 },
					hide: { duration: 600 },
					position: "center",
					width: 500,
					buttons: [
						{ text: "Close", click: function() {
														d.dialog("close").css("display","none");
												 } 
						}
					]
				});
			};
		
		// Attach the button handler to the "select source type" button and we're ready to go.
			
		$("#" + buttonPrefix + "button_soundtrack").button().data({ "button-state": "off" }).bind("click",
																								   {buttonPrefix: buttonPrefix},
																								   selectSoundtrackButtonHandler);
	}
	
	// Helper function to unbind Description section listeners for Event, Scenario, and Timeline.
	// Parameter:
	//		buttonPrefix		string which is the prefix for the names of the buttons for this Description section
	
	function unBindDescriptionListeners (buttonPrefix) {
		$("#" + buttonPrefix + "button_bold").unbind("click"); 
		$("#" + buttonPrefix + "button_italic").unbind("click"); 
		$("#" + buttonPrefix + "button_underline").unbind("click"); 
		$("#" + buttonPrefix + "button_image_file").unbind("click");
		if (buttonPrefix != "") $("#" + buttonPrefix + "button_soundtrack").unbind("click"); // Only unbind for scenarios and timelines, not events
	}
    
    // FUNCTIONS FOR HiM MENU ITEMS
    //
    // The following are callback functions to invoke when a specific HiM menu item is clicked.  The jQuery objects are tightly
    // linked to the menu's HTML structure, so if the latter changes, the former must as well.
    //
    // NEW/SCENARIO function
    
    $("#enclose-menu li:contains(New) li:contains(Scenario)").click(function () {
    	if (!MYAPP.OKToLoadScenario) {
    		commandCompleted();
    		return;	// It's not safe yet to load a scenario
    	}
    	if (isAnotherCommandInProgress("NEW/SCENARIO")) return; // If another command is in process, can't continue with this one
    	if ((MYAPP.scenario != undefined) && (!MYAPP.workingCopyIsSaved)) { // We have a scenario that's been saved locally but not to the server yet
    		var d = $("<div title='Warning'>The last set of changes to scenario <b>" + MYAPP.scenario.scName + "</b> has not been saved to the server.  Would you like to save them?<div>");
    		d.dialog({
				autoOpen: true,
				show: { duration: 600 },
				hide: { duration: 600 },
				position: "center",
				width: 600,
				buttons: [
					{ text: "Save Changes", click: function() {
														var deferredSaveScenario = $.Deferred();
														saveAuthoritativeCopy_Async(false,deferredSaveScenario);
														d.dialog("close");
														deferredSaveScenario.done(function () {
															d.dialog("close");
															d = $("<div title='Scenario Saved To Server'>Scenario <b>" + MYAPP.scenario.scName + "</b> has been saved.</div>");
															d.dialog({
																	autoOpen: true,
																	show: { duration: 600 },
																	hide: { duration: 600 },
																	width: 600,
																	position: "center"
																});
															setTimeout(function () { 
																d.dialog("close"); 
															},3000);
															finishCreatingScenario();
														})
														.fail(function () {
															$("<div title='Scenario Not Saved To Server'>Scenario <b>" + MYAPP.scenario.scName + "</b> could not be saved to the server.  If you continue creating a scenario, the changes to the unsaved scenario will be lost.</div>").dialog({
																	autoOpen: true,
																	show: { duration: 600 },
																	hide: { duration: 600 },
																	width: 600,
																	position: "center"
																});
														});
											 } 
					},
					{ text: "Discard Changes", click: function () {
														MYAPP.workingCopyIsSaved = true;
														d.dialog("close");
														finishCreatingScenario();
											 }
					},
					{ text: "Cancel", click: function () {
														d.dialog("close");
														commandCompleted();
											 }
					}
				]
    		});
    	}
    	else finishCreatingScenario();
    });
    	
    function finishCreatingScenario () {
    	// If there is a timeline or scenario context displayed, close it before trying to create a new scenario.
		
		if (MYAPP.SOCisVisible) $("#scenario_opening_context").dialog("close").css("display","none");
		if (MYAPP.SCCisVisible) $("#scenario_closing_context").dialog("close").css("display","none");
		if (MYAPP.TOCisVisible) $("#timeline_opening_context").dialog("close").css("display","none");
		if (MYAPP.TCCisVisible) $("#timeline_closing_context").dialog("close").css("display","none");
		
    	clearAllErrors();
    	var scenarioName = null; 	// Name of scenario to create
    	var copyright = null;		// Copyright notice for scenario
    	var defaultEra = "CE";		// Default era for scenario
    	var defaultTimeZone = "";	// Default timezone for scenario
    	var historicalMap = null;	// Historical map to use (if any)
    	var today = new Date();
    	$("#scenario").val("");
    	var copyrightDefault = "Copyright " + today.getFullYear() + " " + MYAPP.currentLoggedInUser.userName + ".  All rights reserved.";
    	$("#copyright").attr("value", copyrightDefault);
    	$("#default_CE_creation").prop("checked", true);
		$("#default_time_zone_creation option").filter(function() {	// Find the option element that is this time zone, and set the selection to be it
			return $(this).text() == MYAPP.timeZones[0]; 		// UTC is the default
		  }).prop('selected', true);
		var externalFileList = []; 	// Array of ExternalFile objects (representing images, videos, etc. on the HiM server) used in this event's description. 
    								// NOTE! This is assembled as the user uploads files when editing the description, but the user can delete the <img> tags 
    								// manually.  So if the externalFileList is used during FILE/SAVE AS, a given file in the list may *not* be found in the 
    								// description text.  This is NOT an error.	
    	var externalFilesAddedThisSession = []; // Array of ExternalFile objects added during this editing session, so we can roll them back if the user cancels the edit
		var startDesc = $("#sc_start_desc").val("");
		var endDesc = $("#sc_end_desc").val("");
		MYAPP.soundtrack = {};	// Clear any soundtrack values previously specified during a scenario or timeline creation or editing session
		setupDescriptionSection($("#sc_start_desc_div"), $("#sc_start_desc"),"sc_start_desc_",externalFileList,externalFilesAddedThisSession);
		setupDescriptionSection($("#sc_end_desc_div"), $("#sc_end_desc"),"sc_end_desc_",externalFileList,externalFilesAddedThisSession);
		var d = $("#new_scenario_accordion");	// The New Scenario <div>
		d.children().filter(".change_times").remove();	// Remove any previous change time elements
		$(".edit_only").css("display","none"); // Hide any edit-only fields
		$(".create_only").css("display","block");
		$("#sc_cancel_button").button().click(function(e) { 
												if (MYAPP.caseForOpeningScenario == 3) {	// User has no scenarios left to open and so MUST create one
													tellUserToFinish("create");
													return;
												}
												commandCompleted();
												$("#sc_cancel_button").unbind("click");
												$("#sc_save_button").unbind("click");
												scenarioAccordion.accordion("destroy").css("display","none");
												var deferredDeleteFileArray = [];  // If the user uploaded any external files in this editing session, delete them from the server.
												for (var i=0; i < externalFilesAddedThisSession.length; i++) {
													deferredDeleteFileArray[i] = $.Deferred();  // No need to sync with the server response, since we don't care what it is
													storage.deleteExternalFile_Async(externalFilesAddedThisSession[i],deferredDeleteFileArray[i]);
													deferredDeleteFileArray[i].fail(function() {	
																						console.log("Server could not delete file " + externalFilesAddedThisSession[i].fileName);
																					});
												}	
		});
		$("#sc_save_button").button().click(function(e) {
												scenarioName = $("#scenario").val().trim();
												if ((scenarioName.indexOf("/") >= 0) || (scenarioName.indexOf("+") >= 0))  {
													setError($("#scenario_div"),"noSlash");
													return;
												}
												copyright = $("#copyright").val();
												defaultEra = $("#default_BCE_creation").prop("checked") ? "BCE" : "CE"; // For some reason, defaultEra = $('input:radio[name=default_era_option_creation]:checked').val(); is not returning correct value
												defaultTimeZone = $("#default_time_zone_creation").val();
												startDesc = $("#sc_start_desc").val().trim();
												endDesc = $("#sc_end_desc").val().trim();
												if ((scenarioName == null) || (scenarioName.length == 0)) {
														setError($("#scenario_div"),"needScenario");
														return;
												}
												var foundIndex = -1;
                                                getScenarioNames_Async().done(function(scenarioNames) {
                                                    for (var i=0; i < scenarioNames.length; i++) {
                                                        if (scenarioName == scenarioNames[i].name) {
                                                            foundIndex = i; // Found the current scenario in the list
                                                        }
                                                    }
                                                    if (foundIndex > -1) {	// If we found the scenario in the list, and we can't have two scenarios with the same name
                                                        setError($("#scenario_div"),"duplScenario");
                                                        return;
                                                    }
													MYAPP.caseForOpeningScenario = 0; // Allow accordion to close 
													$("#sc_cancel_button").unbind("click");
													$("#sc_save_button").unbind("click");
													scenarioAccordion.accordion("destroy").css("display","none");
													
													// The user wants to create a new scenario from scratch.  Show the entire world and let the user zoom and drag the map 
													// to whatever they like as the starting point for their scenario.  Also, get rid of the timelines for the previous 
													// scenario that was loaded (if any).
													
													$('#Select_Timeline').empty(); // Remove any timelines from a previously loaded scenario in the selector box
													$('#current_time').text("");   // Blank out any previously displayed time
													var mapOptions = {	// This basically shows the entire world as the starting point.  The user can drag and zoom from there.
															zoom: 2,
															center: new google.maps.LatLng(15.707662769583505,-19.6875),
															mapTypeId: google.maps.MapTypeId.ROADMAP,
															keyboardShortcuts: false /* Prevent Maps from handling the arrow keys used for timeline slider control */
														};
													MYAPP.map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions); 
													d = $("#new_scenario_map"); // Note that this dialog has an "on change" listener for the case in which the user selects 
																				// a historical map from the <select> element.  If the user does make a historical map 
																				// selection, that will set MYAPP.mapID to the map ID and MYAPP,mapLayers to the set of 
																				// MapsEngineLayer objects created by GM. (This "on change" listener was set up during HiM 
																				// initialization when the historical map menus were created.)
													var deferredGetMaps = $.Deferred();
													storage.getMaps_Async(deferredGetMaps);
													deferredGetMaps.done(function(historicalMapList) {
														makeHistoricalMapMenu(historicalMapList,$("#historical_map_creation"));
														$("#historical_map_creation option").filter(function() {	// Find the option element that is this historical map, and set the selection to be it
															return $(this).text() == "None"; 
														  }).prop('selected', true);
														d.dialog({
															autoOpen: true,
															show: { duration: 600 },
															hide: { duration: 600 },
															position: "center",
															width: 600,
															buttons: [  // No "cancel" button.  Canceling would leave HiM in an uncertain state, because the world map 
																		// now showing would not be consistent with the fact that that map doesn't correspond to the 
																		// current scenario.
																{ text: "OK", click: function() { 
																								d.dialog("close");
																								MYAPP.caseForOpeningScenario = 0; // If we got here via case 3, set the case to something other than 3,
																																  // otherwise if New/Scenario is invoked before case 1 or 2, case 3 will 
																																  // still be in effect and user will be forced to finish creating a new scenario
																								var center = MYAPP.map.getCenter();  // Wherever the user has dragged and zoomed the map is the starting point
																								center = new google.maps.LatLng(center.lat(),center.lng(),false);
																								var zoom = MYAPP.map.getZoom();
																								var mapDefinition = { 	mapCenter: 	center,
																														mapZoom:	zoom
																													};
																								if (MYAPP.historicalMapListIndex >= 0) {
																									mapDefinition.historicalMapListIndex = MYAPP.historicalMapListIndex;
																									if (MYAPP.mapID) {
																										mapDefinition.mapID = MYAPP.mapID;
																										mapDefinition.mapLayerKeys = [];
																										for (var i=0; i < MYAPP.mapLayers.length; i++) mapDefinition.mapLayerKeys[i] = MYAPP.mapLayers[i].getLayerKey();
																									}
																								}
																								var startSoundtrack = (MYAPP.soundtrack["sc_start_desc_"] != undefined) ? MYAPP.soundtrack["sc_start_desc_"] : "";
																								var endSoundtrack = (MYAPP.soundtrack["sc_end_desc_"] != undefined) ? MYAPP.soundtrack["sc_end_desc_"] : "";
																								MYAPP.scenario = new ht.Scenario(scenarioName,
																																 MYAPP.currentLoggedInUser.userName,
																																 copyright,
																																 {  creationDate: new Date(),
																																	lastOpenedDate: new Date(),
																																	lastModifiedDate: new Date()
																																 },
																																 mapDefinition,
																																 [],
																																 [],
																																 // TODO: Probably should have some distinguished MAX_DATE and MIN_DATE values.
																																 new ht.HistoricalDate(Date.parse("9999-01-01T00:00:00-05:00"),false),		// Scenario start date is 9999 CE, so first event added will be sooner than this
																																 new ht.HistoricalDate(ht.parseBceDate("9999-01-01T00:00:00-05:00"),false),   // Scenario end date is 9999 BCE, so first event added will be later than this
																																 [],
																																 defaultEra,
																																 defaultTimeZone,
																																 MYAPP.defaultHistoricalDateFormatGuide,
																																 [],
																																 startDesc,
																																 endDesc,
																																 startSoundtrack,
																																 endSoundtrack,
																																 externalFileList
																																);
																								$("#icons_SSIL").empty(); // Remove any icons in previously loaded scenario's SSIL
																								makeIconManagerTab($("#icons_SSIL"),MYAPP.scenario.scSSIL); // Set up Icon Manager tab for this scenario-specific icon library
																								$('#scenario_name').text(scenarioName);
																								$("#browser_title").text(scenarioName);
																								$("#slider-box").slider({
																													slide: function(event, ui) { 
																															setTimePosition(ui.value); },
																													value: 0,
																													max: 0,
																													min: 0
																												}).removeData().data("fractionalPosition",0);	/* Set time slider to origin, even though we have no timeline yet */
																								commandCompleted();
																								saveWorkingCopy(true);
																								if (externalFilesAddedThisSession.length > 0) updateUser(); // Save user object to server, because the sequence number for the next ExternalFile object has been updated during this edit session
																								var deferredSaveScenario = $.Deferred();
																								saveAuthoritativeCopy_Async(true,deferredSaveScenario);
																								deferredSaveScenario.done(function () {
																									var d = $("<div title='Scenario Created On Server'>Scenario <b>" + MYAPP.scenario.scName + "</b> has been created.</div>");
																									d.dialog({
																											autoOpen: true,
																											show: { duration: 600 },
																											hide: { duration: 600 },
																											width: 600,
																											position: "center"
																										});
																									setTimeout(function () { 
																										d.dialog("close"); 
																									},3000);
																								})
																								.fail(function () {
																									$("<div title='Scenario Not Created On Server'>Scenario <b>" + MYAPP.scenario.scName + "</b> could not be created on the server.  Please try again later.</div>").dialog({
																											autoOpen: true,
																											show: { duration: 600 },
																											hide: { duration: 600 },
																											width: 600,
																											position: "center"
																										});
																								});
																						}
																}
															]
														}); 
													})
													.fail(function () {
														commandCompleted();
														$("<div title='Server Unavailable'>Unable to get list of historical maps from server.</div>").dialog();
													});    
                                            	})
												.fail(function () { 
													commandCompleted();
													serverUnavailable({	op: "GetScenarioList",
																		clear: false,
																		extraText: " Cannot check if a scenario named <b>" + scenarioName + "</b> already exists."
																	});
												});
                                        
		});
		var scenarioAccordion = d.css("display","block").accordion().draggable();
    }
    
    // NEW/POINT EVENT function
    
    $("#enclose-menu li:contains(New) li:contains(Point Event)").click(function () {
    	if (isAnotherCommandInProgress("NEW/POINT EVENT")) return; // If another command is in process, can't continue with this one
    	if (!MYAPP.scenario) {
    		$("<div title='No Scenario Loaded'>Cannot create new event when there is no scenario to insert it into.  Please open or create a scenario.</div>").dialog();
    		return;
    	}
    	
    	// Set up a Google Maps click listener.  The click tells us where the user wants the event to occur.  This closes
		// the dialog widget, puts down a GM marker, and opens an accordion widget with sections for the key information about the event.  No information 
		// is saved until the user clicks the Save button.
		//
		// NOTE that this GM listener is good for ONE click for ONE event at a time.  The user must select File/New/Point Event for every new event s/he
		// wants to create.
		//
		
		var oneTimeListener = google.maps.event.addListenerOnce(MYAPP.map, 'click', function (event) { 
																						d.dialog("close");
			
																						// Initialize all input fields in the accordion widget.
			
																						$("#event_latLng_div").css("display","block");
																						$("#event_icon_div").css("display","block");
																						$("#event_lat").val(event.latLng.lat()); // Display lat and lng based on user's initial placement of the marker
																						$("#event_lng").val(event.latLng.lng());
																						$("#event_style_and_color").css("display","none"); // Don't show the accordion section for line/area style & color
																						$("#event_style").css("display","none");
																						$("#event_icon").val("");
																						$("#event_animation").css("display","none");
																						$("#event_animation_div").css("display","none");
																						initializeEventAccordionForCreation();
																						editEvent("create","Point Event",event.latLng,null);
  																					});
    	
    	var d = $("<div id='choose_event_location' title='Choose Event Location'><ol><li>Drag and zoom the map to view where your event will occur.</li><li>Click on the exact event location, or click <b>Cancel</b> to not create this event.</li></ol></div>");
		d.dialog({
			autoOpen: true,
			show: { duration: 600 },
			hide: { duration: 600 },
			position: "center",
			width: 600,
			close: function() {
									google.maps.event.removeListener(oneTimeListener);  // Don't need that listener hanging around
									commandCompleted();
									d.dialog("close");
							 }, 
			buttons: [
				{ text: "Cancel", click: function() {
												google.maps.event.removeListener(oneTimeListener);  // Don't need that listener hanging around
												commandCompleted();
												d.dialog("close");
										 } 
				}
			]
		});
    });
 
 	// addLatLng is a callback used by the GM click listener to add a new point (latLng) to a path (polyline) or area (polygon). 
 	// "poly" variable is technically a global variable, but it is just used by FILE/CREATE PATH EVENT and FILE/CREATE AREA EVENT 
 	// to communicate with addLatLng.

		var poly; 
		function addLatLng (event) {	
		  var path = poly.getPath();
		  path.push(event.latLng); // Because path is an MVCArray, we can simply append a new coordinate and it will automatically appear.
		  MYAPP.numberOfPointsInThisPolyline++;
		};
    
    // NEW/PATH EVENT function
    
    $("#enclose-menu li:contains(New) li:contains(Path Event)").click(function () {
    	if (isAnotherCommandInProgress("NEW/PATH EVENT")) return; // If another command is in process, can't continue with this one
    	if (!MYAPP.scenario) {
    		$("<div title='No Scenario Loaded'>Cannot create new event when there is no scenario to insert it into.  Please open or create a scenario.</div>").dialog();
    		return;
    	}
    	poly = new google.maps.Polyline({						// poly is a "global" var declared before addLatLng above
									strokeColor: '#000000',
									strokeOpacity: 1.0,
									strokeWeight: 2,
									editable: true
								});
		poly.setMap(MYAPP.map);
		MYAPP.numberOfPointsInThisPolyline = 0;
		var listener = google.maps.event.addListener(MYAPP.map, 'click', addLatLng); // Add a listener for the click event.  addLatLng will add the click location to the path represented by poly.
    	var d = $("<div title='Choose Event Location'><ol><li>Drag and zoom the map to view where your event will occur.</li><li>Click on the sequence of points for this event, or click <b>Cancel</b> to not create this event.  <i>The path will appear after you have clicked the second point.</i></li><li>Click <b>OK</b> to continue creating the event.</ol></div>");
		d.dialog({
			autoOpen: true,
			show: { duration: 600 },
			hide: { duration: 600 },
			position: "center",
			width: 600,
			close: function () {
								commandCompleted();
								if (poly != null) {
									poly.setMap(null);
									MYAPP.numberOfPointsInThisPolyline = 0;
								}
								google.maps.event.removeListener(listener); // Don't need the "add another point to polyline" listener any more
							 },
			buttons: [
				{ text: "Cancel", click: function () {
											commandCompleted();
											if (poly != null) {
												poly.setMap(null);
												MYAPP.numberOfPointsInThisPolyline = 0;
											}
											d.dialog("close");
										 } 
				},
				{ text: "OK", click: function () {
										  if (MYAPP.numberOfPointsInThisPolyline < 2) { // Must have at least 2 points for path or area event. 
										  	$("<div title='Too Few Points'>Must have at least two points to create a path event.</div>").dialog();
										  	d.dialog("close");
										  	commandCompleted();
										  	if (poly != null) {
										  		poly.setPath([]);
										  	}
										  	MYAPP.numberOfPointsInThisPolyline = 0;
										  	google.maps.event.removeListener(listener); // Don't need the "add another point to polyline" listener any more
    										return; 
										  }
										  d.dialog("close");
										  google.maps.event.removeListener(listener); // Don't need the "add another point to polyline" listener any more
										  initializeEventAccordionForCreation();
										  $("#event_latLng_div").css("display","none"); // Don't need event lat and lng fields for a polyline
										  $("#event_icon_div").css("display","none");
										  $("#event_area_div").css("display","none"); // Don't need area event-related fields for a polyline
										  $("#event_style_and_color").css("display","block"); // Show the accordion section for line/area style & color
  										  $("#event_style").css("display","block");
  										  $("#event_line_width option").prop('selected',false).filter(function() {	// Find the option element that is the default line width, and set the selection to be it
																										return $(this).text() == "2"; 
																									  }).prop('selected', true);
										  $("#event_line_opacity option").prop('selected',false).filter(function() {	// Find the option element that is the default line opacity, and set the selection to be it
																										return $(this).text() == "1.0"; 
																									  }).prop('selected', true);
										  $("#event_animation").css("display","block");
										  $("#event_animation_div").css("display","block"); 
										  $("#path_animation_choices_div").css("display","block"); // Show the path animation choices only
										  $("#area_animation_choices_div").css("display","none");
										  $("#event_animation_icon_style option").prop('selected',false).filter(function() {	// Find the option element that is the arrow, and set the selection to be it
																				return $(this).text() == "Arrow (entire path only)"; 
																			  }).prop('selected', true);
										  $("#event_animation_icon").val("");
										  $("#event_animation_path option").prop('selected',false).filter(function() {	// Find the option element that is the entire path (required for Arrow animation), and set the selection to be it
																										  return $(this).text() == "Entire path"; 
																									    }).prop('selected', true);
										  document.getElementById('event_line_color').color.fromString(poly.strokeColor); // Uses jscolor.js library
										  d = setupIconPicker(); // Set up the icon manager for icon selection
										  MYAPP.selectModeProcessingFunction = function (iconTarget) {	// Function to call when an icon is selected
																					$("#event_animation_icon").val($(iconTarget).attr("src")); // ...put the icon's source file in the icon input string area
																					$("#event_animation_icon_style option").prop('selected',false).filter(function() {	// Find the option element that is this icon style, and set the selection to be it
																																							return $(this).text() == "Custom icon"; 
																																						  }).prop('selected', true);
																					d.dialog("close").css("display","none"); // and close the dialog
																				};
										  $("#path_animation_icon_button").button().button("enable").click(function (e) {
																												d.dialog({ autoOpen: true });
																											});
  										  editEvent("create","Path Event",poly,null);
									 }
				}
			]
		});
		
	});
	
	// NEW/AREA EVENT function
    
    $("#enclose-menu li:contains(New) li:contains(Area Event)").click(function () {
    	if (isAnotherCommandInProgress("NEW/AREA EVENT")) return; // If another command is in process, can't continue with this one
    	if (!MYAPP.scenario) {
    		$("<div title='No Scenario Loaded'>Cannot create new event when there is no scenario to insert it into.  Please open or create a scenario.</div>").dialog();
    		return;
    	}
    	var listener;
    	var d = $("<div title='Choose Event Location'><ol><li>Drag and zoom the map to view where your event will occur.</li><li>Click on the sequence of points for this event, or click <b>Cancel</b> to not create this event.  <i>The area will appear after you have clicked OK.</i></li><li>Click <b>OK</b> to continue creating the event.</ol></div>");
		d.dialog({
			autoOpen: true,
			show: { duration: 600 },
			hide: { duration: 600 },
			position: "center",
			width: 600,
			close: function () {
								commandCompleted();
								if (poly != null) {
									poly.setMap(null);
									MYAPP.numberOfPointsInThisPolyline = 0;
								}
								google.maps.event.removeListener(listener); // Don't need the "add another point to polyline" listener any more
							 },
			buttons: [
				{ text: "Cancel", click: function () {
											commandCompleted();
											if (poly != null) {
												poly.setMap(null);
												MYAPP.numberOfPointsInThisPolyline = 0;
											}
											d.dialog("close");
										 } 
				},
				{ text: "OK", click: function () {
										  if (MYAPP.numberOfPointsInThisPolyline < 3) { // Must have at least 3 points for an area event. 
										  	$("<div title='Too Few Points'>Must have at least three points to create an area event.</div>").dialog();
										  	d.dialog("close");
										  	commandCompleted();
										  	if (poly != null) {
										  		poly.setPath([]);
										  	}
										  	MYAPP.numberOfPointsInThisPolyline = 0;
										  	google.maps.event.removeListener(listener); // Don't need the "add another point to polyline" listener any more
    										return; 
										  }
										  d.dialog("close");
										  google.maps.event.removeListener(listener); // Don't need the "add another point to polygon" listener any more
										  initializeEventAccordionForCreation();
										  $("#event_latLng_div").css("display","none"); // Don't need event lat and lng fields for a polygon
										  $("#event_icon_div").css("display","block"); // But do need icon fields 
										  $("#event_icon").val(""); // And set default icon value to blank (means no icon, not placemark)
										  $("#event_animation").css("display","block");  
										  $("#event_animation_div").css("display","block");
										  $("#path_animation_choices_div").css("display","none"); // Show the area animation choices only
										  $("#area_animation_choices_div").css("display","block");
										  buildAreaEventOptions(); // Make an <option> list of  area events and append to the #area_animation_target <select> element
										  $("#area_animation_target option").prop('selected',false).filter(function() {	// Find the option element that is the default target area event (None, i.r., no animation)
																										return $(this).val() == "-1"; 
																									  }).prop('selected', true);
										  $("#area_animation_fill").prop("checked",false);
										  $("#event_area_div").css("display","block"); // Show area event-related fields for a polygon
										  $("#event_style_and_color").css("display","block"); // Show the accordion section for line/area style & color
  										  $("#event_style").css("display","block");
  										  $("#event_line_width option").prop('selected',false).filter(function() {	// Find the option element that is the default line width, and set the selection to be it
																										return $(this).text() == "2"; 
																									  }).prop('selected', true);
										  $("#event_line_opacity option").prop('selected',false).filter(function() {	// Find the option element that is the default line opacity, and set the selection to be it
																										return $(this).text() == "1.0"; 
																									  }).prop('selected', true);
										  $("#event_area_opacity option").prop('selected',false).filter(function() {	// Find the option element that is the default area opacity, and set the selection to be it
																										return $(this).text() == "0.3"; 
																									  }).prop('selected', true);
										  document.getElementById('event_line_color').color.fromString(poly.strokeColor); // Uses jscolor.js library
										  document.getElementById('event_area_color').color.fromString(poly.fillColor); // Uses jscolor.js library
  										  editEvent("create","Area Event",poly,null);
									 }
				}
			]
		});
		
		poly = new google.maps.Polygon({						// poly is a "global" var declared before addLatLng above
									strokeColor: '#000000',
									strokeOpacity: 1.0,
									strokeWeight: 2,
									fillColor: "#147AFF",
									fillOpacity: 0.3,
									editable: true
								});
		poly.setMap(MYAPP.map);
		listener = google.maps.event.addListener(MYAPP.map, 'click', addLatLng); // Add a listener for the click event.  addLatLng will add the click location to the path represented by poly.
	});
	
	// buildAreaEventOptions builds a set of elements <option>area event name</option> for all the area events in this scenario except for the one that 
	// is listed in the input parameter (unless the parameter is undefined, in which case we're creating an area event, not editing one).  It appends all 
	// the area event options to the <select> element with ID #area_animation_target.
	// If we're editing an event, then all the area events in the option list are ones whose start times are strictly after the start time of the 
	// one we're editing.  In the case of events that are being created, we have to check (when the Save button is clicked) that the two event times are 
	// OK.
	//
	// originatingAreaEventID		eventID of source area event (the one that will transform into or move toward the target area event)
	//								undefined if the source event is being created
	
	function buildAreaEventOptions (originatingAreaEventID) {
		var r = null;
		if (originatingAreaEventID == undefined) originatingAreaEventID = "";
		else r = MYAPP.scenario.findEvent(originatingAreaEventID);
		var d = $("#area_animation_target").empty(); // The <select> element to attach the options to, stripped of any previous options
		d.append("<option value='-1'>None</option>");  // Default is none (no target area event, i.e., no animation)
		for (var i=0; i < MYAPP.scenario.scEvents.length; i++) {
			if (MYAPP.scenario.scEvents[i].polygon && (MYAPP.scenario.scEvents[i].eventID != originatingAreaEventID)) {
				if (((r != null) && (r.fixedLocation || // If this is a fixed location, don't try to look at the start time
									(r.event.begin.compareHistoricalDate(MYAPP.scenario.scEvents[i].begin) == "before")))
					|| (r == null)) {
					d.append("<option value='" + MYAPP.scenario.scEvents[i].eventID + "'>" + MYAPP.scenario.scEvents[i].name + "</option>");
				}
			}
		}
	}
	
	// initializeEventAccordionForCreation is called when a point, path, or area event is to be created (NOT edited).  It sets up the common fields in the 
	// event's accordion widget:
	//		1. Title
	//		2. Description 
	//		3. Start Time 
	//		4. End Time
	
	function initializeEventAccordionForCreation () {
		var start;
  		var utcOffset, utcOffsetHours;
		$("#event_title").val("");				// Insure the title is blank (don't pick up the previous title, if there was one)
		$("#event_desc").val("");	// Blank out any previous description
		
		// If the name of the current scenario is different from the one in MYAPP.nameOfScenarioBeingEdited, then we are editing a different
		// scenario and have to blank out the date information that may still be in the #event_start_date <input> field.
		
		if (!(MYAPP.scenario.scName == MYAPP.nameOfScenarioBeingEdited)) {
			$("#event_start_date").val("");
			$("#event_start_time_zone").val("");
			MYAPP.nameOfScenarioBeingEdited = MYAPP.scenario.scName;
		}
		
		// Set up the "Start Time" and "End Time" sections of the accordion widget
		//
		// If this scenario has at least one timeline, use the date of the scenario start time as the default date for the datepicker.  
		// If there are no timelines but there is at least one event, use the start time of the first event (they are stored in date order).
	
		$("input:radio[name=event_timing_option]").prop("checked",false);  // Clear timing option (event vs. location)
		$("#timed_event").prop("checked",true); // Set default to be that we're creating an event, not a fixed location
		var timeZone = MYAPP.scenario.scDefaultTimeZone;
		if (MYAPP.scenario.scTimelines.length > 0) {  // Use start date of scenario, if there is at least one timeline 
			start = MYAPP.scenario.scBegin.GMT;
		}
		else if (MYAPP.scenario.scEvents.length > 0) {	// No timelines, but at least one event, so use start date of earliest event
			start = MYAPP.scenario.scEvents[0].begin.GMT;
		}
		else { // No events and no timelines, so use today's date as default
			start = new Date().getTime();
		}

		utcOffset = timeZone.substr(timeZone.indexOf("(")+4,timeZone.indexOf(")")-(timeZone.indexOf("(")+4)); // Strip off "(UTC" and ")" to get the offset
		var colon = utcOffset.indexOf(":");
		if (colon > 0) { 
			utcOffsetHours = parseInt(utcOffset.substr(0,colon),10) + parseInt(utcOffset.substr(colon+1),10)/60;
			if (utcOffsetHours < 0) utcOffsetHours--; // Adding the minutes turned -4:30 into -3.5 when it should be -4.5
		}
		else utcOffsetHours = parseInt(utcOffset,10);
		var startTimeResult = new ht.GregorianDateFormatter(utcOffsetHours,MYAPP.defaultHistoricalDateFormatGuide,timeZone).formatObject(new ht.HistoricalDate(start,false));
		if (startTimeResult.year < 0) {
			startTimeResult.year = ht.makeBceYear(startTimeResult.year);
			startTimeResult.era = "BCE";
		}
		var start = new Date(startTimeResult.year, startTimeResult.month, startTimeResult.date);
		$("#event_start_time").val(startTimeResult.hours + ":" + startTimeResult.minutes + ":" + startTimeResult.seconds);
		$("input:radio[name=start_era_option]").prop("checked",false);			// Clear previous choices from start and end eras
		$("#start_" + startTimeResult.era).prop("checked",true);
		$("input:radio[name=start_time_of_day_option]").prop("checked",false);	// Clear previous choices from start and end AM/PM
		$("#start_" + startTimeResult.AM_PM).prop("checked",true);
		$("input:radio[name=start_specificity_option]").prop("checked",false);			// Clear previous choices from start and end specificities
		$("#start_exact").prop("checked",true);
		MYAPP.eventOperation = "create";
		$("#event_start_date").datepicker({ onSelect: function (date, picker) {
															if (MYAPP.eventOperation == "create") {
																$("#event_end_date").datepicker("setDate",date);
															}
														}
										}).datepicker("setDate",start);
		clearError($("#event_start_time"));
		$("#event_start_date_div").css("display","block");
		
		$("#event_end_time").val("");			// Clear time input and time error fields.  
		clearError($("#event_end_time"));
		$("#event_end_time").val(startTimeResult.hours + ":" + startTimeResult.minutes + ":" + startTimeResult.seconds);
		$("input:radio[name=end_era_option]").prop("checked",false);			// Clear previous choices from start and end eras
		$("#end_" + startTimeResult.era).prop("checked",true);
		$("input:radio[name=end_time_of_day_option]").prop("checked",false);	// Clear previous choices from start and end AM/PM
		$("#end_" + startTimeResult.AM_PM).prop("checked",true);
		$("input:radio[name=end_specificity_option]").prop("checked",false);			// Clear previous choices from start and end specificities
		$("#end_exact").prop("checked",true);
		$("#event_end_date_div").css("display","block");
		$("#event_end_date").datepicker().datepicker("setDate",start);
	}
	
	// EDIT/EVENT is an alternative way to invoke the editing function on an event or location.  Editing can be invoked by right-clicking on the event or location,
	// but in practice this can be a little clumsy: path events can be specially tricky to right-click on, and in many cases right-clicking will invoke only the 
	// mouse-click listener (since right-click is by definition a mouse-click as well), regardless of the type of event being clicked.  So it makes sense to have 
	// a menu-based way to select the object for editing.
	//
	// EDIT/EVENT builds a selection drop down of all locations and events, enabled or not and visible or not.
	
	$("#enclose-menu li:contains(Edit) li:contains(Event)").click(function () {
		if (isAnotherCommandInProgress("EDIT/EVENT")) return; // If another command is in process, can't continue with this one
		var d = $("<div title='Choose Event To Edit'><select></select><div class='line2 errorMessage'><p></p></div></div>");
		var s = d.children().first(); // the <select> element
		s.append($("<option value='-1'>-- Locations --</option>")); 
		MYAPP.scenario.scLocations.forEach(function(z) {
				s.append($("<option value='" + z.eventID + "'>" + z.name + "</option>")); 
			});
		s.append($("<option value='-1'>-- Events --</option>")); 
		MYAPP.scenario.scEvents.forEach(function(z) {
				s.append($("<option value='" + z.eventID + "'>" + z.name + "</option>")); 
			});
		d.dialog({
				autoOpen: true,
				show: { duration: 600 },
				hide: { duration: 600 },
				position: "center",
				width: 500,
				buttons: [
					{ text: "Cancel", click: function () {
													commandCompleted();
													d.dialog("close");
												}
					},
					{ text: "Edit", click: function () {
													var eventID = s.val();
													if (eventID < 0) {
														setError(s,"needEvent"); // User selected one of the legends ("--Locations--" or "--Events--") instead of a real location/event
														return;
													}
													d.dialog("close");
													var GMobject;
													var eventTypeAndIndex = MYAPP.scenario.findEvent(eventID); // returns object with fixedLocation boolean and integer index
													var spec = eventTypeAndIndex.event;
													if 		(eventTypeAndIndex.type == "Point Event")	GMobject = spec.marker;
													else if (eventTypeAndIndex.type == "Path Event")	GMobject = spec.polyline;
													else if (eventTypeAndIndex.type == "Area Event")	GMobject = spec.GMpolygon;
													GMobject.setVisible(true); // Make it visible even if it isn't its proper time for visibility
													if (eventTypeAndIndex.type == "Point Event") {  // Make point events bounce to call attention to themselves
														spec.marker.setAnimation(google.maps.Animation.BOUNCE);
														spec.timerID = setTimeout(function() { 
															spec.marker.setAnimation(null);
															clearTimeout(spec.timerID); }, MYAPP.maxMsecToBounce);
													}
													
													// Since we may be making an event visible that was previously invisible prior to editing, set up the click and right-click 
													// listeners if they aren't already.
													
													if (spec.GMclickListenerID == null) {
														var tl = $("#slider-box").data("timeline"); // Need the current timeline for the listeners' function bodies
														spec.GMclickListenerID = google.maps.event.addListener(GMobject, 'click', function(event) {
																																		if (!(spec.infoWindow)) {	// Create an infoWindow for this marker and save it
																																				spec.infoWindow = new google.maps.InfoWindow({
																																					content: "<b>" + spec.name + "</b><p><i>Starts: " + new ht.GregorianDateFormatter(tl.utcOffset,$('#current_time').data("format"),tl.timeZone).format(spec.begin) + "</i></p>" +
																																							"<p><i>Ends: " + new ht.GregorianDateFormatter(tl.utcOffset,$('#current_time').data("format"),tl.timeZone).format(spec.end) + "</i></p>" +
																																							"<p>" + spec.description + "</p>"
																																				});
																																			}
																																			if (GMobject == spec.marker) spec.infoWindow.open(GMobject.map,spec.marker);
																																			else {
																																				spec.infoWindow.setPosition(spec.latLng);
																																				spec.infoWindow.open(GMobject.map);
																																			}
																													});
														spec.GMrightClickListenerID = google.maps.event.addListener(GMobject, 'rightclick', function (event) {
																																				setupToEditEvent(spec.eventID,GMobject,true);
																														});
													}
													setupToEditEvent(eventID,GMobject,false); // Continue with setup for editing the event
												}
					}
				]
		});
	});
	
    
    // setupToEditEvent is called to initialize the appropriate fields in the event editing/creation accordion widget. (See the Google Maps listener invoked from
    // the CREATE/POINT EVENT click listener to see how this is done when creating rather than editing an event.)
    //
    // setupToEditEvent takes three parameters:
    //		eventID			ID of the event to edit.
    //		GMobject		GM object that is the subject of the editing
    //		checkForCommand	true if HiM should check if another command is in progress (i.e., function was invoked via right-click listener for that event)
    //						false otherwise (i.e., function is invoked via EDIT/EVENT)
    
    function setupToEditEvent (eventID,GMobject,checkForCommand) {
    	var eventTypeAndIndex = MYAPP.scenario.findEvent(eventID); // returns object with fixedLocation boolean and integer index
    	var fixedLocation = eventTypeAndIndex.fixedLocation;	// is event a fixed location (true) or an event (false)?
    	var index = eventTypeAndIndex.index; // index of event in scLocations or scEvents
    	var event = eventTypeAndIndex.event;	// The HistoricalEvent object corresponding to eventID
    	var eventType = eventTypeAndIndex.type; // Point Event, Path Event, or Area Event
		if (checkForCommand && (isAnotherCommandInProgress("EDIT/" + eventType.toUpperCase()))) return; // If another command is in process, can't continue with this one
    	var timeZone;
    	var utcOffsetHours;
		var utcOffsetMinutes;
    	var utcOffset;
    	var icon;
    	var formatGuide = ($('#current_time').data("format") != undefined) ? $('#current_time').data("format") : MYAPP.defaultHistoricalDateFormatGuide;
    	if (eventType == "Point Event") {
			$("#event_latLng_div").css("display","block");
			$("#event_icon_div").css("display","block");
			$("#event_lat").val(event.lat); 	
			$("#event_lng").val(event.lng);
			$("#event_style_and_color").css("display","none");
			$("#event_style").css("display","none");
			$("#event_animation").css("display","none");
			$("#event_animation_div").css("display","none");
			if (event.marker.getIcon() == undefined) $("#event_icon").val("");
			else $("#event_icon").val(event.marker.getIcon().url);
			var d = setupIconPicker(); // Set up the icon manager for icon selection
			MYAPP.selectModeProcessingFunction = function (iconTarget) {	// Function to call when an icon is selected
																$("#event_icon").val($(iconTarget).attr("src")); // ...put the icon's source file in the icon input string area
																d.dialog("close").css("display","none"); // and close the dialog
															};
			$("#event_icon_button").button().button("enable").click(function (e) {
																		d.dialog({ autoOpen: true });
																		});
		}
		else if ((eventType == "Path Event") || (eventType == "Area Event")) {
			$("#event_latLng_div").css("display","none");
			if (eventType == "Path Event") $("#event_icon_div").css("display","none");
			else {
				$("#event_icon_div").css("display","block"); // Display icon fields for area event 
				if (event.image) $("#event_icon").val(event.image); 
				else $("#event_icon").val("");
				var d = setupIconPicker();  // Set up the icon manager for icon selection
				MYAPP.selectModeProcessingFunction = function (iconTarget) {	// Function to call when an icon is selected
																$("#event_icon").val($(iconTarget).attr("src")); // ...put the icon's source file in the icon input string area
																d.dialog("close").css("display","none"); // and close the dialog
															};
				$("#event_icon_button").button().button("enable").click(function (e) {
																				d.dialog({ autoOpen: true });
																			});
			}
			$("#event_style_and_color").css("display","block");
			$("#event_style").css("display","block");
			$("#event_area_div").css("display","none");
			$("#event_line_width option").prop('selected',false).filter(function() {	// Find the option element that is this line width, and set the selection to be it
																	return $(this).text() == GMobject.strokeWeight.toString(); 
																  }).prop('selected', true);
			var opacity = event.opacity; // Get line opacity out of event, not the GM polyline, because the latter may have been adjusted 
										 // if this is a path event with HiM-managed animation
			if (!opacity) opacity = 1;
			if (opacity == 0.1) opacity = "0.1";
			else if (opacity == 1) opacity = "1.0";
			else opacity = opacity.toString();
			$("#event_line_opacity option").prop('selected',false).filter(function() {	// Find the option element that is this line width, and set the selection to be it
																	return $(this).text() == opacity; 
																  }).prop('selected', true);
			document.getElementById('event_line_color').color.fromString(GMobject.strokeColor); // Uses jscolor.js library
			GMobject.setEditable(true);		// Make the polyline or polygon itself editable
			if (eventType == "Area Event") {
				$("#event_area_div").css("display","block");
				document.getElementById('event_area_color').color.fromString(GMobject.fillColor); // Uses jscolor.js library
				$("#event_area_opacity option").prop('selected',false).filter(function() {	// Find the option element that is this line width, and set the selection to be it
																	return $(this).text() == GMobject.fillOpacity.toString(); 
																  }).prop('selected', true);
			}
			if (eventType == "Path Event") {
				$("#event_animation").css("display","block");
				$("#event_animation_div").css("display","block"); 
				$("#path_animation_choices_div").css("display","block"); // Show the path animation choices only
				$("#area_animation_choices_div").css("display","none");
				$("#event_animation_icon_style option").prop('selected',false).filter(function() {	// Find the option element that is this line width, and set the selection to be it
																				return $(this).text() == event.animationIconStyle; 
																			  }).prop('selected', true);
				$("#event_animation_icon").val(event.animationIcon);
				$("#event_animation_path option").prop('selected',false).filter(function() {	// Find the option element that is this line width, and set the selection to be it
																				return $(this).text() == event.animationPathChoice; 
																			  }).prop('selected', true);
				var d = setupIconPicker();  // Set up the icon manager for icon selection
				MYAPP.selectModeProcessingFunction = function (iconTarget) {	// Function to call when an icon is selected
																	$("#event_animation_icon").val($(iconTarget).attr("src")); // ...put the icon's source file in the icon input string area
																	$("#event_animation_icon_style option").prop('selected',false).filter(function() {	// Find the option element that is this icon style, and set the selection to be it
																																			return $(this).text() == "Custom icon"; 
																																		  }).prop('selected', true);
																	d.dialog("close").css("display","none"); // and close the dialog
																};
				$("#path_animation_icon_button").button().button("enable").click(function (e) {
																					d.dialog({ autoOpen: true });
																				});
			}
			else {
				$("#event_animation").css("display","block");
				$("#event_animation_div").css("display","block"); 
				$("#path_animation_choices_div").css("display","none"); // Show the area animation choices only
				$("#area_animation_choices_div").css("display","block");
				buildAreaEventOptions(eventID); // Make an <option> list of  area events and append to the #area_animation_target <select> element
				$("#area_animation_target option").prop('selected',false).filter(function() {	// Find the option element that is this event's target AE, and set the selection to be it
																				return $(this).val() == event.animationTargetAreaEvent; 
																			  }).prop('selected', true);
				$("#area_animation_fill").prop("checked",event.animationFillPath);
			}
		}
		$("#event_title").val(event.name);				
		$("#event_desc").val(event.description);	
		
		$("input:radio[name=event_timing_option]").prop("checked",false);  // Clear timing option (event vs. location)
		if (fixedLocation) {
			$("#event_start_time").val("");
			$("#event_start_date").datepicker().datepicker("setDate",start);
			$("#event_start_date").val("");
			$("#timeless_location").prop("checked",true); // We are editing an event, not a fixed location
		}
		else {
			timeZone = event.timeZone;
			utcOffset = timeZone.substr(timeZone.indexOf("(")+4,timeZone.indexOf(")")-(timeZone.indexOf("(")+4)); // Strip off "(UTC" and ")" to get the offset
			var colon = utcOffset.indexOf(":");
			if (colon > 0) { 
				utcOffsetHours = parseInt(utcOffset.substr(0,colon),10) + parseInt(utcOffset.substr(colon+1),10)/60;
				if (utcOffsetHours < 0) utcOffsetHours--; // Adding the minutes turned -4:30 into -3.5 when it should be -4.5
			}
			else utcOffsetHours = parseInt(utcOffset,10);
			var startTimeResult = new ht.GregorianDateFormatter(utcOffsetHours,MYAPP.defaultHistoricalDateFormatGuide,timeZone).formatObject(event.begin);
			if (startTimeResult.year < 0) {
				startTimeResult.year = ht.makeBceYear(startTimeResult.year);
				startTimeResult.era = "BCE";
			}
			var start = ht.makeDate(startTimeResult.year, startTimeResult.month, startTimeResult.date);
			$("#event_start_time").val(startTimeResult.hours + ":" + startTimeResult.minutes + ":" + startTimeResult.seconds);
			$("#start_" + startTimeResult.AM_PM).prop("checked",true);
			$("#start_" + startTimeResult.era).prop("checked",true);
			if (event.begin.circa) $("#start_circa").prop("checked",true);
			else  $("#start_exact").prop("checked",true);
			$("#event_start_date").datepicker({ onSelect: function (date, picker) {
															if (MYAPP.eventOperation == "create") {
																$("#event_end_date").datepicker("setDate",date);
															}
														}
										}).datepicker("setDate",start);
			$("#timed_event").prop("checked",true); // We are editing an event, not a fixed location
		}
		$("#event_start_date_div").css("display","block");
		clearError($("#event_start_time"));
		
		if (fixedLocation) {
			$("#event_end_time").val("");
			$("#event_end_date").datepicker().datepicker("setDate",end);
			$("#event_end_date").val("");
		}
		else {
			var endTimeResult = new ht.GregorianDateFormatter(utcOffsetHours,MYAPP.defaultHistoricalDateFormatGuide,timeZone).formatObject(event.end);
			var end = ht.makeDate(endTimeResult.year, endTimeResult.month, endTimeResult.date);
			$("#event_end_time").val(endTimeResult.hours + ":" + endTimeResult.minutes + ":" + endTimeResult.seconds);	
			$("#end_" + endTimeResult.AM_PM).prop("checked",true);
			$("#end_" + endTimeResult.era).prop("checked",true);
			if (event.end.circa) $("#end_circa").prop("checked",true);
			else  $("#end_exact").prop("checked",true);
			$("#event_end_date").datepicker().datepicker("setDate",end);
		}
		clearError($("#event_end_time"));
		$("#event_end_date_div").css("display","block");
								   
		editEvent("edit",eventType, new google.maps.LatLng(event.lat,event.lng),eventID,GMobject);
    }
    
    // editEvent does the actual work of collecting and validating user input to create or edit an event.  It assumes that the input fields for the event-editing
    // accordion widget have been set prior to its being called.  editEvent sets up the button handlers for the Description editing buttons (Bold, Italic,
    // Underline, Image, and Link) plus the Save, Delete, and Cancel buttons for the widget (event) as a whole.  It then opens the event accordion widget.  
    //
    // editEvent takes five parameters:
    //		editOrCreate	"edit" if editing an existing event/location, "create" if creating a new one
    //		eventType		"Point Event", "Path Event", or "Area Event"
    //						(Note that any of these can be a fixed location without time bounds)
    //		GMobject		if eventType == "Point Event", this is the Google Maps LatLng object for a Point Event or Location (need to make a Marker out of it)
    //		eventID			if editOrCreate == "edit", this is the eventID of the existing event to edit or delete
    //						Otherwise this is null
    //		originalGMobject	
    //						if editOrCreate = "edit", this is the GM object (marker, polyline, or polygon) originally created by the user
    //
    // NOTE that the click listeners for the Save, Delete and Cancel buttons are good for ONE click only.  Specifically, the Cancel and Delete button click listeners 
	// are good for one click.  The Save button click listener is good for one "good" edit, i.e., one in which there are no user errors.  The one-shot listener
	// policy is necessary, otherwise there would be one click listener for each button for each time the user created a point event.  In that case, each
	// previously created point would be updated to the latest point -- not what the user wants.  Note that we can't use the ".one()" event management function
	// in jQuery, but have to explicitly unbind ALL listeners when we're ready.  This is because if the user types in erroneous info, s/he may have to click
	// Save again when the correct, or supposedly correct, information has been entered.  All listeners have to be unbound regardless of which  was executed.
	// Suppose the user created 3 events in a row and we only unbound the save button listener.  That means there are 3 cancel button listeners still active,
	// and if the user clicked the Cancel button on the 4th event attempt, all 4 would attempt to execute and delete all 4 events.
	//
	// The way editEvent is structured is as follows:
	//		1. Put down the marker where the user clicked, if this is a Creation event (otherwise it's already there).
	//		2. Initialize input fields in all sections of the accordion widget (i.e., make sure they're blank or otherwise set to current values)
	//		3. Set up listeners for other buttons that appear in parts of the accordion widget:
	//			a. The Bold/Italic/Underline/Image/Link buttons that allow formatting of text and insertion of items in the Description section.  Note that
	//					the B/I/U buttons share a common handler and the Image/Link buttons share a common handler.
	//			b. The input fields and datepicker widget in the start and end time sections.
	//		4. Set up the (one-shot) listeners for the Save, Delete, and Cancel buttons.
	//		5. Finally, open the accordion widget, since we're ready to handle all inputs and events.
    
    function editEvent(editOrCreate,eventType,GMobject,eventID,originalGMobject) {
    	MYAPP.eventOperation = editOrCreate; // used to communicate with the onSelect for the event_start_date input element
    	var eventTitle;	 
    	var externalFileList = []; 	// Array of ExternalFile objects (representing images, videos, etc. on the HiM server) used in this event's description. 
    								// NOTE! This is assembled as the user uploads files when editing the description, but the user can delete the <img> tags 
    								// manually.  So if the externalFileList is used during FILE/SAVE AS, a given file in the list may *not* be found in the 
    								// description text.  This is NOT an error.	
    	var externalFilesAddedThisSession = []; // Array of ExternalFile objects added during this editing session, so we can roll them back if the user cancels the edit
    	var eventOriginalTimeZone = "";
    	var eventOriginalPosition;
    	var AEoriginalMarker; // If this is an area event being edited, AND it has an icon, then save the original GM placemark 
    	var eventAccordion = $("#event_accordion").draggable();
    	var URLorFilename; 	// Acts as a "global" variable wrt the dialog for getting an image's filename or URL or the URL of a link that goes in the event's description
							// See the URLButtonHandler function defined below
		var errorSection1 = false;	// Error(s) in location & title section?
		var errorSection2 = false;	// Error(s) in Start Time section?
		var errorSection3 = false;	// Error(s) in End Time section?
		var errorSection4 = false;	// Error(s) in Animation section?
		var r; // Result of calling findEvent
		clearAllErrors();
		var fixedLocation; // true => timeless location, false => time-bounded event
		
		if (editOrCreate == "edit") {
			r = MYAPP.scenario.findEvent(eventID);
			fixedLocation = (!r.event.has_dates);
			eventTitle = r.event.name;
			eventOriginalTimeZone = r.event.timeZone;
			externalFileList = (r.event.externalFileList != undefined) ? r.event.externalFileList : [];
			if (eventType == "Point Event") {
				eventOriginalPosition = originalGMobject.getPosition();  // Will need this latLng if user cancels the edit
				originalGMobject.setDraggable(true);	// Allow user to drag the marker while editing, then update its position in the event accordion
				google.maps.event.addListener(originalGMobject,"dragend", function (event) {
																					$("#event_lat").val(event.latLng.lat());
																					$("#event_lng").val(event.latLng.lng());
																				});
																		
			}	
			else { // Path or area event-- save its original geometry in case we have to cancel the editing
				eventOriginalPosition = originalGMobject.getPath();
			}
		}
		else {
			if (eventType == "Point Event") {	
				GMobject = new google.maps.Marker({	// Need to create a new marker here in order to bind the click listeners to it later in this function.
												position: GMobject,	// No need to do the same for polyline or polygon; those are already created and passed as GMobject argument
												draggable: true,	// OK to drag it around, but we have to make sure we get its final resting place if/when user clicks Save
												map: MYAPP.map		// Note that for a point event, the GMobject argument is the latLng object originally; we're turning that into a Marker object here
											});	// Allow user to drag the marker while editing, then update its position in the event accordion
				google.maps.event.addListener(GMobject,"dragend", function (event) {
																					$("#event_lat").val(event.latLng.lat());
																					$("#event_lng").val(event.latLng.lng());
																				});
			}
			if ((eventType == "Point Event") || (eventType == "Area Event")) {
				// Since this is a point or area event being created, set up the icon picker
				var d = setupIconPicker();  /// Set up the icon manager for icon selection
				MYAPP.selectModeProcessingFunction = function (iconTarget) {	// Function to call when an icon is selected
																$("#event_icon").val($(iconTarget).attr("src")); // ...put the icon's source file in the icon input string area
																d.dialog("close").css("display","none"); // and close the dialog
															};
				$("#event_icon_button").button().button("enable").click(function (e) {
																				d.dialog({ autoOpen: true });
																			});						
			}
			if (eventType != "Point Event") originalGMobject = GMobject;
		}
    	
		// Set up "Description" section of the accordion widget
  			
		setupDescriptionSection($("#event_description"), $("#event_desc"),"",externalFileList,externalFilesAddedThisSession);

		var timeZoneToInitialize = (editOrCreate == "edit") ? eventOriginalTimeZone : MYAPP.scenario.scDefaultTimeZone;
		$("#event_start_time_zone option").prop('selected',false).filter(function() {	// Find the option element that is this time zone, and set the selection to be it
																	return $(this).text() == timeZoneToInitialize; 
																  }).prop('selected', true);
		if (eventType == "Path Event") {
			$("#event_end_time_zone option").prop('selected',false).filter(function() {	// Find the option element that is this time zone, and set the selection to be it
																	return $(this).text() == timeZoneToInitialize; 
																  }).prop('selected', true);
		}
		else $("#event_end_time_zone").prop("disabled",true); 		// For point or area events, don't let the user change the time zone
		if (editOrCreate == "create") {
			$("input:radio[name=start_specificity_option]").prop("checked",false);
			$("#start_exact").prop("checked",true)
			$("input:radio[name=end_specificity_option]").prop("checked",false);
			$("#end_exact").prop("checked",true)
		}
		
		// Define helper function removeSourceAE to find and remove a source AE from a target AE's list of sourceAE event IDs.  Used in "Delete" and 
		// "Save" processing of area events.
		//		sourceID	eventID of the sourceAE
		//		targetAE	actual target event from which the source is to be removed
		var removeSourceAE = function (sourceID,targetAE) {
			var j=0;
			for (var i=0; i< targetAE.animationSourceAreaEvent.length; i++) {
				if (targetAE.animationSourceAreaEvent[i] == sourceID) {
					var limit = targetAE.animationSourceAreaEvent.length - 1;
					for (var k=j; k < limit ; k++) targetAE.animationSourceAreaEvent[k+1] = targetAE.animationSourceAreaEvent[k];
					targetAE.animationSourceAreaEvent.pop();
					break;
				}
				else j++;
			}
		};
						   
		// Set up Cancel and Save buttons for the entire accordion widget.  Create Delete button as well, but disable it if this is a create operation
		// rather than an edit operation.
	
		if (editOrCreate == "create") { $("#event_delete_button").button().button("disable"); }
		else {
			$("#event_delete_button").button().button("enable").click(function(e) {
				var confirmDialog = $("<div title='Confirm Deletion of " + eventType + "'>Please confirm that you want to delete the " + eventType + " named<b> " + eventTitle + "</b></div>");
				confirmDialog.dialog({
								autoOpen: true,
								show: { duration: 600 },
								hide: { duration: 600 },
								position: "center",
								width: 400,
								buttons: [
									{ text: "Cancel", click: function() {
																commandCompleted();
																confirmDialog.dialog("close").css("display","none");
															 } 
									},
									{ text: "Delete", click: function() {
																commandCompleted();
																confirmDialog.dialog("close").css("display","none");
																if ($("#icon_dialog_box").dialog("isOpen")) $("#icon_dialog_box").dialog("close");  // Make sure Icon Manager widget is closed
																MYAPP.scenario.deleteEvent(eventID);	// Delete the event or location from the scenario
																google.maps.event.clearListeners(originalGMobject,"rightclick"); // No need to keep the listener to edit this deleted event
																originalGMobject.setMap(null); // Get rid of the marker for this event
																if (eventType == "Path Event") {
																	if (r.event.pathSubsegments) r.event.clearPathSubsegments(); // Delete any path subsegments as well as the main event 
																	if ((r.event.animationIconStyle == "Placemark") || (r.event.animationIconStyle == "Custom icon")) {
																		if (r.event.animationIconOnPath) { // Get rid of the icon on the path, if there is one
																			r.event.animationIconOnPath.setMap(null);
																			delete r.event.animationIconOnPath;
																		}
																	}
																}
																else if (eventType == "Area Event") {
																	// If this event is the source event for some animation, delete it from the source list of its target
																	if (r.event.animationTargetAreaEvent >= 0) {
																		removeSourceAE(r.event.eventID,MYAPP.scenario.findEvent(r.event.animationTargetAreaEvent).event);
																	}
																	// If this event is the target event for some animation, change the source's target to None and 
																	// delete all the source's subsegmentation
																	if (r.event.animationSourceAreaEvent) {
																		r.event.animationSourceAreaEvent.forEach(function (sourceID) {
																			var source = MYAPP.scenario.findEvent(sourceID).event;
																			source.animationTargetAreaEvent = -1; // None
																			source.animationFillPath = false;
																			if (source.pathSubsegmentsAsSource) delete source.pathSubsegmentsAsSource;
																			if (source.pathSequenceStoT) 		delete source.pathSequenceStoT;
																			if (source.pathSubsegments)			delete source.pathSubsegments;
																		});
																	}
																	// If this AE has an icon, delete that marker 
																	if (r.event.AEmarker) r.event.AEmarker.setMap(null);
																}
																saveWorkingCopy(false);
																eventAccordion.css("display","none").accordion("destroy"); 
																$(this).unbind(e);	// Unbind this handler, otherwise one copy will be made for every point event the user creates
																$("#event_save_button").unbind("click"); // Also unbind the save button click handler bound to this marker
																$("#event_cancel_button").unbind("click"); // Also unbind the cancel button click handler bound to this marker
																unBindDescriptionListeners("");
																$("#event_icon_button").unbind("click");
																$("#path_animation_icon_button").unbind("click");
																return;
															}
									}
								]
							});
			});
		}
		$("#event_cancel_button").button().click(function(e) { 
												commandCompleted();
												if ($("#icon_dialog_box").dialog("isOpen")) $("#icon_dialog_box").dialog("close");  // Make sure Icon Manager widget is closed
												$("#event_end_time_zone").prop("disabled",false); 			// Reset this: next event might be path or area
												if (editOrCreate == "create") GMobject.setMap(null); // Get rid of the marker the user put down initially
												else { // We're editing the event
													var latLngArray = [];
													switch (eventType) {
														case "Point Event":
															originalGMobject.setPosition(eventOriginalPosition);	// Go back to original marker placement
															break;
														case "Path Event": // Recreate original path
															for (var j=0; j < r.event.path.length; j++) {
																latLngArray[j] = new google.maps.LatLng(r.event.path[j].lat, r.event.path[j].lng);
														    }
															originalGMobject.setPath(latLngArray);
															originalGMobject.setEditable(false);
															break;
														case "Area Event": // Recreate original perimeter
															for (var j=0; j < r.event.polygon.length; j++) {
																latLngArray[j] = new google.maps.LatLng(r.event.polygon[j].lat, r.event.polygon[j].lng);
														    }
															originalGMobject.setPath(latLngArray);
															originalGMobject.setEditable(false);
															break;
													}
												}
												
												var deferredDeleteFileArray = [];  // If the user uploaded any external files in this editing session, delete them from the server.
												for (var i=0; i < externalFilesAddedThisSession.length; i++) {
													deferredDeleteFileArray[i] = $.Deferred();  // No need to sync with the server response, since we don't care what it is
													storage.deleteExternalFile_Async(externalFilesAddedThisSession[i],deferredDeleteFileArray[i]);
													deferredDeleteFileArray[i].fail(function() {	
																						console.log("Server could not delete file " + externalFilesAddedThisSession[i].fileName);
																					});
												}
												eventAccordion.css("display","none").accordion("destroy"); 
												$(this).unbind(e);	// Unbind this handler, otherwise one copy will be made for every point event the user creates
												$("#event_save_button").unbind("click"); // Also unbind the save button click handler bound to this marker
												$("#event_delete_button").unbind("click"); // Also unbind the delete button click handler bound to this marker
												unBindDescriptionListeners("");
												$("#event_icon_button").unbind("click");
												$("#path_animation_icon_button").unbind("click");
												return;
											});
		$("#event_save_button").button().click(function(e) { 
												clearAllErrors();
												if ($("#icon_dialog_box").dialog("isOpen")) $("#icon_dialog_box").dialog("close");  // Make sure Icon Manager widget is closed
												var inputIcon = "";
												if ((eventType == "Point Event") || (eventType == "Location") || (eventType == "Area Event")) {
													inputIcon = $("#event_icon").val();
												}
												var inputTitle = $("#event_title").val().trim();
												var inputDescription = $("#event_desc").val();
												var startDateStr = $("#event_start_date").val();
												var startTimeStr = $("#event_start_time").val();
												var endDateStr = $("#event_end_date").val();
												var endTimeStr = $("#event_end_time").val();
												var timeZone = $("#event_start_time_zone").val();
												var inputEventOrFixedLocation = $("input:radio[name=event_timing_option]:checked").val();
												var begin = {};
											
												// Radio button for "Timed event?" determines if this is an event or fixed (timeless) location.  If radio button indicates the 
												// latter, IGNORE start and end date and time input.
											
												fixedLocation = (inputEventOrFixedLocation == "timeless_location");
												var startAMorPM = $('input:radio[name=start_time_of_day_option]:checked').val(); 
												var startSpecificity = ($('input:radio[name=start_specificity_option]:checked').val() == "circa");
												var startEra = $('input:radio[name=start_era_option]:checked').val();
												var endAMorPM = $('input:radio[name=end_time_of_day_option]:checked').val(); 
												var endSpecificity = ($('input:radio[name=end_specificity_option]:checked').val() == "circa");
												var endEra = $('input:radio[name=end_era_option]:checked').val();
												var animationIcon;
												var animationIconStyle;
												var animationPathChoice;
												var animationFillPath;
												var animationTargetAreaEvent;
												var oldAnimationTargetAreaEvent; // Need to know if we've changed the targetAE
												if (eventType == "Path Event")  {
													animationIconStyle = $("#event_animation_icon_style").val();
													animationIcon = $("#event_animation_icon").val();
													animationPathChoice = $("#event_animation_path").val();
												}
												else if (eventType == "Area Event")  {
													animationTargetAreaEvent = $("#area_animation_target").val();
													animationFillPath = $("#area_animation_fill").is(":checked");
												}
												var startDateAndTimeResult = {};
												var endDateAndTimeResult = {};
												var startHistoricalDate;
												var endHistoricalDate;
												errorSection1 = false;	// Error(s) in location & title section?
												errorSection2 = false;	// Error(s) in Start Time section?
												errorSection3 = false;	// Error(s) in End Time section?
												errorSection4 = false;	// Error(s) in Animation section?
												var dateAndTimeLengths = startDateStr.length + endDateStr.length + startTimeStr.length + endTimeStr.length;
												if (!fixedLocation && (dateAndTimeLengths > 0)) {
													startDateAndTimeResult = ht.checkDateAndTimeInputs($("#event_start_date_input_div"),$("#event_start_time"),startAMorPM,timeZone);
													endDateAndTimeResult = ht.checkDateAndTimeInputs($("#event_end_date_input_div"),$("#event_end_time"),endAMorPM,timeZone);
												}
											
												// If there are any syntactic errors in the user input, flag them and leave the accordion widget up so the user
												// can correct them.  
											
												if (
													   (inputTitle.length == 0)										// Must have a title
													|| (inputTitle.length > 40)										// Too-long title messes up formatting
													|| ((startDateStr.length > 0) && (startTimeStr.length == 0))	// Must have a time, if we have a date
													|| ((endDateStr.length > 0) && (endTimeStr.length == 0))		// Must have a time, if we have a date
													|| ((startDateStr.length == 0) && (startTimeStr.length > 0))	// Can't have hh:mm without a date
													|| ((endDateStr.length == 0) && (endTimeStr.length > 0))		// Can't have hh:mm without a date
													|| ((startDateStr.length == 0) && (endDateStr.length > 0))		// End date but no start date
													|| ((endDateStr.length == 0) && (startDateStr.length > 0))		// Start date but no end date
													|| ((!fixedLocation) && ((startDateAndTimeResult.errCode !== "") || (endDateAndTimeResult.errCode !== ""))) // Event has bad start or end time
													|| ((!fixedLocation) && (dateAndTimeLengths == 0))				// Event must have start and end times
													|| ((eventType == "Path Event") && 								// Animated path arrow must be over the entire path
															((animationIconStyle == "Arrow (entire path only)") && (animationPathChoice != "Entire path")))
													|| ((eventType == "Path Event") && 								// Can't specify custom icon animation choice and no icon
															((animationIconStyle == "Custom icon") && (animationIcon == "")))	
													|| ((eventType == "Path Event") && 								// Can't specify custom icon animation choice and no icon
															((animationIconStyle != "Custom icon") && (animationIcon != ""))) // Contradictory or ambiguous -- do you want the custom icon or not?
													|| ((eventType == "Area Event") && (animationTargetAreaEvent >= 0) && (startDateAndTimeResult.errCode == "") && // Animated polygon must not have start date of the target area event before that of the source
															(new ht.HistoricalDate(startDateAndTimeResult.GMT,false).compareHistoricalDate(MYAPP.scenario.findEvent(animationTargetAreaEvent).event.begin) != "before"))
													|| ((inputIcon != "") && (inputIcon.substr(0,4) != "http"))		// Icon must be a URL, not a local filename 
													|| ((eventType == "Path Event") && (animationIcon != "") && (animationIcon.substr(0,4) != "http"))		// Icon must be a URL, not a local filename 
												   ) {
													if (inputTitle.length == 0)									 { setError($("#event_title"),"noBlank"); errorSection1 = true; }
													if (inputTitle.length > 40)									 { setError($("#event_title"),"tooLongScen"); errorSection1 = true; }
													if ((startDateStr.length > 0) && (startTimeStr.length == 0)) { setError($("#event_start_time"),"needTime"); errorSection2 = true; }
													if ((endDateStr.length > 0) && (endTimeStr.length == 0)) 	 { setError($("#event_end_time"),"needTime"); errorSection3 = true; }
													if ((startDateStr.length == 0) && (startTimeStr.length > 0)) { setError($("#event_start_date_input_div"),"needDate"); errorSection2 = true; }
													if ((endDateStr.length == 0) && (endTimeStr.length > 0)) 	 { setError($("#event_end_date_input_div"),"needDate"); errorSection3 = true; }
													if ((startDateStr.length == 0) && (endDateStr.length > 0))	 { setError($("#event_start_time"),"needStart"); errorSection2 = true; }
													if ((endDateStr.length == 0) && (startDateStr.length > 0))	 { setError($("#event_end_time"),"needEnd"); errorSection3 = true; }
													if (!fixedLocation) {
														 if (dateAndTimeLengths > 0) {
														 	if (startDateAndTimeResult.errCode !== "")	 			 { setError(startDateAndTimeResult.jqObject,startDateAndTimeResult.errCode); errorSection2 = true; }
														 	if (endDateAndTimeResult.errCode !== "")	 			 { setError(endDateAndTimeResult.jqObject,endDateAndTimeResult.errCode); errorSection3 = true; }
														 }
														 else														 { setError($("#event_start_time"),"needTime"); setError($("#event_start_date_input_div"),"needDate"); errorSection2 = true;
														 														 	   setError($("#event_end_time"),"needTime");   setError($("#event_end_date_input_div"),"needDate");   errorSection3 = true;
														 															 }
													}	
													if ((eventType == "Path Event") && 								// Animated path arrow must be over the entire path
															   ((animationIconStyle == "Arrow (entire path only)") 
															&&  (animationPathChoice != "Entire path")))		 { setError($("#event_animation_icon_style_div"),"iconPathMismatch"); errorSection4 = true; }
													if ((eventType == "Path Event") && 							// Can't specify custom icon animation choice and no icon
															((animationIconStyle == "Custom icon") && (animationIcon == ""))) { setError($("#event_animation_icon_style_div"),"noIcon"); errorSection4 = true; }
													if ((eventType == "Path Event") && 							 // Contradictory or ambiguous -- do you want the custom icon or not?
															((animationIconStyle != "Custom icon") && (animationIcon != ""))) { setError($("#event_animation_icon_style_div"),"whichIsIt"); errorSection4 = true; }
													if ((eventType == "Area Event") && (animationTargetAreaEvent >= 0) && (startDateAndTimeResult.errCode == "") && 
															(new ht.HistoricalDate(startDateAndTimeResult.GMT,false).compareHistoricalDate(MYAPP.scenario.findEvent(animationTargetAreaEvent).event.begin) != "before"))
																												 { setError($("#area_animation_target_div"),"targetTime"); errorSection4 = true; }
													if ((inputIcon != "") && (inputIcon.substr(0,4) != "http"))	{ setError($("#event_icon"),"notURL"); errorSection1 = true; }
													if ((eventType == "Path Event") && (animationIcon != "") && (animationIcon.substr(0,4) != "http"))	{ setError($("#event_animation_icon"),"notURL"); errorSection4 = true; }
													var errorDialog = $("<div id='error_dialog' title='Some Inputs Have Errors'><p>The following section(s) has (have) errors.  Click on the section to see the error.<ul></ul></div>");
													if (errorSection1) errorDialog.children().last().append($("<li>Location & Title</li>"));
													if (errorSection2) errorDialog.children().last().append($("<li>Start Time</li>"));
													if (errorSection3) errorDialog.children().last().append($("<li>End Time</li>"));
													if (errorSection4) errorDialog.children().last().append($("<li>Animation</li>"));
													errorDialog.dialog({
																	autoOpen: true,
																	show: { duration: 600 },
																	hide: { duration: 600 },
																	position: "center",
																	width: 400,
																	buttons: [
																		{ text: "OK", click: function() {
																										errorDialog.dialog("close");
																								 } 
																		}
																	]
																});
													return; // User can correct errors and Save or Cancel								 
												}
											
												// User input is syntactically correct, so create HistoricalDates (if this isn't a timeless fixed location)
												// and check the semantics, i.e., make sure that the start is neither later than nor concurrent with the end.
											
												if (!fixedLocation) {
													if (startEra == "BCE") {									// If a date is BCE, replace the year
														var s = new Date(startDateAndTimeResult.GMT);			// with the BCE-equivalent year
														s.setUTCFullYear(ht.makeBceYear(s.getUTCFullYear()));
														startDateAndTimeResult.GMT = s.getTime();				// And convert back to milliseconds
													}
													if (endEra == "BCE") {
														var e = new Date(endDateAndTimeResult.GMT);
														e.setUTCFullYear(ht.makeBceYear(e.getUTCFullYear()));
														endDateAndTimeResult.GMT = e.getTime();
													}
													startHistoricalDate = new ht.HistoricalDate(startDateAndTimeResult.GMT,startSpecificity);
													endHistoricalDate = new ht.HistoricalDate(endDateAndTimeResult.GMT,endSpecificity);
													if (startHistoricalDate.compareHistoricalDate(endHistoricalDate,MYAPP.dateTolerance) !== "before") {
														setError($("#event_start_time"),"notBefore"); // Start time is concurrent with or later than the end time
														var errorDialog = $("<div id='error_dialog' title='Some Inputs Have Errors'><p>The Start Time section has an error.  Click on it to see the error.</div>");
														errorDialog.dialog({
																	autoOpen: true,
																	show: { duration: 600 },
																	hide: { duration: 600 },
																	position: "center",
																	width: 400,
																	buttons: [
																		{ text: "OK", click: function() {
																										errorDialog.dialog("close");
																								 } 
																		}
																	]
																});
														return;
													}
												}
												clearAllErrors();
												
												// Get event type-specific parameters
												var options = { // Build the "options" object that will describe this historical event, and make a HistoricalEvent out of it.
														name: inputTitle,
														description: inputDescription,
														has_dates: !fixedLocation,
														externalFileList: externalFileList
													};
												if (!fixedLocation) {
													options.begin = { GMT: startDateAndTimeResult.GMT, circa: startSpecificity };
													options.end =   { GMT: endDateAndTimeResult.GMT, circa: endSpecificity  };
													options.timeZone = timeZone;
												}
												if (eventType == "Point Event") {
													var inputLatLng;
													if (editOrCreate == "edit")  {
														inputLatLng = originalGMobject.getPosition(); // Marker may have been dragged
														originalGMobject.setDraggable(false);
														originalGMobject.setMap(null);				// Get rid of initial marker placement
													}
													else  {         
														inputLatLng = GMobject.getPosition(); // Marker may have been dragged
														GMobject.setDraggable(false);           
														GMobject.setMap(null);
													}
													options.lat = inputLatLng.lat();
													options.lng = inputLatLng.lng();
													if (inputIcon != "") options.image = inputIcon;
												}
												else if ((eventType == "Path Event") || (eventType == "Area Event")) {
													options.color = "#" + $("#event_line_color").val(); 
													options.weight = $("#event_line_width").val();
													options.opacity = $("#event_line_opacity").val();
													var path;
													if (editOrCreate == "create") path = GMobject.getPath(); // User may have moved the points on the polyline, so get current values
													else path = originalGMobject.getPath();
													var convertedMVCarray = [];
													// Must convert GM MVC array of LatLng objects returned by getPath() to a Javascript array of {lat: X, lng: Y} elements
													path.forEach(function (elem, index) {
																	convertedMVCarray[index] = { lat: elem.lat(), lng: elem.lng() };
													});
													if (editOrCreate == "create") GMobject.setMap(null);
													else { 
														originalGMobject.setMap(null); // Get rid of the GMobject originally created to mark the event location
														if (r.event.pathSubsegments) r.event.clearPathSubsegments();
													}
													if (eventType == "Area Event") {
														options.fillColor = "#" + $("#event_area_color").val(); 
														options.fillOpacity = $("#event_area_opacity").val();
														options.polygon = convertedMVCarray;
													}
													else options.path = convertedMVCarray;
													if (eventType == "Path Event") {
														options.animationIconStyle = animationIconStyle;
														if (animationIconStyle == "Custom icon") options.animationIcon = animationIcon;
														else options.animationIcon = "";
														options.animationPathChoice = animationPathChoice;
														if ((editOrCreate == "edit") && (r.event.animationIconOnPath)) { // Get rid of the icon on the path, if there was one
															r.event.animationIconOnPath.setMap(null);
															delete r.event.animationIconOnPath;
														}
													}
													else if (eventType == "Area Event") {
														if (inputIcon != "") options.image = inputIcon;
														options.animationTargetAreaEvent = animationTargetAreaEvent;
														options.animationFillPath = animationFillPath;
														if (editOrCreate == "edit")  {
															oldAnimationTargetAreaEvent = r.event.animationTargetAreaEvent; // Will need to know if we've changed the targetAE
															// Copy over the existing event's list of source events for which it is the target (if any)
															options.animationSourceAreaEvent = r.event.animationSourceAreaEvent;
															// If the AE has an icon, delete the placemark
															if (r.event.AEmarker) r.event.AEmarker.setMap(null);
														}
													}
												}
												
												// Create the new/edited event.  Always delete the old event (if we're editing), and then insert the
												// new/edited event in the scenario.  The deleteEvent and insertEvent functions deal with the event regardless
												// of whether it's a fixed location or a time-bound event, so if in editing the user makes an event out of a location
												// or vice versa, those functions will take care of it.
												
												if (editOrCreate == "edit") options.eventID = eventID;  // Re-use edited event's ID, else create a new one
												var historicalEvent = new ht.HistoricalEvent(options,MYAPP.map);
												if (historicalEvent.AEmarker) historicalEvent.AEmarker.setVisible(true);
												if (externalFilesAddedThisSession.length > 0) updateUser(); // Save user object to server, because the sequence number for the next ExternalFile object has been updated during this edit session
												var tl = $("#slider-box").data("timeline"); // Get the current timeline 
												if ((tl != undefined) && (tl != null)) {	// If one exists, and this event is a path or area event, calculate the number and size 
																							// of increments to make it grow smoothly (so don't do this for a fixedLocation)
													if 		((eventType == "Path Event") && !fixedLocation) historicalEvent.calculateGrowthIncrements(MYAPP.baseInterval,tl.clock.clockRateImplied);
													else if ((eventType == "Area Event") && !fixedLocation) { 
														
														// We must consider this area event from two perspectives: an animation source and an animation target.  It may be either, both, or 
														// neither.  As a source, there are three cases to consider when the source is being edited:
														//		1. The target has changed from "None" to the targetAE (input value in animationTargetAreaEvent)
														//		2. The target has changed from another event to the targetAE 
														//		3. The target has changed from another event to "None"
														//		4. The target hasn't changed (so do nothing)
														// If the new target is another event (cases 1 and 2), push the event we're editing onto the new target's list of sources, and calculate the 
														// series of intermediate polygons.  If the old target wasn't None (case 2), remove the event we're editing from the old target's 
														// list of source events.  If the new target is None, remove this source event from the old target's list of sources, and 
														// delete the event properties that comprise the subsegmentation of the event's geometry with respect to the old target.
														
														var targetAE = historicalEvent.animationTargetAreaEvent; // NOTE: targetAE is actually an eventID, not an actual event!
														if ((editOrCreate == "edit") && (oldAnimationTargetAreaEvent != targetAE)) { // This event's targetAE has changed
															if (targetAE >= 0) { // The new target is not "None"
																// Common code for cases 1 and 2
																r = MYAPP.scenario.findEvent(targetAE); // Find the new target event and add this event as one of its sourceAEs
																if (!r.event.animationSourceAreaEvent) r.event.animationSourceAreaEvent = [];
																r.event.animationSourceAreaEvent.push(historicalEvent.eventID); // Target AE points back to source AE
																historicalEvent.calculateGrowthPolygons(MYAPP.baseInterval,tl.clock.clockRateImplied,r.event,MYAPP.maxAllowableAnimationPolygons);
																// Case 2
																if (oldAnimationTargetAreaEvent >= 0) { // If the old targetAE was not "None", remove this sourceAE from its sources list
																	removeSourceAE(historicalEvent.eventID,MYAPP.scenario.findEvent(oldAnimationTargetAreaEvent).event);
																}
															}
															else {
																// Case 3: This *was* a sourceAE for some target, but the target has been changed to "None."  Remove this AE from the "source" list of 
																// the old targetAE.
																removeSourceAE(historicalEvent.eventID,MYAPP.scenario.findEvent(oldAnimationTargetAreaEvent).event);
																if (historicalEvent.pathSubsegmentsAsSource) 	delete historicalEvent.pathSubsegmentsAsSource;
																if (historicalEvent.pathSequenceStoT) 			delete historicalEvent.pathSequenceStoT;
																if (historicalEvent.pathSubsegments)			delete historicalEvent.pathSubsegments;
															}
														}
														
														// If the source AE is being created, it's being associated with a target for the first time, so no need to check on the source 
														// references of the (nonexistent) old target.  Just establish the links and calculate the polygon sequence.
														
														else if (editOrCreate == "create") {
															if (targetAE >= 0) { // The target is not "None"
																r = MYAPP.scenario.findEvent(targetAE); // Find the new target event and add this event as one of its sourceAEs
																if (!r.event.animationSourceAreaEvent) r.event.animationSourceAreaEvent = [];
																r.event.animationSourceAreaEvent.push(historicalEvent.eventID); // Target AE points back to source AE
																historicalEvent.calculateGrowthPolygons(MYAPP.baseInterval,tl.clock.clockRateImplied,r.event,MYAPP.maxAllowableAnimationPolygons);
															}
														}
														
														// If the event is a target, all we need to do is recompute the subsegmentation for all the sources for which this event is the target.
														
														if (historicalEvent.animationSourceAreaEvent) {
															historicalEvent.animationSourceAreaEvent.forEach(function (source) {
																													MYAPP.scenario.findEvent(source).event.calculateGrowthPolygons(MYAPP.baseInterval,tl.clock.clockRateImplied,historicalEvent,MYAPP.maxAllowableAnimationPolygons);
																												});
														}
													}
												}
												switch (eventType) {
													case "Point Event" :
														historicalEvent.marker.setVisible(true);  // But turn on the marker we just created for it.  (Must do this or the original 
																				   // marker will stay visible regardless of whether the event should be visible at a given time;
														if (historicalEvent.GMclickListenerID == null) {
															google.maps.event.addListener(historicalEvent.marker, 'rightclick', function (event) { // Set up the event's listener for right click so we can edit it.
																								setupToEditEvent(historicalEvent.eventID,historicalEvent.marker,true);  // Need to include GMobject as part of the closure; just creating a new marker with the event's lat/lng doesn't work
																							});	
															historicalEvent.GMclickListenerID = google.maps.event.addListener(historicalEvent.marker, 'click', function(event) {
																										var spec = historicalEvent;
																										var formatGuide = ($('#current_time').data("format")) ? $('#current_time').data("format") : MYAPP.defaultHistoricalDateFormatGuide;
																										var GMobject = historicalEvent.marker;
																										if (!(spec.infoWindow)) {	// Create an infoWindow for this marker and save it
																											var content = "<b>" + spec.name + "</b>";
																											if (spec.timeZone) content = content + "<p><i>Starts: " + new ht.GregorianDateFormatter(spec.getUTCOffsetInHours(),formatGuide,spec.timeZone).format(spec.begin) + "</i></p>" +
																														"<p><i>Ends: " + new ht.GregorianDateFormatter(spec.getUTCOffsetInHours(),formatGuide,spec.timeZone).format(spec.end) + "</i></p>";
																											content = content + "<p>" + spec.description + "</p>";
																											spec.infoWindow = new google.maps.InfoWindow({
																												content: content
																											});
																										}
																										if (GMobject == spec.marker) spec.infoWindow.open(GMobject.map,spec.marker);
																										else {
																											spec.infoWindow.setPosition(event.latLng);
																											spec.infoWindow.open(GMobject.map);
																										}
																							});
														}
														break;
													case "Path Event" :
														historicalEvent.polyline.setVisible(true);  // But turn on the marker we just created for it.  (Must do this or the original 
																				   // marker will stay visible regardless of whether the event should be visible at a given time;
														if (historicalEvent.GMclickListenerID == null) {
															google.maps.event.addListener(historicalEvent.polyline, 'rightclick', function (event) { // Set up the event's listener for right click so we can edit it.
																								setupToEditEvent(historicalEvent.eventID,historicalEvent.polyline,true);  // Need to include GMobject as part of the closure; just creating a new marker with the event's lat/lng doesn't work
																							});	
															historicalEvent.GMclickListenerID = google.maps.event.addListener(historicalEvent.polyline, 'click', function(event) {
																										var spec = historicalEvent;
																										var formatGuide = ($('#current_time').data("format")) ? $('#current_time').data("format") : MYAPP.defaultHistoricalDateFormatGuide;
																										var GMobject = historicalEvent.polyline;
																										if (!(spec.infoWindow)) {	// Create an infoWindow for this marker and save it
																											var content = "<b>" + spec.name + "</b>";
																											if (spec.timeZone) content = content + "<p><i>Starts: " + new ht.GregorianDateFormatter(spec.getUTCOffsetInHours(),formatGuide,spec.timeZone).format(spec.begin) + "</i></p>" +
																														"<p><i>Ends: " + new ht.GregorianDateFormatter(spec.getUTCOffsetInHours(),formatGuide,spec.timeZone).format(spec.end) + "</i></p>";
																											content = content + "<p>" + spec.description + "</p>";
																											spec.infoWindow = new google.maps.InfoWindow({
																												content: content
																											});
																										}
																										if (GMobject == spec.marker) spec.infoWindow.open(GMobject.map,spec.marker);
																										else {
																											spec.infoWindow.setPosition(event.latLng);
																											spec.infoWindow.open(GMobject.map);
																										}
																					});
														}
														break;
													case "Area Event":
														historicalEvent.GMpolygon.setVisible(true);  // But turn on the marker we just created for it.  (Must do this or the original 
																				   // marker will stay visible regardless of whether the event should be visible at a given time;
														if (historicalEvent.GMclickListenerID == null) {
															google.maps.event.addListener(historicalEvent.GMpolygon, 'rightclick', function (event) { // Set up the event's listener for right click so we can edit it.
																								setupToEditEvent(historicalEvent.eventID,historicalEvent.GMpolygon,true);  // Need to include GMobject as part of the closure; just creating a new marker with the event's lat/lng doesn't work
																							});	
															historicalEvent.GMclickListenerID = google.maps.event.addListener(historicalEvent.GMpolygon, 'click', function(event) {
																										var spec = historicalEvent;
																										var formatGuide = ($('#current_time').data("format")) ? $('#current_time').data("format") : MYAPP.defaultHistoricalDateFormatGuide;
																										var GMobject = historicalEvent.GMpolygon;
																										if (!(spec.infoWindow)) {	// Create an infoWindow for this marker and save it
																											var content = "<b>" + spec.name + "</b>";
																											if (spec.timeZone) content = content + "<p><i>Starts: " + new ht.GregorianDateFormatter(spec.getUTCOffsetInHours(),formatGuide,spec.timeZone).format(spec.begin) + "</i></p>" +
																														"<p><i>Ends: " + new ht.GregorianDateFormatter(spec.getUTCOffsetInHours(),formatGuide,spec.timeZone).format(spec.end) + "</i></p>";
																											content = content + "<p>" + spec.description + "</p>";
																											spec.infoWindow = new google.maps.InfoWindow({
																												content: content
																											});
																										}
																										if (GMobject == spec.marker) spec.infoWindow.open(GMobject.map,spec.marker);
																										else {
																											spec.infoWindow.setPosition(event.latLng);
																											spec.infoWindow.open(GMobject.map);
																										}
																					});
														}
														break;
												}
												if (editOrCreate == "edit")   MYAPP.scenario.deleteEvent(eventID);		// Delete the original, pre-edit event or location from the scenario
												MYAPP.scenario.insertEvent(historicalEvent);	// Insert either the brand new event or the edited event									
                                                saveWorkingCopy(false);
												$(this).unbind(e);	// Must unbind this handler, otherwise one copy will be made for every event the user creates
												$("#event_cancel_button").unbind("click"); // Also unbind the cancel button click handler bound to this marker
												$("#event_delete_button").unbind("click"); // Also unbind the delete button click handler bound to this marker
												unBindDescriptionListeners("");
												$("#event_icon_button").unbind("click");
												$("#path_animation_icon_button").unbind("click");
												$("#event_end_time_zone").prop("disabled",false); 			// Reset this: next event might be path or area
												eventAccordion.css("display","none").accordion("destroy"); // Must set display:none,otherwise the bare HTML would continue to be displayed
												var operation = (editOrCreate == "create") ? "Created" : "Edited";
												var locOrEvent = fixedLocation ? "Location" : "Event";
												var locOrEventLC = fixedLocation ? "location" : "event";
												var confirmationDialog = $("<div title='" + locOrEvent + " " + operation + "'>" + operation + " " + locOrEventLC + " named <b>" + inputTitle + "</b></div>");
												confirmationDialog.dialog({
																	autoOpen: true,
																	show: { duration: 600 },
																	hide: { duration: 600 },
																	position: "center",
																	width: 400,
																	buttons: [
																		{ text: "OK", click: function() {
																										commandCompleted();
																										confirmationDialog.dialog("close");
																								 } 
																		}
																	]
																});
												return;
											});
										
		// Finished with the setup, so launch the accordion widget
										
		eventAccordion.css("display","block").accordion({ beforeActivate: function (event,ui) { // When creating an event, copy all the start time values into the end time accordion panel.
																				if ((ui.newHeader.text() == "End Time") && (MYAPP.eventOperation == "create")) {
																					$("#event_end_date").val($("#event_start_date").val());
																					$("#event_end_time").val($("#event_start_time").val());
																					$("#end_" + $('input:radio[name=start_time_of_day_option]:checked').val()).prop("checked",true);
																					$("#end_" + $('input:radio[name=start_specificity_option]:checked').val()).prop("checked",true);
																					$("#end_" + $('input:radio[name=start_era_option]:checked').val()).prop("checked",true);
																				}
																			}
														});
    }
    
    // FILE/OPEN function
    
    $("#enclose-menu li:contains(File) li:contains(Open...)").click(function () {
    	if (isAnotherCommandInProgress("FILE/OPEN")) return; // If another command is in process, can't continue with this one
    	MYAPP.caseForOpeningScenario = 1;
    	editScenario("open");
    });
    
    // EDIT/SCENARIO function
    
    $("#enclose-menu li:contains(Edit) li:contains(Scenario)").click(function () {
    	if (isAnotherCommandInProgress("EDIT/SCENARIO")) return; // If another command is in process, can't continue with this one
    	MYAPP.caseForOpeningScenario = 2;
    	editScenario("edit");
    });
    
    function editScenario(editOrOpen) {
    	if (!MYAPP.OKToLoadScenario) return;	// It's not safe yet to load a scenario
    	if ((MYAPP.scenario != undefined) &&(!MYAPP.workingCopyIsSaved)) { // We have a scenario that's been saved locally but not to the server yet
    		var d = $("<div title='Warning'>The last set of changes to scenario <b>" + MYAPP.scenario.scName + "</b> has not been saved to the server.  Would you like to save them?<div>");
    		d.dialog({
				autoOpen: true,
				show: { duration: 600 },
				hide: { duration: 600 },
				position: "center",
				width: 600,
				buttons: [
					{ text: "Save Changes", click: function() {
														var deferredSaveScenario = $.Deferred();
														saveAuthoritativeCopy_Async(false,deferredSaveScenario);
														d.dialog("close");
														deferredSaveScenario.done(function () {
															d.dialog("close");
															d = $("<div title='Scenario Saved To Server'>Scenario <b>" + MYAPP.scenario.scName + "</b> has been saved.</div>");
															d.dialog({
																	autoOpen: true,
																	show: { duration: 600 },
																	hide: { duration: 600 },
																	width: 600,
																	position: "center"
																});
															setTimeout(function () { 
																d.dialog("close"); 
															},3000);
															finishEditingOrOpeningScenario(editOrOpen);
														})
														.fail(function () {
															$("<div title='Scenario Not Saved To Server'>Scenario <b>" + MYAPP.scenario.scName + "</b> could not be saved to the server.  If you continue editing another scenario, the changes to the unsaved scenario will be lost.</div>").dialog({
																	autoOpen: true,
																	show: { duration: 600 },
																	hide: { duration: 600 },
																	width: 600,
																	position: "center"
																});
														});
											 } 
					},
					{ text: "Discard Changes", click: function () {
														MYAPP.workingCopyIsSaved = true;
														d.dialog("close");
														finishEditingOrOpeningScenario(editOrOpen);
											 }
					},
					{ text: "Cancel", click: function () {
														d.dialog("close");
														commandCompleted(editOrOpen);
											 }
					}
				]
    		});
    	}
    	else finishEditingOrOpeningScenario(editOrOpen); // working copy changes have already been saved to server, so it's OK to proceed with editing or opening a new scenario
    }
    	
    function finishEditingOrOpeningScenario(editOrOpen) {
    	var operation = (editOrOpen == "open") ? "Open" : "Edit";
    	var title = "Choose Scenario to " + operation;
    	var d = $("<div title='" + title + "' id='open_scenario'></div>");	// The Open Scenario <div>
    	d.children().remove();
    	var s = $("<select id='select_scenario'></select>");  // Note that if this were included in d, jQuery can't find it as a separate element to edit.
    													// It only works if we create it as a separate <div> element and  append the options to the it, then
    													// append the completed <div> into the <div> that is the target of jQuery's dialog widget.
    	var scenarioName = null; 	// Name of scenario to load
    	var today = new Date();
    	var externalFileList = []; 	// Array of ExternalFile objects (representing images, videos, etc. on the HiM server) used in this event's description. 
    								// NOTE! This is assembled as the user uploads files when editing the description, but the user can delete the <img> tags 
    								// manually.  So if the externalFileList is used during FILE/SAVE AS, a given file in the list may *not* be found in the 
    								// description text.  This is NOT an error.	
    	var externalFilesAddedThisSession = []; // Array of ExternalFile objects added during this editing session, so we can roll them back if the user cancels the edit
    	getScenarioNames_Async().done(function(scenarioNamesArray) { // Create an alphabetized list of this user's scenario names
            for (var i=0; i < scenarioNamesArray.length; i++) {
                s.append($("<option value='" + scenarioNamesArray[i].index + "'>" + scenarioNamesArray[i].name + "</option>")); /* The scenario's name and index in the user's scenario list */
            }
            d.append(s); // Add the filled-out selection element (within the form) to the div that will be used for the dialog
            if (MYAPP.scenario) { // MYAPP.scenario is undefined if user is logging in on a machine which he has never used before 
            					  // In that case, just leave the scenario names in the order in which they were returned by the server
				s.children().prop('selected',false).filter(function() {	// Find the option element that is this scenario, and set the selection to be it
																			return $(this).text() == MYAPP.scenario.scName; 
																		  }).prop('selected', true);
            }
            var buttonArray = [];
            var k = 0;
            if (MYAPP.caseForOpeningScenario == 2) {	// User is allowed to delete a scenario, so include the Delete button
                buttonArray[0] = { text: "Delete", click: function() {
                                                                var x = s.val(); // Get index in user's list of scenario keys of selected scenario to delete
                                                                for (var i=0; i < scenarioNamesArray.length; i++) {
																	if (scenarioNamesArray[i].index == x) {
																		x = i;	// Found the scenario selected by the user
																		break;
																	}
																}
                                                                var confirmDialog = $("<div title='Confirm Deletion of Scenario'>Please confirm that you want to delete the scenario named<b> " 
                                                                                        + scenarioNamesArray[x].name
                                                                                        + "</b></div>");
                                                                confirmDialog.dialog({
                                                                                autoOpen: true,
                                                                                show: { duration: 600 },
                                                                                hide: { duration: 600 },
                                                                                position: "center",
                                                                                width: 400,
                                                                                buttons: [
                                                                                    { text: "Cancel", click: function() {
                                                                                                                commandCompleted();
                                                                                                                confirmDialog.dialog("close").css("display","none");
                                                                                                             } 
                                                                                    },
                                                                                    { text: "Delete", click: function() {
                                                                                                                commandCompleted();
                                                                                                                d.dialog("close");
                                                                                                                confirmDialog.dialog("close").css("display","none");
                                                                                                                $('#scenario_name').text("(no scenario loaded)");
                                                                                                                $('#browser_title').text("History in Motion");
                                                                                                                deleteScenario_Async(scenarioNamesArray[x].name);	// Delete the named scenario
                                                                                                            }
                                                                                    }
                                                                                ]
                                                                            });
                                                            }
                                                        };
                k++;
            }
            if (MYAPP.caseForOpeningScenario != 3) {	// User is allowed to cancel this command, so include the Cancel button
                buttonArray[k] = { text: "Cancel", click: function() {
                                                                if (MYAPP.caseForOpeningScenario == 3) {	// User has no scenarios left to open and so MUST create one
                                                                    tellUserToFinish("open");
                                                                    return;
                                                                }
                                                                commandCompleted();
                                                                d.dialog("close");
                                                         } 
                                };
                k++;
            }
            buttonArray[k] = { text: operation, click: function() { 
                                                    var x = s.val();
                                                    for (var i=0; i < scenarioNamesArray.length; i++) {
                                                    	if (scenarioNamesArray[i].index == x) {
                                                    		x = i;	// Found the scenario selected by the user
                                                    		break;
                                                    	}
                                                    }
                                                    if (MYAPP.caseForOpeningScenario == 3) MYAPP.caseForOpeningScenario = 0; // OK to close dialog regardless of MYAPP.caseForOpeningScenario value
                                                    d.dialog("close");
                                                    
                                                    // Before loading the scenario, clear out all the GM right-click listeners in the map of the current scenario.
                                                    // These listeners cause the right-clicked GM object (location or event) to be edited or deleted.
                                                    
                                                    if (MYAPP.scenario) { // MYAPP.scenario is undefined if user is logging in on a machine which he has never used before 
														MYAPP.scenario.scLocations.forEach(function (spec) {
															google.maps.event.clearListeners(spec,"rightclick"); 
														});
														MYAPP.scenario.scEvents.forEach(function (spec) {
															google.maps.event.clearListeners(spec,"rightclick"); 
														});
                                                    }
                                                    var deferredGetScenario = $.Deferred();
                                                    storage.getScenario_Async(MYAPP.currentLoggedInUser.userName,
                                                                              MYAPP.currentLoggedInUser.password,
                                                                              scenarioNamesArray[x].name,deferredGetScenario);
                                                    deferredGetScenario.done(function(sc) {
                                                    	// If the scenario to edit is NOT the current scenario, AND the scenario to be edited has a historical map,
                                                    	// then checkAndLoadScenario is an asynchronous function (due to an async call to get the historical map).
                                                    	// To cover that case, as well as the cases where the call to checkAndLoadScenario is effectively synchronous,
                                                    	// create and pass a deferred object which is resolved when checkAndLoadScenario finally has finished 
                                                    	// loading the scenario to be edited.  If we don't do this, and assumed synchronous calls all the time, 
                                                    	// we can end up editing the wrong scenario (i.e., the one that was open before loading the one to be edited).
                                                    	//
                                                    	// Note that the deferred object passed to checkAndLoadScenario will always be resolved, never rejected.  If there are 
                                                    	// any failures in checkAndLoadScenario due to problems on the server side, they will be handled within checkAndLoadScenario.
                                                    
                                                    	var deferredScenarioIsLoaded = $.Deferred(); 
                                                        checkAndLoadScenario(sc,true,deferredScenarioIsLoaded);
                                                        deferredScenarioIsLoaded.done(function () {
															MYAPP.historicalMapListIndex = MYAPP.scenario.scHistoricalMapListIndex; // Make sure the indices are synced
															if (editOrOpen == "open") {
																MYAPP.caseForOpeningScenario = 0; // If we got here via case 3, set the case to something other than 3,
																								  // otherwise if New/Scenario is invoked before case 1 or 2, case 3 will 
																								  // still be in effect and user will be forced to finish creating a new scenario
																commandCompleted();
																return; // Done -- the scenario is open
															}
															// Put up an accordion widget to allow the user to edit or delete the scenario.
															// Hide the elements relevant only for scenario creation.
															// Initialize the scenario name, copyright, default era, and default timezone from the scenario values.
															// Remove any previous DOM elements describing the change times and add the current change times.
													
															var scenarioAccordion; // will hold the active accordion
															d = $("#new_scenario_accordion").draggable().css("display","none");
															clearAllErrors();
															$(".create_only").css("display","none");
															$(".edit_only").css("display","block");
															d.children().filter(".change_times").remove();	// Remove any previous change time elements
															$("#scenario").val(MYAPP.scenario.scName);
															$("#copyright").val(MYAPP.scenario.scCopyright);
															$("#default_" + MYAPP.scenario.scDefaultEra + "_creation").prop("checked",true);
															$("#default_time_zone_creation option").filter(function() {	// Find the option element that is this time zone, and set the selection to be it
																return $(this).text() == MYAPP.scenario.scDefaultTimeZone; 
															  }).prop('selected', true);
															$("#sc_start_desc").val(MYAPP.scenario.scStartDesc);
															$("#sc_end_desc").val(MYAPP.scenario.scEndDesc);
															externalFileList = MYAPP.scenario.scExternalFileList;
															MYAPP.soundtrack = {};	// Clear any soundtrack values previously specified during a scenario or timeline creation or editing session
															setupDescriptionSection($("#sc_start_desc_div"), $("#sc_start_desc"),"sc_start_desc_",externalFileList,externalFilesAddedThisSession);
															setupDescriptionSection($("#sc_end_desc_div"), $("#sc_end_desc"),"sc_end_desc_",externalFileList,externalFilesAddedThisSession);
															d.append($("<h3 class='change_times'>Access Times</h3>")); // Add accordion header for access times pane
															var accessTimesDiv = $("<div class='sctext change_times'></div>");
															var s = $("<div class=change_times><br><p>Start time: " + new ht.GregorianDateFormatter(MYAPP.scenario.scUTCOffset,MYAPP.scenario.scFormat,MYAPP.scenario.scDefaultTimeZone).format(MYAPP.scenario.scBegin) + "</p></div>");
															accessTimesDiv.append(s);
															s = $("<div class=change_times><p>End time: " + new ht.GregorianDateFormatter(MYAPP.scenario.scUTCOffset,MYAPP.scenario.scFormat,MYAPP.scenario.scDefaultTimeZone).format(MYAPP.scenario.scEnd) + "</p></div>");
															accessTimesDiv.append(s);
															var changeTime = $("<div class='change_times'><br><p>Created on: " + new Date(MYAPP.scenario.scChangeDates.creationDate).toString() + "</p></div>");
															accessTimesDiv.append(changeTime);
															changeTime = $("<div class='change_times'><p>Last Opened on: " + new Date(MYAPP.scenario.scChangeDates.lastOpenedDate).toString() + "</p></div>");
															accessTimesDiv.append(changeTime);
															changeTime = $("<div class='change_times'><p>Last Edited on: " + new Date(MYAPP.scenario.scChangeDates.lastModifiedDate).toString() + "</p></div>");
															accessTimesDiv.append(changeTime);
															d.append(accessTimesDiv);
															var deferredGetMaps = $.Deferred();
															storage.getMaps_Async(deferredGetMaps);
															deferredGetMaps.done(function(historicalMapList) {
																var oldHistoricalMapListIndex = MYAPP.scenario.scHistoricalMapListIndex; // Before any change to the map selection
																makeHistoricalMapMenu(historicalMapList,$("#historical_map_to_edit"));
																$("#historical_map_to_edit option").filter(function() {	// Find the option element that is this historical map, and set the selection to be it
																	return $(this).val() == MYAPP.scenario.scHistoricalMapListIndex; 
																}).prop('selected', true);
																$("#sc_cancel_button").button().click(function(e) { 
																	commandCompleted();
																	$("#sc_cancel_button").unbind("click");
																	$("#sc_save_button").unbind("click");
																	unBindDescriptionListeners("sc_start_desc_");
																	unBindDescriptionListeners("sc_end_desc_");
																	scenarioAccordion.accordion("destroy").css("display","none");
																	var deferredDeleteFileArray = [];  // If the user uploaded any external files in this editing session, delete them from the server.
																	for (var i=0; i < externalFilesAddedThisSession.length; i++) {
																		deferredDeleteFileArray[i] = $.Deferred();  // No need to sync with the server response, since we don't care what it is
																		storage.deleteExternalFile_Async(externalFilesAddedThisSession[i],deferredDeleteFileArray[i]);
																		deferredDeleteFileArray[i].fail(function() {	
																											console.log("Server could not delete file " + externalFilesAddedThisSession[i].fileName);
																										});
																	}	
																});
																$("#sc_save_button").button().click(function(e) {
																	var scenarioName = $("#scenario").val().trim();
																	if ((scenarioName.indexOf("/") >= 0) || (scenarioName.indexOf("+") >= 0))  {
																		setError($("#scenario_div"),"noSlash");
																		return;
																	}
																	if ((scenarioName == null) || (scenarioName.length == 0)) {
																			setError($("#scenario"),"needScenario");
																			return;
																	}
																	var oldScenarioName = MYAPP.scenario.scName;
																	MYAPP.scenario.scMapCenter = MYAPP.map.getCenter();  // Wherever the user has dragged and zoomed the map is the starting point
																	MYAPP.scenario.scMapZoom = MYAPP.map.getZoom();
																	if (MYAPP.historicalMapListIndex >= 0) { // A historical map was selected
																		var index;
																		for (var i=0; i < historicalMapList.length; i++) {
																			if (historicalMapList[i].mapID == MYAPP.historicalMapListIndex )  {
																				index = i;
																				break;
																			}
																		}
																		switch (historicalMapList[index].manager) {
																			case "GME":
																				if (MYAPP.mapID) {
																					MYAPP.scenario.scMapID = MYAPP.mapID;
																					MYAPP.scenario.scMapLayerKeys = [];
																					for (var i=0; i < MYAPP.mapLayers.length; i++) MYAPP.scenario.scMapLayerKeys[i] = MYAPP.mapLayers[i].getLayerKey();
																				}
																				MYAPP.scenario.scHistoricalMapListIndex = historicalMapList[index].mapID;
																				break;
																			case "MapTiler":
																				MYAPP.scenario.scHistoricalMapListIndex = historicalMapList[index].mapID;
																				break;
																		}
																	}
																	else { // No MYAPP.mapID, so no historical map.  If there was one previously for the scenario, delete it from the scenario.
																		if (MYAPP.scenario.scMapID) delete MYAPP.scenario.scMapID;
																		if (MYAPP.scenario.scMapLayerKeys) delete MYAPP.scenario.scMapLayerKeys;
																		MYAPP.scenario.scHistoricalMapListIndex = -1;
																	}
														
																	// Must distinguish 2 cases:
																	//	1. User did not change scenario name => we do not have to delete the old scenario key and scenario and save the 
																	//		edited scenario scenario under its new name, both as an object in its own right and as a name in the user's
																	//		scenario list
																	//	2. User did change the scenario name, so we have to "rename" it by deleting the old scenario, removing the old
																	//		scenario key from the user's list of scenario keys, and inserting the newly named scenario in that list
																	//		and in the database (localStorage and the server).
														
																	MYAPP.scenario.scChangeDates.lastModifiedDate = new Date();
																	if (MYAPP.scenario.scName == scenarioName) { // User did not rename scenario
																		$("#sc_cancel_button").unbind("click");
																		$("#sc_save_button").unbind("click");
																		unBindDescriptionListeners("sc_start_desc_");
																		unBindDescriptionListeners("sc_end_desc_");
																		scenarioAccordion.accordion("destroy").css("display","none");
																		MYAPP.scenario.scCopyright = $("#copyright").val();
																		MYAPP.scenario.scDefaultEra = $("#default_BCE_creation").prop("checked") ? "BCE" : "CE"; // For some reason, $('input:radio[name=default_era_option_creation]:checked').val(); is not returning correct value 
															
																		// Get the default time zone for the scenario.  If it's different from what we had before AND 
																		// a time is currently displayed, then adjust the time display to the new time zone.
															
																		MYAPP.scenario.scDefaultTimeZone = $("#default_time_zone_creation").val();
																		MYAPP.scenario.scStartDesc = $("#sc_start_desc").val().trim();
																		MYAPP.scenario.scEndDesc = $("#sc_end_desc").val().trim();
																		MYAPP.scenario.scStartSoundtrack = (MYAPP.soundtrack["sc_start_desc_"] != undefined) ? MYAPP.soundtrack["sc_start_desc_"] : MYAPP.scenario.scStartSoundtrack;
																		MYAPP.scenario.scEndSoundtrack   = (MYAPP.soundtrack["sc_end_desc_"] != undefined) ? MYAPP.soundtrack["sc_end_desc_"] : MYAPP.scenario.scEndSoundtrack ;
																		MYAPP.scenario.scExternalFileList = externalFileList;
																		saveWorkingCopy(true);
																		if (externalFilesAddedThisSession.length > 0) updateUser(); // Save user object to server, because the sequence number for the next ExternalFile object has been updated during this edit session
																		commandCompleted();
																		var deferredSaveScenario = $.Deferred();
																		saveAuthoritativeCopy_Async(false,deferredSaveScenario);
																		deferredSaveScenario.done(function () {
																			var d = $("<div title='Scenario Saved To Server'>Scenario <b>" + MYAPP.scenario.scName + "</b> has been saved.</div>");
																			d.dialog({
																					autoOpen: true,
																					show: { duration: 600 },
																					hide: { duration: 600 },
																					width: 600,
																					position: "center"
																				});
																			setTimeout(function () { 
																				d.dialog("close"); 
																			},3000);
																		})
																		.fail(function () {
																			$("<div title='Scenario Not Saved To Server'>Scenario <b>" + MYAPP.scenario.scName + "</b> could not be saved to the server.  If you open another scenario, the changes to the unsaved scenario will be lost.</div>").dialog({
																					autoOpen: true,
																					show: { duration: 600 },
																					hide: { duration: 600 },
																					width: 600,
																					position: "center"
																				});
																		});
																	}
																	else {	// User did change scenario name -- make sure it's not a duplicate
																		getScenarioNames_Async(MYAPP.currentLoggedInUser.userName,
																									   MYAPP.currentLoggedInUser.password)
																			.done(function(scenarioNames) {
																				var foundIndex = -1;
																				for (var i=0; i < scenarioNames.length; i++) {
																					if (scenarioName == scenarioNames[i].name) {
																						foundIndex = i; // Found the current scenario in the list
																					}
																				}
																				if (foundIndex > -1) {	// If we found the scenario in the list, swap it with the old current scenario at index 0
																					setError($("#scenario"),"duplScenario");
																					return;
																				}
																				$("#sc_cancel_button").unbind("click");
																				$("#sc_save_button").unbind("click");
																				unBindDescriptionListeners("sc_start_desc_");
																				unBindDescriptionListeners("sc_end_desc_");
																				scenarioAccordion.accordion("destroy").css("display","none");
																				MYAPP.scenario.scCopyright = $("#copyright").val();
																				MYAPP.scenario.scDefaultEra = $('input:radio[name=default_era_option_creation]:checked').val(); 
																				MYAPP.scenario.scDefaultTimeZone = $("#default_time_zone_creation").val();
																				MYAPP.scenario.scName = scenarioName;
																				MYAPP.scenario.scStartDesc = $("#sc_start_desc").val().trim();
																				MYAPP.scenario.scEndDesc = $("#sc_end_desc").val().trim();
																				MYAPP.scenario.scStartSoundtrack = (MYAPP.soundtrack["sc_start_desc_"] != undefined) ? MYAPP.soundtrack["sc_start_desc_"] : "";
																				MYAPP.scenario.scEndSoundtrack   = (MYAPP.soundtrack["sc_end_desc_"] != undefined) ? MYAPP.soundtrack["sc_end_desc_"] : "";
																				MYAPP.scenario.scExternalFileList = externalFileList;
																				$("#scenario_name").text(scenarioName);
																				$("#browser_title").text(scenarioName);
																				commandCompleted();
																				if (externalFilesAddedThisSession.length > 0) updateUser(); // Save user object to server, because the sequence number for the next ExternalFile object has been updated during this edit session
																				var deferredRenameCurrentScenario = $.Deferred();
																				renameCurrentScenario(oldScenarioName,deferredRenameCurrentScenario);
																				deferredRenameCurrentScenario.done(function () {
																					var d = $("<div title='Scenario Saved To Server'>Scenario renamed <b>" + MYAPP.scenario.scName + "</b> has been saved.</div>");
																					d.dialog({
																							autoOpen: true,
																							show: { duration: 600 },
																							hide: { duration: 600 },
																							width: 600,
																							position: "center"
																						});
																					setTimeout(function () { 
																						d.dialog("close"); 
																					},3000);
																				})
																				.fail(function () {
																					$("<div title='Scenario Not Saved To Server'>Scenario <b>" + oldScenarioName + "</b> could not be renamed and saved to the server.  If you open another scenario, the changes to the unsaved scenario will be lost.</div>").dialog({
																							autoOpen: true,
																							show: { duration: 600 },
																							hide: { duration: 600 },
																							width: 600,
																							position: "center"
																						});
																				});
																			})
																			.fail(function () {	d.dialog("close");
																								commandCompleted();
																								serverUnavailable({	op: "GetScenarioList",
																													clear: false
																												});
																			});
																	}
																						
																});
																scenarioAccordion = d.css("display","block").accordion();	
															})
															.fail(function () {
																commandCompleted();
																$("<div title='Server Unavailable'>Unable to get list of historical maps from server.</div>").dialog();
															});			
														});
													})
												   .fail(function () { 	commandCompleted();
																		serverUnavailable({	op: "GetScenario",
																							clear: true,
																							name: scenarioNamesArray[x].name });
													});
												 }
                    };
            d.dialog({
                autoOpen: true,
                show: { duration: 600 },
                hide: { duration: 600 },
                position: "center",
                width: 500,
                beforeClose: function (event, ui) {
								if (MYAPP.caseForOpeningScenario == 3) {	// User MUST open a scenario 
									tellUserToFinish("create");
									return false;
								}
								else return true;
							 },
                buttons: buttonArray
            });
        })
        	.fail(function () {	commandCompleted();
								serverUnavailable({	op: "GetScenarioList",
													clear: false
												});
			});
    }
    
    // FILE/IMPORT function 
    // Import a scenario for a given user.  Basically, accept scenario as a JSON string and store it.
    
    $("#enclose-menu li:contains(File) li:contains(Import...)").click(function () {
     	if (isAnotherCommandInProgress("FILE/IMPORT")) return; // If another command is in process, can't continue with this one
     	if ((MYAPP.scenario != undefined) &&(!MYAPP.workingCopyIsSaved)) { // We have a scenario that's been saved locally but not to the server yet
    		var d = $("<div title='Warning'>The last set of changes to scenario <b>" + MYAPP.scenario.scName + "</b> has not been saved to the server.  Would you like to save them?<div>");
    		d.dialog({
				autoOpen: true,
				show: { duration: 600 },
				hide: { duration: 600 },
				position: "center",
				width: 600,
				buttons: [
					{ text: "Save Changes", click: function() {
														saveAuthoritativeCopy_Async();
														d.dialog("close");
														d = $("<div title='Scenario Saved to Server'>Scenario <b>" + MYAPP.scenario.scName + "</b> has been saved.</div>");
														d.dialog({
																autoOpen: true,
																show: { duration: 600 },
																hide: { duration: 600 },
																position: "center"
															});
														setTimeout(function () { 
															d.dialog("close"); 
														},3000);
														finishImportingScenario();
											 } 
					},
					{ text: "Discard Changes", click: function () {
														MYAPP.workingCopyIsSaved = true;
														d.dialog("close");
														finishImportingScenario();
											 }
					},
					{ text: "Cancel", click: function () {
														d.dialog("close");
														commandCompleted();
											 }
					}
				]
    		});
    	}
    	else finishImportingScenario();
    });
    
    function finishImportingScenario() {
     	var scenarioName = "";
     	var scenarioData = "";
     	var d = $("#scenario_import").css("display","block");
    	$("#import_scenario_name").val("");
    	$("#import_scenario_data").val("");
    	d.dialog({
    			autoOpen: true,
				show: { duration: 600 },
				hide: { duration: 600 },
				position: "center",
				width: 600,
				title: "Import Scenario",
				buttons: [
					{ text: "Cancel", click: function () {
												d.dialog("close");
												commandCompleted();
											}
					},
					{ text: "Save", click: function() { 
												clearAllErrors();
												scenarioName = $("#import_scenario_name").val();
												if ((scenarioName == null) || (scenarioName.length == 0)) {
													setError($("#import_scenario_name"),"needScenario");
													return;
												}
												var foundIndex = -1;
												getScenarioNames_Async(MYAPP.currentLoggedInUser.userName,
																			   MYAPP.currentLoggedInUser.password).done(function(scenarioNames) {
													for (var i=0; i < scenarioNames.length; i++) {
														if (scenarioName == scenarioNames[i].name) {
															foundIndex = i; // Found the current scenario in the list
														}
													}
													if (foundIndex > -1) {	// If we found the scenario in the list, and we can't have two scenarios with the same name
														setError($("#import_scenario_name"),"duplScenario");
														return;
													}
													scenarioData = $("#import_scenario_data").val(); // Should be a JSONified, stringified scenario
													if (scenarioData.length == 0) {
														setError($("#import_scenario_data"),"noScenarioData");
														return;
													}
													
													// Use checkAndLoadScenario to parse the scenario string.  Bracket it with try/catch because the data might be 
													// corrupt.
													
													try {
														checkAndLoadScenario(scenarioData,false);
													}
													catch (err) {
														setError($("#import_scenario_data"),err.message);
														setError($("#import_scenario_data"),"badScenario");
														return;
													}
													MYAPP.scenario.scName = scenarioName; 				// Just in case they don't agree
													$("#scenario_name").text(MYAPP.scenario.scName);	// checkAndLoadScenario set the original scenario name
													$("#browser_title").text(MYAPP.scenario.scName);	
													commandCompleted();
													d.dialog("close");
													saveWorkingCopy(true);
													saveAuthoritativeCopy_Async();
													d = $("<div title='Scenario Saved to Server'>Scenario <b>" + MYAPP.scenario.scName + "</b> has been saved.</div>");
													d.dialog({
															autoOpen: true,
															show: { duration: 600 },
															hide: { duration: 600 },
															position: "center"
														});
													setTimeout(function () { 
														d.dialog("close"); 
													},3000);
											 });
                        }
					}
				]
    		});
     }
     
     // FILE/EXPORT function
     // Export a scenario by putting its JSONified, stringified form into the textarea for subsequent cut and paste by user.
     
    $("#enclose-menu li:contains(File) li:contains(Export)").click(function () {
     	if (isAnotherCommandInProgress("FILE/IMPORT")) return; // If another command is in process, can't continue with this one
     	var d = $("<div></div>");
     	var t = $("<textarea id='export_scenario_data' rows='10' cols='45'></textarea>").val(JSON.stringify(MYAPP.scenario.stringifyScenario()));
    	d.append(t);
    	d.dialog({
    			autoOpen: true,
				show: { duration: 600 },
				hide: { duration: 600 },
				position: "center",
				width: 600,
				title: "Exporting " + MYAPP.scenario.scName,
				close: function () {
								commandCompleted();
							}
			});
    });
     
    
    // FILE/REFRESH function
    //
    // The user invokes this function from the menu to refresh the current scenario.  Any events or timelines that have been edited since this scenario was last 
    // loaded or refreshed now have those edits "take effect" visibly.  That is, events are all displayed at their proper time, so if the current time at the time 
    // of refreshing is not within the edited events' time spans, those events don't show.  Similarly, if the current timeline (if any) has been edited and its 
    // start or end times changed, those new time end points take effect, and the time slider is repositioned based on where the current time fits within the 
    // new time limits of the timeline (which it may not).
    
    $("#enclose-menu li:contains(File) li:contains(Refresh)").click(function () {
    	if (isAnotherCommandInProgress("REFRESH")) return; // If another command is in process, can't continue with this one
    	var tl = $("#slider-box").data("timeline");  // There may not be one
    	var pos;
    	var oldHD;
    	if (tl != undefined) {
    		pos = $("#slider-box").slider("value"); // There may not be a position
    		if (pos != undefined) {
    			pos = pos + $("#slider-box").data("fractionalPosition"); // Get the fractional part of the position iff we are sure there is a position to begin with
    			oldHD = tl.convertPositionToHistoricalDate(pos)
    		}
    	}
    	refreshScenario(tl,oldHD); // Both parameters may be undefined -- that is OK
    	var d = $("<div title='Refreshed the Scenario'><b>" + MYAPP.scenario.scName + "</b> has been refreshed.</div>");
    	d.dialog({
                autoOpen: true,
                show: { duration: 600 },
                hide: { duration: 600 },
                position: "center"
            });
            setTimeout(function () { 
                d.dialog("close"); 
            },3000);
        commandCompleted();
    });
    
    
	// The purpose of refreshScenario is to update the display of events to the current HistoricalDate as given on the slider, within the bounds of the current
	// timeline.  Note that "current HistoricalDate as given on the slider" must be computed using the old time span of the timeline, because that span
	// may have changed if the timeline was edited either implicitly (FSTL) or explicitly (all other TLs).
	//
	// refreshScenario takes two parameters:
	//		tl		The currently selected timeline, if any
	//		oldHD	The HistoricalDate corresponding to the position on the time slider, if there is a position
	// Note that either or both parameters may be undefined; this is discussed next.
	//
	// As an overview of refreshScenario, here are the cases to consider:
	//		1. (tl == undefined).  There are two subcases:
	//			a. FSTL exists, because it was just created via a call to insertEvent.  By definition, oldHD will be undefined in this case.
	//			b. FSTL doesn't exist, because it was just deleted via a call to deleteEvent.  oldHD exists, but the event corresponding to it is now gone.
	//		2. (tl != undefined).  There are four subcases:
	//			a. oldHD is undefined.
	//			b. oldHD is defined, and oldHD < tl.begin (i.e., oldHD is now before the start of the timeline)
	//			c. oldHD is defined, and oldHD > tl.end (i.e., it's after the new end of the timeline)
	//			d. oldHD is defined, and tl.begin <= oldHD <= tl.end (i.e., oldHD is within the new span of the timeline)
	//	For cases 2b - 2d, there are  really two subcases:
	//			Subcase i:	There are no <option> elements in the Select_Timeline <select> element.
	//			Subcase ii:	There is at least one <option> element in the Select_Timeline <select> element.
	//	Subcase (i) can happen when the user creates a scenario and then a series of events, and then does a refresh.  This is the first refresh.  Full Scenario 
	//	was created after the first event was inserted into the scenario, but it is not automatically put into the Select_Timeline element.  Hence invoking the 
	//	click listener on Select_Timeline to force timeline selection will fail.  So in subcase (i), setupScenarioTimelinesAndListeners must be called first with 
	//  parameter false to set up the selection element.
	//
	// The actions HiM takes in these cases is as follows:
	//		Case	Action
	//		 1a		Make FSTL the current TL via $('#Select_Timeline').trigger("change")
	//		 1b		Do the actions in checkAndLoadScenario having to do with initializing timeline selection when there are no timelines
	//		 2a		Do nothing
	//		 2b		Invoke $('#Select_Timeline').trigger("change") to re-initialize the currently selected Timeline
	//		 2c		Same as 2b, but reset the slider position to the max and setTimePosition to that max value
	//		 2d		Same as 2b, but reset the slider position based on the (possibly new) tl duration, and setTimePosition to that new position
	//	As noted above, subcase (i) must be distinguished in 2b - 2d and setupScenarioTimelinesAndListeners must be called first.
	
	function refreshScenario(tl,oldHD) {
		if (tl == undefined) {
			var index = -1;
			for (var i=0; i < MYAPP.scenario.scTimelines.length; i++) {
				if (MYAPP.scenario.scTimelines[i].title == "Full Scenario") { index = i; break; }
			}
			if (index > -1) {	// Case 1a
				setupScenarioTimelinesAndListeners({
												setupTimelineSelectListener: true
				});
			}
			else {	// Case 1b
				setupScenarioTimelinesAndListeners({
												setupTimelineSelectListener: false
				});
			}
			return;
		}
		if (oldHD == undefined) return;  // Case 2a
		if ($("#Select_Timeline").children().length == 0) {		// Subcase i as described above
			setupScenarioTimelinesAndListeners({
												setupTimelineSelectListener: true
				});
		}
		if (oldHD.compareHistoricalDate(tl.begin) == "before") {		// case 2b
			$('#Select_Timeline').trigger("change");
		}
		else if (oldHD.compareHistoricalDate(tl.end) == "after") {	// case 2c
			$('#Select_Timeline').trigger("change", [ "max" ]);
		}
		else {	// case 2d
			$('#Select_Timeline').trigger("change", [ "recalc", oldHD]);
		}
	}
	
	// CREATE/TIMELINE function.  Note that both this and the EDIT/TIMELINE function will stop the currently selected timeline, if it is playing 
	// at the time the functions are called.
    
    $("#enclose-menu li:contains(New) li:contains(Timeline)").click(function () {
    	if (isAnotherCommandInProgress("NEW/TIMELINE")) return; // If another command is in process, can't continue with this one
    	if ($("#play_button").data("button-state") == "paused") $("#play_button").trigger("click"); // Stop playing current timeline
    	
		// If the name of the current scenario is different from the one in MYAPP.nameOfScenarioBeingEdited, then we are editing a different
		// scenario and have to blank out the date information that may still be in the #tl_start_date <input> field.
		
		if (!(MYAPP.scenario.scName == MYAPP.nameOfScenarioBeingEdited)) {
			$("#tl_start_date").val("");
			$("#tl_start_time_zone").val("");
			MYAPP.nameOfScenarioBeingEdited = MYAPP.scenario.scName;
		}
		
		editTimeline("create");
    });
    
    // EDIT/TIMELINE function.  Note that both this and the CREATE/TIMELINE function will stop the currently selected timeline, if it is playing 
	// at the time the functions are called.
    
    $("#enclose-menu li:contains(Edit) li:contains(Timeline)").click(function () {
    	if (isAnotherCommandInProgress("EDIT/TIMELINE")) return; // If another command is in process, can't continue with this one
    	if ($("#play_button").data("button-state") == "paused") $("#play_button").trigger("click"); // Stop playing current timeline
    	var tlTitle;
    	var tlID;
    	var currentTLtitle;
    	for (var i=0; i < MYAPP.scenario.scTimelines.length; i++) {	// Get the title of the currently active timeline
    		if ($("#slider-box").data("timelineID") == MYAPP.scenario.scTimelines[i].ID) {
    			currentTLtitle = MYAPP.scenario.scTimelines[i].title;
    			break;
    		}
    	}
    	// Set up the menu of all timelines from which to select one to edit.  
	
		var d = $("<div title='Choose Timeline to Edit' id='open_tl'></div>");	
		var selectHTML = $("<select></select>");
		d.children().remove(); // First get rid of timeline selection options from the previous scenario (if there was one) 
		MYAPP.scenario.scTimelines.forEach(function(tl) {
			var option = $("<option>" + tl.title + "</option>").data("timelineID",tl.ID); /* Associate the timeline's ID with the selection */
			selectHTML.append(option); /* The timeline's title and ID */
		});	
		d.append(selectHTML);
		selectHTML.children().prop('selected',false).filter(function() {	// Find the option element that is the currently active timeline, and set the selection to be it
                                                                        return $(this).text() == currentTLtitle; 
                                                                      }).prop('selected', true);
		d.dialog({
			autoOpen: true,
			show: { duration: 600 },
			hide: { duration: 600 },
			position: "center",
			width: 400,
			buttons: [
				{ text: "Delete", click: function() {
												d.dialog("close");
												selectHTML.children().filter(function (index) {
																							if ($(this).is(":selected")) { 
																								tlID = $(this).data("timelineID");
																								tlTitle = $(this).text();
																							}
																						});
												if (tlTitle == "Full Scenario") {
													$("<div title='May Not Delete Timeline'>You may not delete the<b> Full Scenario</b> timeline.</div>").dialog({
																autoOpen: true,
																show: { duration: 600 },
																hide: { duration: 600 },
																position: "center",
																width: 400
														});
													return;
												}
												var confirmDialog = $("<div title='Confirm Deletion of Timeline'>Please confirm that you want to delete the timeline named<b> " + tlTitle + "</b></div>");
												confirmDialog.dialog({
																autoOpen: true,
																show: { duration: 600 },
																hide: { duration: 600 },
																position: "center",
																width: 400,
																buttons: [
																	{ text: "Cancel", click: function() {
																								confirmDialog.dialog("close").css("display","none");
																							 } 
																	},
																	{ text: "Delete", click: function() {
																								d.dialog("close");
																								confirmDialog.dialog("close").css("display","none");
																								MYAPP.scenario.deleteTimeline(tlID);	// Delete the specified timeline from scenario
																								saveWorkingCopy(false);
																								deleteTimelineFromSelectionElement(tlID); // And from TL selection element at top of Map tab
																								commandCompleted();
																							}
																	}
																]
															});
											}
										},
				{ text: "Cancel", click: function() {
												commandCompleted();
												d.dialog("close");
									  	 } 
				},
				{ text: "Edit", click: function() { 
												selectHTML.children().filter(function (index) {
																				if ($(this).is(":selected")) tlID = $(this).data("timelineID");
																			});
												d.dialog("close");	
												editTimeline("edit",tlID);		
										 }
				}
			]
		});
    });
    
    // editTimeline does the actual work of collecting and validating user input to create or edit a timeline.  It sets up most of the input fields for the TL-editing
    // accordion widget.  editTimeline sets up the button handlers for the Save, Delete, and Cancel buttons for the widget (timeline) as a whole.  It then opens the 
    // timeline accordion widget.  
    //
    // editTimeline takes two parameters:
    //		editOrCreate	"edit" if editing an existing timeline, "create" if creating a new one
    //		tlID			if editOrCreate == "create", this is undefined; else it is the ID of the timeline to edit
    //
    // NOTE that the click listeners for the Save, Delete and Cancel buttons are good for ONE click only.  Specifically, the Cancel and Delete button click listeners 
	// are good for one click.  The Save button click listener is good for one "good" edit, i.e., one in which there are no user errors.  The one-shot listener
	// policy is necessary, otherwise there would be one click listener for each button for each time the user created a timeline.  In that case, each
	// previously created timeline would be updated to the latest timeline -- not what the user wants.  Note that we can't use the ".one()" event management function
	// in jQuery, but have to explicitly unbind ALL listeners when we're ready.  This is because if the user types in erroneous info, s/he may have to click
	// Save again when the correct, or supposedly correct, information has been entered.  All listeners have to be unbound regardless of which  was executed.
	// Suppose the user created 3 timelines in a row and we only unbound the save button listener.  That means there are 3 cancel button listeners still active,
	// and if the user clicked the Cancel button on the 4th timeline attempt, all 4 would attempt to execute and delete all 4 timelines.
	//
	// The way editTimeline is structured is as follows:
	//		1. Initialize input fields in all sections of the accordion widget (i.e., make sure they're blank or otherwise set to current values)
	//		2. Set up the input fields and datepicker widget in the start and end time sections.
	//		3. Set up the (one-shot) listeners for the Save, Delete, and Cancel buttons.
	//		4. Finally, open the accordion widget, since we're ready to handle all inputs and events.
    
    function editTimeline (editOrCreate,tlID) {
    	var tlTitle;	 	
    	var tlOriginalTimeZone = "";
    	var tlAccordion = $("#timeline_accordion").draggable();
    	var tl;
    	var tlIDtoUse = tlID;
    	var begin, end;
    	var utcOffset, utcOffsetHours;
    	var tlStartDesc, tlEndDesc;
    	var externalFileList = []; 	// Array of ExternalFile objects (representing images, videos, etc. on the HiM server) used in this event's description. 
    								// NOTE! This is assembled as the user uploads files when editing the description, but the user can delete the <img> tags 
    								// manually.  So if the externalFileList is used during FILE/SAVE AS, a given file in the list may *not* be found in the 
    								// description text.  This is NOT an error.	
    	var externalFilesAddedThisSession = []; // Array of ExternalFile objects added during this editing session, so we can roll them back if the user cancels the edit
    	
    	clearAllErrors();
    	$("input:radio[name=tl_start_era_option]").prop("checked",false);			// Clear previous choices from start and end eras
    	$("input:radio[name=tl_end_era_option]").prop("checked",false);			// Clear previous choices from start and end eras
    	$("input:radio[name=tl_start_time_of_day_option]").prop("checked",false);			// Clear previous choices from start and end AM/PM
    	$("input:radio[name=tl_end_time_of_day_option]").prop("checked",false);			// Clear previous choices from start and end AM/PM
    			
		if (editOrCreate == "create") {
			tlOriginalTimeZone = MYAPP.scenario.scDefaultTimeZone;
			if (MYAPP.scenario.scTimelines.length > 0) {  // Use start date of scenario, if there is at least one timeline 
				begin = MYAPP.scenario.scBegin;
			}
			else if (MYAPP.scenario.scEvents.length > 0) {	// No timelines, but at least one event, so use start date of earliest event
				begin = MYAPP.scenario.scEvents[0].begin;
			}
			else { // No events and no timelines, so use today's date as default
				begin = new ht.HistoricalDate(new Date().getTime(),false);
			}
			end = begin;
			$("#tl_title").val("");
			$("#tl_enabled").prop("checked",true);
			$("#tl_display_path_event_names").prop("checked",true);
			$("#tl_clock_rate_number_htu").val("");	
			$("#tl_clock_rate_number_wcu").val("");		
			$("#tl_clock_rate_htu option:contains('Second')").prop('selected',true);
			$("#tl_clock_rate_wcu option:contains('Second')").prop('selected',true);
			$("#tl_start_desc").val("");
			$("#tl_end_desc").val("");
			
		}
		else {
			for (var i=0; i < MYAPP.scenario.scTimelines.length; i++) {
				if (tlID == MYAPP.scenario.scTimelines[i].ID) {
					tl = MYAPP.scenario.scTimelines[i];
					MYAPP.timelineBeingEdited = tl;		// Need to communicate this to the soundtrack editing initialization code in setupDescriptionSection
					break;
    			}
			}
			$("#tl_title").val(tl.title);
			$("#tl_enabled").prop("checked",tl.enabled);
			$("#tl_display_path_event_names").prop("checked",tl.displayPathEventNames);
			tlOriginalTimeZone = tl.timeZone;
			begin = tl.begin;
			end = tl.end;
			$("#tl_clock_rate_number_htu").val(tl.clock.clockRateNominal.historicalDeltaTAmount);	
			$("#tl_clock_rate_number_wcu").val(tl.clock.clockRateNominal.wallClockDeltaTAmount);
			$("#tl_clock_rate_htu option").prop('selected',false).filter(function() {	// Find the option element that is this time unit, and set the selection to be it
																return $(this).text().toLowerCase() == tl.clock.clockRateNominal.historicalDeltaTUnit.toLowerCase(); 
															  }).prop('selected', true);
			$("#tl_clock_rate_wcu option").prop('selected',false).filter(function() {	// Find the option element that is this time unit, and set the selection to be it
																	return $(this).text().toLowerCase() == tl.clock.clockRateNominal.wallClockDeltaTUnit.toLowerCase(); 
																  }).prop('selected', true);
			$("#tl_start_desc").val(tl.start_desc);
			$("#tl_end_desc").val(tl.end_desc);
			externalFileList = tl.externalFileList;
		}
		utcOffset = tlOriginalTimeZone.substr(tlOriginalTimeZone.indexOf("(")+4,tlOriginalTimeZone.indexOf(")")-(tlOriginalTimeZone.indexOf("(")+4)); // Strip off "(UTC" and ")" to get the offset
		var colon = utcOffset.indexOf(":");
		if (colon > 0) { 
			utcOffsetHours = parseInt(utcOffset.substr(0,colon),10) + parseInt(utcOffset.substr(colon+1),10)/60;
			if (utcOffsetHours < 0) utcOffsetHours--; // Adding the minutes turned -4:30 into -3.5 when it should be -4.5
		}
		else utcOffsetHours = parseInt(utcOffset,10);
		var startTimeResult = new ht.GregorianDateFormatter(utcOffsetHours,MYAPP.defaultHistoricalDateFormatGuide,tlOriginalTimeZone).formatObject(begin);
		if (startTimeResult.year < 0) {
			startTimeResult.year = ht.makeBceYear(startTimeResult.year);
			startTimeResult.era = "BCE";
		}
		var start = ht.makeDate(startTimeResult.year, startTimeResult.month, startTimeResult.date);
		$("#tl_start_time").val(startTimeResult.hours + ":" + startTimeResult.minutes + ":" + startTimeResult.seconds);
		$("#tl_start_" + startTimeResult.AM_PM).prop("checked",true);
		$("#tl_start_" + startTimeResult.era).prop("checked",true);
		MYAPP.tlOperation = editOrCreate;
		$("#tl_start_date").datepicker({ onSelect: function (date, picker) {
															if (MYAPP.tlOperation == "create") {
																$("#tl_end_date").datepicker("setDate",date);
															}
														}
										}).datepicker("setDate",start);
		$("#tl_start_date_div").css("display","block");
		clearError($("#tl_start_time"));
	
		var endTimeResult = new ht.GregorianDateFormatter(utcOffsetHours,MYAPP.defaultHistoricalDateFormatGuide,tlOriginalTimeZone).formatObject(end);
		var end = ht.makeDate(endTimeResult.year, endTimeResult.month, endTimeResult.date);
		$("#tl_end_date").datepicker().datepicker("setDate",end);
		$("#tl_end_time").val(endTimeResult.hours + ":" + endTimeResult.minutes + ":" + endTimeResult.seconds);	
		$("#tl_end_" + endTimeResult.AM_PM).prop("checked",true);
		$("#tl_end_" + endTimeResult.era).prop("checked",true);
		MYAPP.soundtrack = {};	// Clear any soundtrack values previously specified during a scenario or timeline creation or editing session
		setupDescriptionSection($("#tl_start_desc_div"), $("#tl_start_desc"),"tl_start_desc_",externalFileList,externalFilesAddedThisSession);
        setupDescriptionSection($("#tl_end_desc_div"), $("#tl_end_desc"),"tl_end_desc_",externalFileList,externalFilesAddedThisSession);

		clearError($("#tl_end_time"));
		$("#tl_end_date_div").css("display","block");
		$("#tl_start_time_zone option").prop('selected',false).filter(function() {	// Find the option element that is this time zone, and set the selection to be it
																	return $(this).text() == tlOriginalTimeZone; 
																  }).prop('selected', true);
		
		// Set up Cancel and Save buttons for the entire accordion widget.  Create Delete button as well, but disable it if this is a create operation
		// rather than an edit operation.
	
		if ((editOrCreate == "create") || (tl.title == "Full Scenario")) { $("#tl_delete_button").button().button("disable"); }
		else {
			$("#tl_delete_button").button().button("enable").click(function(e) {
				var confirmDialog = $("<div title='Confirm Deletion of Timeline'>Please confirm that you want to delete the timeline named<b> " + tl.title + "</b></div>");
				confirmDialog.dialog({
								autoOpen: true,
								show: { duration: 600 },
								hide: { duration: 600 },
								position: "center",
								width: 400,
								buttons: [
									{ text: "Cancel", click: function() {
																confirmDialog.dialog("close").css("display","none");
															 } 
									},
									{ text: "Delete", click: function() {
																confirmDialog.dialog("close").css("display","none");
																MYAPP.scenario.deleteTimeline(tlID);	// Delete the timeline from the scenario
																deleteTimelineFromSelectionElement(tlID); // And from TL selection element at top of Map tab
                                                                saveWorkingCopy(false);
																tlAccordion.css("display","none").accordion("destroy"); 
																$(this).unbind(e);	// Unbind this handler, otherwise one copy will be made for every timeline the user creates
																$("#tl_save_button").unbind("click"); // Also unbind the save button click handler bound to this instance of the timeline accordion widget
																$("#tl_cancel_button").unbind("click"); // Also unbind the cancel button click handler bound to this instance of the timeline accordion widget 
																unBindDescriptionListeners("tl_start_desc_");
																unBindDescriptionListeners("tl_end_desc_");
																delete MYAPP.timelineBeingEdited;
																commandCompleted();
																return;
															}
									}
								]
							});
			});
		}
		$("#tl_cancel_button").button().click(function(e) {
												tlAccordion.css("display","none").accordion("destroy"); 
												$(this).unbind(e);	// Unbind this handler, otherwise one copy will be made for every point event the user creates
												$("#tl_save_button").unbind("click"); // Also unbind the save button click handler bound to this marker
												$("#tl_delete_button").unbind("click"); // Also unbind the delete button click handler bound to this marker
												unBindDescriptionListeners("tl_start_desc_");
												unBindDescriptionListeners("tl_end_desc_");
												delete MYAPP.timelineBeingEdited;
												commandCompleted();
												var deferredDeleteFileArray = [];  // If the user uploaded any external files in this editing session, delete them from the server.
												for (var i=0; i < externalFilesAddedThisSession.length; i++) {
													deferredDeleteFileArray[i] = $.Deferred();  // No need to sync with the server response, since we don't care what it is
													storage.deleteExternalFile_Async(externalFilesAddedThisSession[i],deferredDeleteFileArray[i]);
													deferredDeleteFileArray[i].fail(function() {	
																						console.log("Server could not delete file " + externalFilesAddedThisSession[i].fileName);
																					});
												}
												return;
											});
		if ((editOrCreate == "edit") && (tl.title == "Full Scenario")) { $("#tl_save_button").button().button("disable"); } // User may not edit Full Scenario
		else {
			$("#tl_save_button").button().button("enable").click(function(e) { 
												clearAllErrors();
												var inputTitle = $("#tl_title").val();
												var enabled = $("#tl_enabled").is(":checked");
												var displayPathEventNames = $("#tl_display_path_event_names").is(":checked");
												var startDateStr = $("#tl_start_date").val()
												var startTimeStr = $("#tl_start_time").val();
												var endDateStr = $("#tl_end_date").val();
												var endTimeStr = $("#tl_end_time").val();
												var timeZone = $("#tl_start_time_zone").val();
												var begin = {};
												var startAMorPM = $('input:radio[name=tl_start_time_of_day_option]:checked').val(); 
												var startEra = $('input:radio[name=tl_start_era_option]:checked').val();
												var endAMorPM = $('input:radio[name=tl_end_time_of_day_option]:checked').val(); 
												var endEra = $('input:radio[name=tl_end_era_option]:checked').val();
												var startDateAndTimeResult = {};
												var endDateAndTimeResult = {};
												var startHistoricalDate;
												var endHistoricalDate;
												var numberHTUs = $("#tl_clock_rate_number_htu").val();
												var HTU;
												$("#tl_clock_rate_htu option").filter(function () {
																					if ($(this).prop("selected")) HTU = $(this).text();
																				});
												var numberWCUs = $("#tl_clock_rate_number_wcu").val();
												var WCU;
												$("#tl_clock_rate_wcu option").filter(function () {
																					if ($(this).prop("selected")) WCU = $(this).text();
																				});
												var start_desc = $("#tl_start_desc").val().trim();
												var end_desc = $("#tl_end_desc").val().trim();
												var errorSection1 = false;	// Error(s) in Title section?
												var errorSection2 = false;	// Error(s) in Start Time section?
												var errorSection3 = false;	// Error(s) in End Time section?
												var errorSection4 = false;	// Error(s) in Clock Rate section?
												startDateAndTimeResult = ht.checkDateAndTimeInputs($("#tl_start_date_input_div"),$("#tl_start_time"),startAMorPM,timeZone);
												endDateAndTimeResult = ht.checkDateAndTimeInputs($("#tl_end_date_input_div"),$("#tl_end_time"),endAMorPM,timeZone);
												
											
												// If there are any syntactic errors in the user input, flag them and leave the accordion widget up so the user
												// can correct them.  
											
												if (
													   (inputTitle.length == 0)		// Must have a title
													|| (inputTitle.length > 30)		// But it can't be >30 chars or it will mess up the formatting with the time slider
													|| (startTimeStr.length == 0)	// Must have a time
													|| (endTimeStr.length == 0)		// Must have a time
													|| (startDateStr.length == 0) 	// Must have a date
													|| (endDateStr.length == 0) 	// Must have a date
													|| (startDateAndTimeResult.errCode !== "")  // Event has bad start or end time
													|| (endDateAndTimeResult.errCode !== "")
													|| (numberWCUs.length == 0)		// Must specify some number of wall-clock units for the clock rate
													|| ((numberWCUs.length > 0) && isNaN(numberWCUs)) // Non-numeric number of wall-clock...
													|| ((numberHTUs.length > 0) && isNaN(numberHTUs)) //   ...or historical time units
													|| ((numberHTUs.length > 0) && !isNaN(numberHTUs) && (parseInt(numberHTUs) <= 0))
													|| ((numberWCUs.length > 0) && !isNaN(numberWCUs) && (parseInt(numberWCUs) <= 0))
												   ) {
													if (inputTitle.length == 0)								 { setError($("#tl_title"),"noBlank"); errorSection1 = true; }
													if (inputTitle.length > 30)								 { setError($("#tl_title"),"tooLong"); errorSection1 = true; }
													if (startTimeStr.length == 0) 							 { setError($("#tl_start_time"),"needTime"); errorSection2 = true; }
													if (endTimeStr.length == 0) 							 { setError($("#tl_end_time"),"needTime"); errorSection3 = true; }
													if (startDateStr.length == 0)  							 { setError($("#tl_start_time"),"needDate"); errorSection2 = true; }
													if (endDateStr.length == 0)  	 						 { setError($("#tl_end_time"),"needDate"); errorSection3 = true; }
													if (startDateAndTimeResult.errCode !== "")	 			 { setError(startDateAndTimeResult.jqObject,startDateAndTimeResult.errCode); errorSection2 = true; }
													if (endDateAndTimeResult.errCode !== "")	 			 { setError(endDateAndTimeResult.jqObject,endDateAndTimeResult.errCode); errorSection3 = true; }	
													if (numberWCUs.length == 0)								 { setError($("#tl_clock_rate_number_wcu"),"needWCU"); errorSection4 = true; }
													if ((numberWCUs.length > 0) && isNaN(numberWCUs))		 { setError($("#tl_clock_rate_number_wcu"),"badWCU"); errorSection4 = true; }
													if ((numberHTUs.length > 0) && isNaN(numberHTUs))		 { setError($("#tl_clock_rate_number_htu"),"badHTU"); errorSection4 = true; }
													if ((numberHTUs.length > 0) && !isNaN(numberHTUs) && (parseInt(numberHTUs) <= 0)) { setError($("#tl_clock_rate_number_htu"),"nonPosHTU"); errorSection4 = true; }
													if ((numberWCUs.length > 0) && !isNaN(numberWCUs) && (parseInt(numberWCUs) <= 0)) { setError($("#tl_clock_rate_number_wcu"),"nonPosWCU"); errorSection4 = true; }
													var errorDialog = $("<div id='error_dialog' title='Some Inputs Have Errors'><p>The following section(s) has (have) errors.  Click on the section to see the error.<ul></ul></div>");
													if (errorSection1) errorDialog.children().last().append($("<li>Title</li>"));
													if (errorSection2) errorDialog.children().last().append($("<li>Start Time</li>"));
													if (errorSection3) errorDialog.children().last().append($("<li>End Time</li>"));
													if (errorSection4) errorDialog.children().last().append($("<li>Clock Rate</li>"));
													errorDialog.dialog({
																	autoOpen: true,
																	show: { duration: 600 },
																	hide: { duration: 600 },
																	position: "center",
																	width: 400,
																	buttons: [
																		{ text: "OK", click: function() {
																										errorDialog.dialog("close");
																								 } 
																		}
																	]
																});
													return; // User can correct errors and Save or Cancel								 
												}
											
												// User input is syntactically correct, so create HistoricalDates and check the semantics, i.e., make sure
												// that the start is neither later than nor concurrent with the end.
											
												
												if (startEra == "BCE") {									// If a date is BCE, replace the year
													var s = new Date(startDateAndTimeResult.GMT);			// with the BCE-equivalent year
													s.setUTCFullYear(ht.makeBceYear(s.getUTCFullYear()));
													startDateAndTimeResult.GMT = s.getTime();				// And convert back to milliseconds
												}
												if (endEra == "BCE") {
													var e = new Date(endDateAndTimeResult.GMT);
													e.setUTCFullYear(ht.makeBceYear(e.getUTCFullYear()));
													endDateAndTimeResult.GMT = e.getTime();
												}
												startHistoricalDate = new ht.HistoricalDate(startDateAndTimeResult.GMT,false);
												endHistoricalDate = new ht.HistoricalDate(endDateAndTimeResult.GMT,false);
												if (startHistoricalDate.compareHistoricalDate(endHistoricalDate,MYAPP.dateTolerance) !== "before") {
													setError($("#tl_start_time"),"notBefore"); // Start time is concurrent with or later than the end time
													var errorDialog = $("<div id='error_dialog' title='Some Inputs Have Errors'><p>The Start Time section has an error.  Click on it to see the error.</div>");
														errorDialog.dialog({
																	autoOpen: true,
																	show: { duration: 600 },
																	hide: { duration: 600 },
																	position: "center",
																	width: 400,
																	buttons: [
																		{ text: "OK", click: function() {
																										errorDialog.dialog("close");
																								 } 
																		}
																	]
																});
													return;
												}
												if (numberHTUs.length == 0) { // Blank or zero for number of HTUs means use the whole duration of the TL
													numberHTUs = startHistoricalDate.calculateHistoricalDuration(endHistoricalDate)/1000;
													HTU = "second";
												}
												clearAllErrors();
											
												// Create the new/edited timeline. 
												
												if (editOrCreate == "create") {
													tlIDtoUse = -1;
													for (var i=0; i < MYAPP.scenario.scTimelines.length; i++) {
														if (MYAPP.scenario.scTimelines[i].ID > tlIDtoUse) tlIDtoUse = MYAPP.scenario.scTimelines[i].ID;
													}
													tlIDtoUse++;
												}
												var clock = new ht.Clock(new ht.ClockRate(parseInt(numberHTUs), HTU.toLowerCase(), parseInt(numberWCUs), WCU.toLowerCase()));
												var prevStartSoundtrack = (tl != undefined) ? tl.startSoundtrack : "";
												var prevEndSoundtrack =   (tl != undefined) ? tl.endSoundtrack : "";
												var startSoundtrack = (MYAPP.soundtrack["tl_start_desc_"] != undefined) ? MYAPP.soundtrack["tl_start_desc_"] : prevStartSoundtrack;
												var endSoundtrack   = (MYAPP.soundtrack["tl_end_desc_"] != undefined) ? MYAPP.soundtrack["tl_end_desc_"] : prevEndSoundtrack;
												tl = new ht.Timeline(tlIDtoUse, inputTitle, "", enabled, displayPathEventNames, startHistoricalDate, endHistoricalDate, clock, startDateAndTimeResult.utcOffset, timeZone,undefined,start_desc,end_desc,startSoundtrack,endSoundtrack,externalFileList);
												MYAPP.scenario.insertTimeline(tl);	// Insert either the brand new timeline or the edited timeline into the scenario
												insertTimelineIntoSelectionElement(tl); // And into TL selection element at top of Map tab
                                                saveWorkingCopy(false);
												$(this).unbind(e);	// Must unbind this handler, otherwise one copy will be made for every point event the user creates
												$("#tl_cancel_button").unbind("click"); // Also unbind the cancel button click handler bound to this instance of the timeline accordion widget
												$("#tl_delete_button").unbind("click"); // Also unbind the delete button click handler bound to this instance of the timeline accordion widget
												unBindDescriptionListeners("tl_start_desc_");
												unBindDescriptionListeners("tl_end_desc_");
												delete MYAPP.timelineBeingEdited;
												commandCompleted();
												if (externalFilesAddedThisSession.length > 0) updateUser(); // Save user object to server, because the sequence number for the next ExternalFile object has been updated during this edit session
												tlAccordion.css("display","none").accordion("destroy"); // Must set display:none,otherwise the bare HTML would continue to be displayed
												var operation = (editOrCreate == "create") ? "Created" : "Edited";
												var confirmationDialog = $("<div title='Timeline " + operation + "'>" + operation + " timeline named <b>" + inputTitle + "</b></div>");
												confirmationDialog.dialog({
																	autoOpen: true,
																	show: { duration: 600 },
																	hide: { duration: 600 },
																	position: "center",
																	width: 400,
																	buttons: [
																		{ text: "OK", click: function() {
																										confirmationDialog.dialog("close");
																								 } 
																		}
																	]
																});
												return;
											});
		}								
		// Finished with the setup, so launch the accordion widget
										
		tlAccordion.css("display","block").accordion({ beforeActivate: function (event,ui) { // When creating a timeline, copy all the start time values into the end time accordion panel.
																				if ((ui.newHeader.text() == "End Time") && (MYAPP.tlOperation == "create")) {
																					$("#tl_end_date").val($("#tl_start_date").val());
																					$("#tl_end_time").val($("#tl_start_time").val());
																					$("#tl_end_" + $('input:radio[name=tl_start_time_of_day_option]:checked').val()).prop("checked",true);
																					$("#tl_end_" + $('input:radio[name=tl_start_era_option]:checked').val()).prop("checked",true);
																				}
																			}
													});
    }
    
    // deleteTimelineFromSelectionElement is called after a timeline has been successfully deleted from a scenario.  It removes that timeline from the 
    // timeline HTML <select> element at $("#Select_Timeline").  If that happened to be the current selected timeline, another timeline is made the current 
    // timeline; otherwise, the function simply returns.
    //
    // deleteTimelineFromSelectionElement takes the ID of the timeline to delete.
    
    function deleteTimelineFromSelectionElement (tlID) {
    	var selectedOptionIndex;
    	var deletedOptionIndex;
    	var FullScenarioIndex;
    	$('#Select_Timeline option').filter(function (index) {
												var match = ($(this).data("timelineID") == tlID);
												if (match) deletedOptionIndex = index;
												if ($(this).is(":selected")) selectedOptionIndex = index;
												if ($(this).text() == "Full Scenario") FullScenarioIndex = index;
												return match;
											}).remove();
    	if (selectedOptionIndex == deletedOptionIndex) {
    		$('#Select_Timeline option').filter(function (index) { 
													return ($(this).text() == "Full Scenario");
												}).prop("selected",true);
    	}
    	$('#Select_Timeline').trigger("change"); // Always trigger the change event, because it ensures that any changes to the currently or 
    											// newly selected timeline take effect (e.g., calculation of deltaPos, etc.)
    }
    
    // insertTimelineIntoSelectionElement is called after a timeline has been created or edited and inserted into the scenario's array of timelines.
    // If the timeline is newly created (i.e., its ID does not match an existing ID), then it is inserted at the end of the set of <options> for the 
    // <select> element $("#Select_Timeline").  If it has been edited, then there are two cases:
    //		1. Edited timeline is not the currently selected one: In this case, change the <option> element text, if the TL name has changed; rlse just return.
    //		2. Edited timeline is the currently selected one: Trigger the click event on $("#Select_Timeline") to refresh the timeline parameters.
    //		   Also, recalculate the displayed time because the TL's time zone may have changed.
    
    function insertTimelineIntoSelectionElement (tl) {
    	var selectedOptionIndex;
    	var foundOptionIndex = -1;
    	$('#Select_Timeline').children().filter(function (index) {
													var match = ($(this).data("timelineID") == tl.ID);
													if (match) foundOptionIndex = index;
													if ($(this).is(":selected")) selectedOptionIndex = index;
												});
    	if (foundOptionIndex < 0) {	// Add newly created timeline to list of possible TL selections, if the tl is enabled.
    		if (tl.enabled) $('#Select_Timeline').append($("<option>" + tl.title + "</option>").data("timelineID",tl.ID)); /* The timeline's title and ID */
    	}
    	else {
    		$('#Select_Timeline').children().eq(foundOptionIndex).text(tl.title); // Insert (possibly new) title of TL
    		if (selectedOptionIndex == foundOptionIndex) {
    			$('#Select_Timeline').trigger("change");  // Found tl and it was already selected, so force a refresh of its parameters
    			var hd = tl.convertPositionToHistoricalDate($("#slider-box").slider("value") + $("#slider-box").data("fractionalPosition"));
				$('#current_time').text(new ht.GregorianDateFormatter(tl.utcOffset,$('#current_time').data("format"),tl.timeZone).format(hd));
    		}
  		}
    }
    
    // FILE/SAVE and FILE/SAVE AS function.  This causes the current scenario to be written to the server.  Also, the scenario clean/dirty indicator is set to clean, indicating 
    // that the working copy version and the server version are in sync.
    
    $("#enclose-menu li:contains(File) li:contains(Save)").click(function (event) {
    	if (isAnotherCommandInProgress("FILE/SAVE")) return; // If another command is in process, can't continue with this one
    	var d;
    	if ($(event.target).text() == "Save As...") {
    		clearAllErrors();
    		if (MYAPP.permalink < 0) $("#save_as_scenario").val("");
    		else					 $("#save_as_scenario").val(MYAPP.scenario.scName); // If saving a scenario specified by a permalink, use its name as a default
    		d = $("#save_as_scenario_dialog").css("display","block");
    		var scenarioName = null; 	// Name of scenario to create
    		d.dialog({
				autoOpen: true,
				show: { duration: 600 },
				hide: { duration: 600 },
				position: "center",
				width: 550,
				buttons: [
					{ text: "Cancel", click: function() {
													commandCompleted();
													d.dialog("close");
											 } 
					},
					{ text: "Save As", click: function() { 
													scenarioName = $("#save_as_scenario").val();
													if ((scenarioName == null) || (scenarioName.length == 0)) {
														setError($("#save_as_scenario_div"),"needScenario");
														return;
													}
													var foundIndex = -1;
                                                    getScenarioNames_Async(MYAPP.currentLoggedInUser.userName,
                                                                                   MYAPP.currentLoggedInUser.password)
                                                    .done(function(scenarioNames) {
                                                        for (var i=0; i < scenarioNames.length; i++) {
                                                            if (scenarioName == scenarioNames[i]) {
                                                                foundIndex = i; // Found the current scenario in the list
                                                            }
                                                        }
                                                        if (foundIndex > -1) {	// If we found the scenario in the list, and we can't have two scenarios with the same name
                                                            setError($("#save_as_scenario_div"),"duplScenario");
                                                            return;
                                                        }
                                                        MYAPP.scenario.scName = scenarioName; // We know it's unique
                                                        d.dialog("close");
                                                        var mapDefinition = { 	mapCenter: 	MYAPP.map.getCenter(),
                                                        						mapZoom:	MYAPP.map.getZoom()
                                                        					};
                                                        if (MYAPP.scenario.scHistoricalMapListIndex >= 0) { // If there is a historical map, add its parameters to the mapDefinition object
                                                        	var deferredGetMap = $.Deferred();
                                                        	storage.getMap_Async(MYAPP.scenario.scHistoricalMapListIndex,deferredGetMap);
                                                        	deferredGetMap.done(function(map) {
																switch (map.manager) {
																	case "GME":
																		if (MYAPP.mapID) {
																			MYAPP.scenario.scMapID = MYAPP.mapID;
																			MYAPP.scenario.scMapLayerKeys = [];
																			for (var i=0; i < MYAPP.mapLayers.length; i++) MYAPP.scenario.scMapLayerKeys[i] = MYAPP.mapLayers[i].getLayerKey();
																		}
																		MYAPP.scenario.scHistoricalMapListIndex = MYAPP.scenario.scHistoricalMapListIndex;
																		break;
																	case "MapTiler":
																		MYAPP.scenario.scHistoricalMapListIndex = MYAPP.scenario.scHistoricalMapListIndex;
																		break;
																}
															   	masterReplaceExternalFileReferences(false, // No need to change icon references other than those in the SSIL
																									function () {	commandCompleted();
																													serverUnavailable({	op: "CopyFiles",
																																		name: MYAPP.scenario.scName,
																																		clear: false,
																																		extraText: ". Cannot make copies of external files specific to this scenario."
																																		})
																												},			
																									commandCompleted,		
																									function () {   var d = $("<div title='Scenario Saved To Server'>Scenario <b>" + scenarioName + "</b> has been saved.</div>");
																													d.dialog({
																															autoOpen: true,
																															show: { duration: 600 },
																															hide: { duration: 600 },
																															width: 600,
																															position: "center"
																														});
																													setTimeout(function () { 
																														d.dialog("close"); 
																													},3000);
																												},		
																									function () {   $("<div title='Scenario Not Saved To Server'>Scenario <b>" + scenarioName + "</b> could not be saved to the server.  If you open another scenario, the changes to the unsaved scenario will be lost.</div>").dialog({
																															autoOpen: true,
																															show: { duration: 600 },
																															hide: { duration: 600 },
																															width: 600,
																															position: "center"
																													});
																												}
																									);
															})
															.fail(function () {
																commandCompleted(); // No point in replacing file references
																$("<div title='Server Unavailable'>Unable to get the historical map for this scenario from server.</div>").dialog();
															});
                                                        }
                                                        else {
                                                        		masterReplaceExternalFileReferences(false, // No need to change icon references other than those in the SSIL
																									function () {	commandCompleted();
																													serverUnavailable({	op: "CopyFiles",
																																		name: MYAPP.scenario.scName,
																																		clear: false,
																																		extraText: ". Cannot make copies of external files specific to this scenario."
																																		})
																												},			
																									commandCompleted,		
																									function () {   var d = $("<div title='Scenario Saved To Server'>Scenario <b>" + scenarioName + "</b> has been saved.</div>");
																													d.dialog({
																															autoOpen: true,
																															show: { duration: 600 },
																															hide: { duration: 600 },
																															width: 600,
																															position: "center"
																														});
																													setTimeout(function () { 
																														d.dialog("close"); 
																													},3000);
																												},		
																									function () {   $("<div title='Scenario Not Saved To Server'>Scenario <b>" + scenarioName + "</b> could not be saved to the server.  If you open another scenario, the changes to the unsaved scenario will be lost.</div>").dialog({
																															autoOpen: true,
																															show: { duration: 600 },
																															hide: { duration: 600 },
																															width: 600,
																															position: "center"
																													});
																												}
																									);
                                                        }
                                                     
                                                 })
                                                 	.fail(function () {	d.dialog("close");
																		commandCompleted();
																		serverUnavailable({	op: "GetScenarioList",
																							clear: false,
																							extraText: " Cannot check if a scenario named <b>" + scenarioName + "</b> already exists."
																						});
													});
                        }
					}
				]
			});	
    	}
    	else { // This is simply the File/Save command
    		commandCompleted();
			if (!MYAPP.workingCopyIsSaved) {
				var deferredSaveScenario = $.Deferred();
				saveAuthoritativeCopy_Async(false,deferredSaveScenario);
				deferredSaveScenario.done(function () {
					var d = $("<div title='Scenario Saved To Server'>Scenario <b>" + MYAPP.scenario.scName + "</b> has been saved.</div>");
					d.dialog({
							autoOpen: true,
							show: { duration: 600 },
							hide: { duration: 600 },
							width: 600,
							position: "center"
						});
					setTimeout(function () { 
						d.dialog("close"); 
					},3000);
				})
				.fail(function () {
					$("<div title='Scenario Not Saved To Server'>Scenario <b>" + MYAPP.scenario.scName + "</b> could not be saved to the server.  If you open another scenario, the changes to the unsaved scenario will be lost.</div>").dialog({
							autoOpen: true,
							show: { duration: 600 },
							hide: { duration: 600 },
							width: 600,
							position: "center"
						});
				});
			}
			else {
				var d = $("<div title='Scenario Unchanged'>Scenario <b>" + MYAPP.scenario.scName + "</b> has not changed since the last time it was saved.</div>");
				d.dialog({
						autoOpen: true,
						show: { duration: 600 },
						hide: { duration: 600 },
						width: 600,
						position: "center"
					});
				setTimeout(function () { 
					d.dialog("close"); 
				},3000);
			}
		}
    });
    
    // Main function to replace the external references in a scenario.  This is called from FILE/SAVE AS and also checkAndLoadScenario when it is saving 
    // a permalinked scenario.  There are four callbacks as parameters (see below).  The parameter replaceMyIconsToo is true if any icon reference which 
    // is NOT one of the current user's should be replaced and put into the SSIL for the scenario, and false otherwise.  If masterReplaceExternalFileReferences 
    // is being called from FILE/SAVE AS, then this parameter is false (because the same user who created the scenario is making a copy of it, so all 
    // icon references in the user's MyIcons will still be there); if it is being called when a permalinked scenario is being saved, then it will be 
    // true, because this function is only called from there if the permalinked scenario was originally created by another user.  In the replaceMyIconsToo == true 
    // case, masterReplaceExternalFileReferences creates the necessary icon ExternalFile objects and inserts them in the scenario's SSIL as it finds 
    // icons in need of translation.
    
    function masterReplaceExternalFileReferences(replaceMyIconsToo,				// True iff scenario owner is not the current user		
    											 callbackCopyFailed,			// Callback when external file copy on server fails
    											 callbackCommandCompleted,		// Callback to execute when FILE/SAVE AS completes
    											 callbackSaveScenarioDone,		// Callback when scenario is saved on server
    											 callbackSaveScenarioFailed) 	// Callback when scenario fails to be saved on server
    {
    											  
    	// Before creating the new scenario whose original is owned by a user other than the current user, all ExternalFile references 
		// specific to the original scenario must be replaced.  This includes all icons in the scenario's scenario-specific icon library (scSSIL),  
		// and each file named in the externalFileList of any event or location.  Specifically, replacing a reference involves five steps: 
		//		1. Make a new ExternalFile object based on the original one, but with a new file name generated for it.  For example, 
		//			Paul Cashman/14.jpg in the original might be re-created as Paul Cashman/35.jpg (where 35 is the next available identifier 
		//			for user Paul Cashman's external files).
		//		2. Tell the server to make a copy of the old file and name it the new file (e.g. make a copy of Paul Cashman/14.jpg and call 
		//			it Paul Cashman/35.jpg.
		//		3. Get the fully-qualified URL of the resulting new file and include it as the URL in the newly created ExternalFile object.
		//		4. Replace the old ExternalFile object in the SSIL or the event's externalFileList with the new, updated ExternalFile object.
		//		5. (a) If the ExternalFile is an icon, substitute its new URL in the appropriate event field AND in the Google Map object 
		//				for the event.
		//		   (b) If the ExternalFile is an image, find all references to the old URL in the src attribute of the <img> tag in the event's 
		//				description and replace it with the new URL.
		//
		//	The reason for doing all this is so that all external file references in a scenario are either (a) not under a user's control, 
		//	such an a URL to an image on some other web site [N.B. HiM does not track these], (b) explicitly shared via MyIcons, or (c) 
		//	scenario-specific.  Thus if the user does a Save As and eventually deletes the original scenario, the saved-as scenario's 
		// 	external file references will continue to work, since none of those files are deleted when the original scenario's files are deleted.
		//
		
		//	storage.copyExternalFile_Async returns the fully qualified URL upon success.  For each call to storage.copyExternalFile_Async, create 
		//	TWO deferred objects: one in deferredArray and one in deferredGotURLsArray.  When deferredArray[i] resolves, then we have the 
		//	URL of the new external file and can save it in translationArray[i].newXF.url.  When that is done, resolve deferredGotAllURLsArray[i].
		//	When all the objects in deferredGotURLsArray resolve, then the Save As can proceed.
		
		var deferredArray = [];
		var	deferredGotURLsArray = [];
		var index = 0;
		var e; // Will hold an event or location to examine to see if it has an icon that needs to be translated 
		var foundIconToTranslate;
		var translationArray = [];  // Each element will be an object { oldXF: (original ExternalFile),
									//									newXF: (new ExternalFile) }
		var newXFoptions = {};
		var xfToReplace;
		var newXF;
		var newURL;
		
		for (var i=0; i < MYAPP.scenario.scSSIL.length; i++) { 	
			newXFoptions.user 			= MYAPP.currentLoggedInUser;
			newXFoptions.fileType 		= MYAPP.scenario.scSSIL[i].fileType;
			newXFoptions.tooltip 		= MYAPP.scenario.scSSIL[i].tooltip;
			newXFoptions.fileExtension 	= MYAPP.scenario.scSSIL[i].fileName.substr(MYAPP.scenario.scSSIL[i].fileName.lastIndexOf(".")+1);
			translationArray[index] 	= { oldXF: MYAPP.scenario.scSSIL[i],
											newXF: new ht.ExternalFile(newXFoptions) };
			deferredArray[index]		= $.Deferred();
			deferredGotURLsArray[index] = $.Deferred();
			storage.copyExternalFile_Async(translationArray[index],deferredArray[index]);
			deferredArray[index].done((function (index) {	// Must create a closure that returns a function bound to this value of index
											return function(url) { 
												translationArray[index].newXF.url = url;
												deferredGotURLsArray[index].resolve();
											};
										})(index)
			)
			.fail((function (index) {	// Must create a closure that returns a function bound to this value of index
						return function() {
							deferredGotURLsArray[index].reject();
						};
					})(index)
			);	
			index++;
		}
		var s; 
		for (var k=0; k < 2; k++) {
			if (k == 0) s = MYAPP.scenario.scLocations; 
			else		s = MYAPP.scenario.scEvents;
			for (var i=0; i < s.length; i++) {
				if (s[i].externalFileList) {
					for (var j=0; j < s[i].externalFileList.length; j++) {
						newXFoptions.user 			= MYAPP.currentLoggedInUser;
						newXFoptions.fileType 		= s[i].externalFileList[j].fileType;
						newXFoptions.fileExtension 	= s[i].externalFileList[j].fileName.substr(s[i].externalFileList[j].fileName.lastIndexOf(".")+1);
						translationArray[index] 	= { oldXF: s[i].externalFileList[j],
														newXF: new ht.ExternalFile(newXFoptions) };
						deferredArray[index]		= $.Deferred();
						deferredGotURLsArray[index] = $.Deferred();
						storage.copyExternalFile_Async(translationArray[index],deferredArray[index]);
						deferredArray[index].done((function (index) {	// Must create a closure that returns a function bound to this value of index
														return function(url) { 
															translationArray[index].newXF.url = url;
															deferredGotURLsArray[index].resolve();
														};
													})(index)
						)
						.fail((function (index) {	// Must create a closure that returns a function bound to this value of index
									return function() {
										deferredGotURLsArray[index].reject();
									};
								})(index)
						);	
						index++;
					}
				}
				if (replaceMyIconsToo) {				// We're saving a permalinked scenario originally owned by someone else,
					e = s[i];	// so examine next location to see if it has an icon we need to translate
					foundIconToTranslate = false;
					if (((e.lat) || (e.polygon)) && e.image) foundIconToTranslate = setupMyIconForTranslation(e.image,translationArray); 
					else if (e.path && e.animationIcon)		 foundIconToTranslate = setupMyIconForTranslation(e.animationIcon,translationArray); 
					if (foundIconToTranslate) { // if foundIconToTranslate is non-null, it is the translation index entry for this icon
						translationArray[index] 	= foundIconToTranslate;
						deferredArray[index]		= $.Deferred();
						deferredGotURLsArray[index] = $.Deferred();
						storage.copyExternalFile_Async(translationArray[index],deferredArray[index]);
						deferredArray[index].done((function (index) {	// Must create a closure that returns a function bound to this value of index
														return function(url) { 
															translationArray[index].newXF.url = url;
															deferredGotURLsArray[index].resolve();
														};
													})(index)
						)
						.fail((function (index) {	// Must create a closure that returns a function bound to this value of index
									return function() {
										deferredGotURLsArray[index].reject();
									};
								})(index)
						);	
						index++;
					}
				}
			}
		}
		
		// Now copy any ExternalFiles that are in the opening and/or closing contexts of the scenario itself and/or any of its timelines.
		
		s = [];
		var efl = {};
		if (MYAPP.scenario.scExternalFileList) efl.externalFileList = MYAPP.scenario.scExternalFileList;
		else								   efl.externalFileList = [];
		s[0] = efl;
		for (var k=0; k < MYAPP.scenario.scTimelines.length; k++) {
			s[k+1] = MYAPP.scenario.scTimelines[k];
		}
		for (var i=0; i < s.length; i++) {
			if (s[i].externalFileList) {
				for (var j=0; j < s[i].externalFileList.length; j++) {
					newXFoptions.user 			= MYAPP.currentLoggedInUser;
					newXFoptions.fileType 		= s[i].externalFileList[j].fileType;
					newXFoptions.fileExtension 	= s[i].externalFileList[j].fileName.substr(s[i].externalFileList[j].fileName.lastIndexOf(".")+1);
					translationArray[index] 	= { oldXF: s[i].externalFileList[j],
													newXF: new ht.ExternalFile(newXFoptions) };
					deferredArray[index]		= $.Deferred();
					deferredGotURLsArray[index] = $.Deferred();
					storage.copyExternalFile_Async(translationArray[index],deferredArray[index]);
					deferredArray[index].done((function (index) {	// Must create a closure that returns a function bound to this value of index
													return function(url) { 
														translationArray[index].newXF.url = url;
														deferredGotURLsArray[index].resolve();
													};
												})(index)
					)
					.fail((function (index) {	// Must create a closure that returns a function bound to this value of index
								return function() {
									deferredGotURLsArray[index].reject();
								};
							})(index)
					);	
					index++;
				}
			}
		}
		
		if (index > 0) updateUser(); // Write user object to server because we incremented its "next sequence number for external file."
		
		// Await completion of all the file copy requests on the server.  Steps 1, 2, and 3 above are done.
		
		$.when.apply($,deferredGotURLsArray).done(function () {
			replaceExternalFileReferences (MYAPP.scenario.scSSIL,MYAPP.scenario.scEvents,translationArray);		// Steps 4 and 5 above
			replaceExternalFileReferences (MYAPP.scenario.scSSIL,MYAPP.scenario.scLocations,translationArray);	// Steps 4 and 5 above
			// Now that we've replaced all the icon references, we can replace the SSIL external files with 
			// their translated versions
			for (var i=0; i < MYAPP.scenario.scSSIL.length; i++) {
				for (var j=0; j < translationArray.length; j++) {
					if (translationArray[j].oldXF.fileType == "icon") {
						if (translationArray[j].oldXF.url == MYAPP.scenario.scSSIL[i].url) {	
							MYAPP.scenario.scSSIL[i] = translationArray[j].newXF;
						}
					}
				}
			}
			$("#icons_SSIL").empty(); // Remove any icons in previously loaded scenario's SSIL
			makeIconManagerTab($("#icons_SSIL"),MYAPP.scenario.scSSIL); // Set up Icon Manager tab for this scenario-specific icon library
			
			// getReplacementXF is a helper function copied from replaceExternalFileReferences below.  Returns XF of translation of oldURL, if it exists; returns null otherwise.
			
			var getReplacementXF =	function (oldURL,fileType) {	
									for (var k=0; k < translationArray.length; k++) {
										if ((translationArray[k].oldXF.fileType == fileType) &&
											(translationArray[k].oldXF.url == oldURL)) return translationArray[k].newXF;	
									}
									return null; // This oldURL doesn't have a translation 
								};
			
			// Next, check the scenario's scExternalFileList array and replace any external file references in the scenario's opening and closing contexts.
			
			if (MYAPP.scenario.scExternalFileList) {
				for (var j=0; j < MYAPP.scenario.scExternalFileList.length; j++) {
					xfToReplace = MYAPP.scenario.scExternalFileList[j];
    				newXF = getReplacementXF(xfToReplace.url, MYAPP.scenario.scExternalFileList[j].fileType); // Must be non-null since all EFs in the externalFileList are translated, by definition
    				newURL = newXF.url;
    				if (MYAPP.scenario.scStartDesc) {
    					MYAPP.scenario.scStartDesc = MYAPP.scenario.scStartDesc.replace(xfToReplace.url,newURL); // replace the old XF's url with the new one
    				}
    				if (MYAPP.scenario.scEndDesc) {
    					MYAPP.scenario.scEndDesc = MYAPP.scenario.scEndDesc.replace(xfToReplace.url,newURL); // replace the old XF's url with the new one
    				}
    				MYAPP.scenario.scExternalFileList[j] = newXF; // replace the old XF with the new one in the externalFileList
				}
			}
			
			// Finally, do the same for the externalFileList of every timeline in the scenario.
			
			for (var i=0; i < MYAPP.scenario.scTimelines.length; i++) {
				if (MYAPP.scenario.scTimelines[i].externalFileList) {
					for (var j=0; j < MYAPP.scenario.scTimelines[i].externalFileList.length; j++) {
						xfToReplace = MYAPP.scenario.scTimelines[i].externalFileList[j];
						newXF = getReplacementXF(xfToReplace.url, MYAPP.scenario.scTimelines[i].externalFileList[j].fileType); // Must be non-null since all EFs in the externalFileList are translated, by definition
						newURL = newXF.url;
						if (MYAPP.scenario.scTimelines[i].start_desc) {
							MYAPP.scenario.scTimelines[i].start_desc = MYAPP.scenario.scTimelines[i].start_desc.replace(xfToReplace.url,newURL); // replace the old XF's url with the new one
						}
						if (MYAPP.scenario.scTimelines[i].end_desc) {
							MYAPP.scenario.scTimelines[i].end_desc = MYAPP.scenario.scTimelines[i].end_desc.replace(xfToReplace.url,newURL); // replace the old XF's url with the new one
						}
						MYAPP.scenario.scTimelines[i].externalFileList[j] = newXF; // replace the old XF with the new one in the externalFileList
					}
				}
			}
			
			// Now the scenario's external file references have all been updated, so create the new scenario object
			MYAPP.scenario = new ht.Scenario(MYAPP.scenario.scName,
											 MYAPP.currentLoggedInUser.userName,
											 MYAPP.scenario.scCopyright,
											 {  creationDate: new Date(),
												lastOpenedDate: new Date(),
												lastModifiedDate: new Date()
											 },
											 { mapCenter: 				MYAPP.scenario.scMapCenter, 
											   mapZoom: 				MYAPP.scenario.scMapZoom,
											   mapID: 					MYAPP.scenario.scMapID,
											   mapLayerKeys: 			MYAPP.scenario.scMapLayerKeys,
											   historicalMapListIndex: 	MYAPP.scenario.scHistoricalMapListIndex 
											 },
											 MYAPP.scenario.scLocations,
											 MYAPP.scenario.scEvents,
											 MYAPP.scenario.scBegin,
											 MYAPP.scenario.scEnd,
											 MYAPP.scenario.scTimelines,
											 MYAPP.scenario.scDefaultEra,
											 MYAPP.scenario.scDefaultTimeZone,
											 MYAPP.scenario.scFormat,
											 MYAPP.scenario.scSSIL,
											 MYAPP.scenario.scStartDesc,
											 MYAPP.scenario.scEndDesc,
											 MYAPP.scenario.scStartSoundtrack,
											 MYAPP.scenario.scEndSoundtrack,
											 MYAPP.scenario.scExternalFileList
											);
			$('#scenario_name').text(MYAPP.scenario.scName);
			$("#browser_title").text(MYAPP.scenario.scName);
			callbackCommandCompleted();
			saveWorkingCopy(true);
			var deferredSaveScenario = $.Deferred();
			saveAuthoritativeCopy_Async(true,deferredSaveScenario);
			deferredSaveScenario.done(function () { callbackSaveScenarioDone(); })
			.fail(function () { callbackSaveScenarioFailed(); });
			})
		.fail(function () { callbackCopyFailed(); });
    }
    
    // Helper function to replace the external file references in a scenario's events and locations. This does NOT replace external file 
    // references in the opening or closing contexts of the scenario or any of its timelines.  That is done within the masterReplaceExternalFileReferences 
    // function itself.
    //		SSIL				scenario-specific icon library with original ExternalFile objects
    //		events				array of events or locations within a scenario 
    //		translationArray	translation array as defined within FILE/SAVE AS above
    
    function replaceExternalFileReferences (SSIL,events,translationArray) {
    	var e, iconToReplace, xfToReplace, newURL, newXF;
    	var getReplacementXF =	function (oldURL,fileType) {	// Returns XF of translation of oldURL, if it exists; returns null otherwise
									for (var k=0; k < translationArray.length; k++) {
										if ((translationArray[k].oldXF.fileType == fileType) &&
											(translationArray[k].oldXF.url == oldURL)) return translationArray[k].newXF;	
									}
									return null; // This oldURL doesn't have a translation 
								};
    	for (var i=0; i < events.length; i++) {
    		e = events[i];
    		// First, check whether the icon for this event is in the SSIL.  Will have to look in different places depending on what 
    		// type of event this is.
    		for (var j=0; j < SSIL.length; j++) {
    			iconToReplace = SSIL[j];
    			newXF = getReplacementXF(iconToReplace.url,"icon"); // Must be non-null since all icons in SSIL are translated, by definition
    			newURL = newXF.url;
				if (e.lat) {	// This is a point event
					if (e.image == iconToReplace.url) {	// Event has an icon that matches one in the SSIL
						e.image = newURL;
						e.marker.setIcon({ url: e.image });	// Set point event icon in Google Maps 
					}
				}
				else if (e.path) {	
					if (e.animationIcon == iconToReplace.url) e.animationIcon = newURL; // Replace animationIcon, if one exists
				}
				else if (e.polygon) {
					if (e.image == iconToReplace.url) {	// Event has an icon that matches one in the SSIL
						e.image = newURL;
						e.AEmarker.setIcon({ url: e.image });	// Set area event icon in Google Maps 
					}
    			}
    		}
    		// Next, check the event's externalFileList array and replace any external file references in the event description
			if (e.externalFileList) {
				for (var j=0; j < e.externalFileList.length; j++) {
					xfToReplace = e.externalFileList[j];
    				newXF = getReplacementXF(xfToReplace.url, e.externalFileList[j].fileType); // Must be non-null since all EFs in the externalFileList are translated, by definition
    				newURL = newXF.url;
    				if (e.description) {
    					e.description = e.description.replace(xfToReplace.url,newURL); // replace the old XF's url with the new one
    				}
    				e.externalFileList[j] = newXF; // replace the old XF with the new one in the externalFileList
				}
			}
		}
    }
    
    // Helper function to determine if an icon's URL should be part of the translation operation.  Conceptually, we want to know if the icon comes 
    // from the MyIcons set of the original owner of the scenario, but since we don't have access to that user's MyIcons to check directly, we do it 
    // indirectly by (1) making sure it's not in the SSIL and (2) making sure it's not a local file (i.e., in the Common Icon Library).  If it's not 
    // in either of those, then it must be translated.  Note that this icon-checking in the scenario's events and locations happens AFTER all the 
    // icons in the SSIL have been inserted into the translationArray, so we just need to check that array to satisfy condition (1).
    // Parameters:
    //		iconURL				URL of the icon to determine whether to translate or not 
    //		translationArray	current translationArray (see description above in masterReplaceExternalFileReferences)
    //
    // setupMyIconForTranslation returns false if the icon does not need to be translated.  If it does, it returns the translationArray object that 
    // describes the translation.
    
    function setupMyIconForTranslation (iconURL,translationArray) {
    	for (var i=0; i < MYAPP.iconList.length; i++) {
    		if (iconURL == MYAPP.iconList[i].fileName) return false;	// Ignore icons in the CIL
    	}
    	for (var i=0; i < translationArray.length; i++) {
    		if (iconURL == translationArray[i].oldXF.url) return false;	// iconURL already slated for translation 
    	}
    	var oldXFoptions = {},
    		newXFoptions = {};
    	newXFoptions.user 			= MYAPP.currentLoggedInUser;
		newXFoptions.fileType 		= "icon";
		newXFoptions.fileExtension 	= iconURL.substr(iconURL.lastIndexOf(".")+1);
		var splitURL = iconURL.split("/");
		oldXFoptions.fileName		= splitURL[4] + "/" + splitURL[5];
		oldXFoptions.fileType 		= "icon";
		oldXFoptions.fileExtension 	= newXFoptions.fileExtension;
		oldXFoptions.url			= iconURL;
		var oldXF = new ht.ExternalFile(oldXFoptions);
		MYAPP.scenario.addToSSIL(oldXF);	// Add this icon, which was in the original owner's MyIcons, to the user's SSIL.  Its URL will 
		return { oldXF: oldXF,				// be updated along with the other external files in the SSIL.
				 newXF: new ht.ExternalFile(newXFoptions) };
    }
    
    // LOGOUT function checks if the current scenario has unsaved changes; if so, it saves them to the server.  It then clears out the current user, which 
    // will force a new login the next time HiM is started on this machine/device.  Finally, it starts up the login/create new user dialog.
    
    $("#enclose-menu li:contains(Logout)").click(function (event) {
    	if (isAnotherCommandInProgress("LOGOUT")) return; // If another command is in process, can't continue with this one
		if ((MYAPP.scenario != undefined) &&(!MYAPP.workingCopyIsSaved)) { // We have a scenario that's been saved locally but not to the server yet
			var d = $("<div title='Warning'>The last set of changes to scenario <b>" + MYAPP.scenario.scName + "</b> has not been saved to the server.  Would you like to save them?<div>");
			d.dialog({
				autoOpen: true,
				show: { duration: 600 },
				hide: { duration: 600 },
				position: "center",
				width: 600,
				buttons: [
					{ text: "Save Changes", click: function() {
														var deferredSaveScenario = $.Deferred();
														saveAuthoritativeCopy_Async(false,deferredSaveScenario);
														deferredSaveScenario.done(function () {
															d.dialog("close");
															d = $("<div title='Scenario Saved To Server'>Scenario <b>" + MYAPP.scenario.scName + "</b> has been saved.</div>");
															d.dialog({
																	autoOpen: true,
																	show: { duration: 600 },
																	hide: { duration: 600 },
																	width: 600,
																	position: "center"
																});
															finishLoggingOut();
															setTimeout(function () { 
																d.dialog("close"); 
															},3000);
														})
														.fail(function () {
															finishLoggingOut();
															$("<div title='Scenario Not Saved To Server'>Scenario <b>" + MYAPP.scenario.scName + "</b> could not be saved to the server.  HiM will retry the next time you log in.</div>").dialog({
																	autoOpen: true,
																	show: { duration: 600 },
																	hide: { duration: 600 },
																	width: 600,
																	position: "center"
																});
														});
											 } 
					},
					{ text: "Discard Changes", click: function () {
														MYAPP.workingCopyIsSaved = true;
														d.dialog("close");
														finishLoggingOut();
											 }
					},
					{ text: "Cancel", click: function () {
														d.dialog("close");
														commandCompleted();
											 }
					}
				]
			});
		}
		else finishLoggingOut();
    });
    
    function finishLoggingOut () {
    	unsetCurrentLoggedInUser(); // Null out current logged-in user
    	$('#scenario_name').text("(no scenario loaded)");
    	$("#browser_title").text("History in Motion");
		$('#Select_Timeline').empty();
		$('#current_time').text("");   	
		$("#slider-box").slider({
							slide: function(event, ui) { 
									setTimePosition(ui.value); },
							value: 0,
							max: 0,
							min: 0
						}).removeData().data("timelineID", -1);  
		$('#Select_Timeline_Form').unbind("change");
		$('#play_button').button("disable");
		
		// Clear the icons from the MyIcons and last SSIL tab in the Icon Manager.  The icons for the new user will be loaded as needed.
		
		$("#icons_MyIcons").empty();
		$("#icons_SSIL").empty();
		MYAPP.map = null;					/* The current Google Map object */	
        MYAPP.mapLayers = null;				// Array of MapsEngineLayer objects currently being display.  These will be historical maps.
        MYAPP.mapID = null;					// ID of historical map, obtained from Google Gallery	
		MYAPP.scenario = null;
		MYAPP.OKToLoadScenario = false;		/* Boolean to indicate when it's OK to load a scenario.  */
        MYAPP.OKToLoadScenarioID = setInterval(checkAndLoadScenarioFromTimer,100);	/* ID of timer to check whether it's safe to proceed with loading a scenario */
    	executeLoginDialog();
    	commandCompleted();
    }
    
    $("#enclose-menu li:contains(Edit) li:contains(User)").click(function (event) {
    	if (isAnotherCommandInProgress("EDIT/USER")) return; // If another command is in process, can't continue with this one
    	var deferredGetUser = $.Deferred();
		storage.getUser_Async(MYAPP.currentLoggedInUser.userName, MYAPP.currentLoggedInUser.password,deferredGetUser);
		// No need to check the status returned by the server, because the user is already logged in.
		deferredGetUser.done(function (status, user) { 
			editOrCreateUserAccount({	uOperation: "edit",
										uName:		MYAPP.currentLoggedInUser.userName,
										uPassword:	MYAPP.currentLoggedInUser.password,
										uData:		status.data	// User account data from server
									});
    	})
    	.fail(function () {
							commandCompleted();
							$("<div title='Server Error'>Unable to connect to server to complete this request.</div>").dialog();
						});
    });
    
    function editOrCreateUserAccount (options) {
    	clearAllErrors();
    	var dialogTitle = (options.uOperation == "create") ? "Create" : "Edit";
    	dialogTitle = dialogTitle + " User Account For " + options.uName;
    	
    	// Fill in fields for user account creation or editing
    	
    	$("#edit_user_pwd1").val(options.uPassword);
    	$("#edit_user_pwd2").val(options.uPassword);
    	if (options.uOperation == "create") {
    		$("#edit_user_email1").val("");
    		$("#edit_user_email2").val("");
    		$("#edit_user_opt_in_yes").prop("checked",true);
    		$("#edit_user_year option").prop('selected',false).filter(function() {	
																	return $(this).text() == "2014"; 
																  }).prop('selected', true);
			$("#edit_user_role option").prop('selected',false).filter(function() {	
																	return $(this).val() == "0"; 
																  }).prop('selected', true);
			$("#edit_user_reasons option").prop('selected',false).filter(function() {	
																	return $(this).val() == "0"; 
																  }).prop('selected', true);
    	}
    	else {
    	 	var x = $.parseJSON(options.uData);	// Revive the JSONified user data obtained from the server
    	 	x = (x) ? x : {}; // Check if x is null, i.e., there was no user record to begin with.  Should not happen once HiM is in real operation.
    	 	x.uEmail = (x.uEmail) ? x.uEmail : "";
    	 	$("#edit_user_email1").val(x.uEmail);
    		$("#edit_user_email2").val(x.uEmail);
    		x.uOptIn = (x.uOptIn) ? x.uOptIn : "yes";
    		$("#edit_user_opt_in_" + x.uOptIn).prop("checked",true);
    		x.uYearOfBirth = (x.uYearOfBirth) ? x.uYearOfBirth : "2014";
    		$("#edit_user_year option").prop('selected',false).filter(function() {	
																	return $(this).text() == x.uYearOfBirth; 
																  }).prop('selected', true);
			x.uRole = (x.uRole) ? x.uRole : "0";
			$("#edit_user_role option").prop('selected',false).filter(function() {	
																	return $(this).val() == x.uRole; 
																  }).prop('selected', true);
			x.uReason = (x.uReason) ? x.uReason : "0";
			$("#edit_user_reasons option").prop('selected',false).filter(function() {	
																	return $(this).val() == x.uReason; 
																  }).prop('selected', true);
    	}
    	var OKtoCloseUserAccountDialog = false; // Flag to say if the user has supplied enough info when a new user is being created
    	var d = $("#edit_user").css("display","block").dialog({
    	 	autoOpen: true,
			show: { duration: 600 },
			hide: { duration: 600 },
			width: 600,
			title: dialogTitle,	// Set the title of the dialog box
			modal: (options.uOperation == "create"), // if we are creating a user acct, user MUST supply this info before proceeding
			beforeClose: function (event, ui) {
								if ((options.uOperation == "create") && !OKtoCloseUserAccountDialog) {	// User MUST provide account information 
									var d = $("<div><p>Please finish supplying account information.</p></div>");
									d.dialog({
										autoOpen: true,
										show: { duration: 600 },
										hide: { duration: 600 },
										position: "center",
										width: 400,
										title: "Must Complete Creating Account",
										buttons: [
											{ text: "OK", click: function () { d.dialog("close") }
											}
										]
									});
									return false;
								}
								else return true;
							 },
			buttons: [
				{ text: "Cancel", click: function() {
												clearAllErrors();
												d.dialog("close").css("display","none");
												commandCompleted();
												if (options.uOperation == "create") {
													executeLoginDialog();
												}
										 } 
				},
				{ text: "Save", click: function() {
												clearAllErrors();
												var pwd1 = 		$("#edit_user_pwd1").val();
    											var pwd2 = 		$("#edit_user_pwd2").val();
												var email1 = 	$("#edit_user_email1").val();
												var email2 = 	$("#edit_user_email2").val();
												var optIn = 	$("input:radio[name='edit_user_opt_in_option']:checked").val();
												var yearOfBirth = $("#edit_user_year").val();
												var role = 		$("#edit_user_role").val();
												var reason = 	$("#edit_user_reasons").val();
												if 		((pwd1 != pwd2)
													||	 (pwd1.length > 20)
													||	 (email1 != email2)
													||	 (email1 == "")
													||   (!validateEmail(email1))
													) 
												{
													if (pwd1 != pwd2) 		setError($("#edit_user_pwd1"),"noPassMatch");
													if (pwd1.length > 20)	setError($("#edit_user_pwd1"),"pwdTooLong");
													if (email1 != email2)	setError($("#edit_user_email1"),"noEmailMatch");
													if (email1 == "")		setError($("#edit_user_email1"),"noEmail");
													if (!validateEmail(email1))	setError($("#edit_user_email1"),"badEmail");
													return;
												}
												var MyIcons, nextExternalFileID;
												if (options.uOperation == "create") {
													MyIcons = [];
													nextExternalFileID = 0;
												}
												else {
													MyIcons = MYAPP.currentLoggedInUser.MyIcons;
													nextExternalFileID = MYAPP.currentLoggedInUser.nextExternalFileID;
												
												}
												var deferredOperation = $.Deferred();
												var userData = JSON.stringify({ uEmail: 		email1,
																 				uOptIn: 		optIn,
																 				uYearOfBirth: 	yearOfBirth,
																			 	uRole:			role,
																 				uReason:		reason,
																 				uMyIcons:		MyIcons,
																 				nextExternalFileID: nextExternalFileID
																				});
												if (options.uOperation == "create") {
													storage.createNewUser_Async(options.uName, pwd1, userData, deferredOperation);
													deferredOperation.done(function (user) {
														commandCompleted();
														MYAPP.currentLoggedInUser = user;
														OKtoCloseUserAccountDialog = true;
														d.dialog("close").css("display","none");
														d = $("#welcome_back_dialog"); // The "Welcome back" <div> 
														d.text("Welcome, " + MYAPP.currentLoggedInUser.userName);
														d.dialog({
															autoOpen: true,
															show: { duration: 600 },
															hide: { duration: 600 },
															position: "center"
														});
														setTimeout(function () { 
															d.dialog("close"); 
															MYAPP.OKToLoadScenario = true; // It's safe to load the scenario now that the login dialog is closed
														},3000);
														setCurrentLoggedInUser(MYAPP.currentLoggedInUser);
													})
													.fail(function () {
														setError($("#username"),"userExists");
														OKtoCloseUserAccountDialog = true;
													});
												}
												else {	// Save results of editing a logged-in user
													storage.updateUser_Async(options.uName, pwd1, userData, deferredOperation);
													deferredOperation.done(function (user) {
														MYAPP.currentLoggedInUser = user; // Need to reset user object in case the password changed during editing
														setCurrentLoggedInUser(MYAPP.currentLoggedInUser);
														d.dialog("close").css("display","none");
														commandCompleted();
														$("<div title='User Updated'>User <b>" + options.uName + "</b> has been updated.</div>").dialog();
													})
													.fail(function () {
														setError($("#username"),"cantUpdate");
													});
												}
										}
				}
			]
    	});
    }
    
    // Helper function to check validity of email address format.  Returns true if addr is a correctly formatted email address, false otherwise. 
    // This does not check validity of top-level domain or existence of actual email address.
    
    function validateEmail(addr) {
    	var a = addr.split("@");
    	if (a.length != 2) return false;	// Must be something@somethingelse
    	var alength = a.length;
    	if (a[1].charAt(alength-1) == ".") return false; 	// The somethingelse can't end in a period
    	var b = a[1].split(".");
    	if (b.length < 2) return false;		// Somethingelse must be of the form something.topleveldomain, where something can have periods inside it
    	var blength = b.length;
    	if (b[blength-1].length < 2) return false; // The top-level domain must be at least 2 characters long
    	return true;
    }
    
    // Icon manager functions
    //
    // This functionality displays the HiM icon manager.  This performs multiple functions:
    //	 1. Displays, in a tabbed dialog box, the HiM common icon library, the user's MyIcons library, and the scenario-specific icon library (SSIL) 
    //		for the current scenario.
    //	 2. Enables the user to edit MyIcons and SSIL by adding and deleting icons, or moving icons between the libraries.  (The HiM CIL is not under 
    //      user control and is simply displayed.  The user can edit a given icon (which effectively means changing its tooltip).
    //	 3. Enables the user to select an icon for use in an event.
    
	$("#enclose-menu li:contains(File) li:contains(Icons...)").click(function (event) {
    	if (isAnotherCommandInProgress("FILE/ICONS")) return; // If another command is in process, can't continue with this one
    	MYAPP.iconMode = "manage";
    	MYAPP.changedMyIcons = false;  	// Flags to indicate whether the user's MyIcons IL and current SSIL changed during current icon-editing session 
        MYAPP.changedSSIL = false;		// This will determine whether to update the user object to the server, and whether to indicate the scenario object should be saved
    	if (userIsSystemAdmin()) $("#icon_tabs").tabs("disable",2); // System Admin can only insert icons into MyIcons, which functions as the Common Icon Library for all other users
    	else 					 $("#icon_tabs").tabs("enable");	// If this is an ordinary user, enable all tabs
    	// Don't enable tab for HiM CIL if we're managing the icons.  Hide it by making tab 1 (My Icons) the active tab.
    	$("#icon_tabs").tabs("disable",0).tabs({ active: 1 }); 
    	$("#icon_add_files").css("display","block").bind('change',handleFileSelect); // Handler to add an icon file if user clicks "Choose Files" button
    	$("#icon_dialog_box").css("display","block").dialog({
    		title: "Manage Your Icons",
    		autoOpen: true,
			show: { duration: 600 },
			hide: { duration: 600 },
			position: "left top+45",
			width: 600,
    		close: function () { 
    			commandCompleted(); 
    			$("#icon_add_files").unbind('change').replaceWith($("#icon_add_files").clone()); // Will get re-bound the next time FILE/ICONS is invoked
    			$("#icon_dialog_box").css("display","none");									 // The replaceWith() clears the input element
    			if (MYAPP.changedMyIcons) {		// Need to update the user object on the server with the new MyIcons
    				updateUser();
    			}
    			if (MYAPP.changedSSIL) {  // Need to indicate that the current scenario has changed
    				if (!MYAPP.changedMyIcons) updateUser();	// Do this just to be safe.  User may have added icons, in which case the "next external file number" value 
    															// has been updated in the user entry and needs to be propagated back to the server.
    				saveWorkingCopy(false);
    			}
    		}
    	});
    });
    
	// Helper function to set up a tab in the Icon Manager.
	//	jqTab			jQuery object which is the tab to fill 
	//	iconLibrary		array of ExternalFile objects representing the icons to fill
        
	function makeIconManagerTab(jqTab,iconLibrary) {
		if (iconLibrary == undefined) iconLibrary = [];
		for (var i=0; i< iconLibrary.length; i++) jqTab.append(makeIconForDisplay(iconLibrary[i]));
	}
	
	// Helper function to make an icon for display in one of the IconManager tabs.  makeIconForDisplay takes an ExternalFile object and 
	// makes an <img> tag out of it.  It also sets the tooltip for the icon and attaches a click listener.  The listener will either open the 
	// management dialog (delete/edit/move) for the icon, if we're if management mode, or will invoke the event type-specific selection function 
	// to copy the icon's URL to the appropriate field in the event object.
	
	function makeIconForDisplay(externalFile) {
		var tooltip = externalFile.tooltip;
		if (tooltip == undefined) tooltip = externalFile.fileName;
		var source = (externalFile.url) ? externalFile.url : externalFile.fileName;
		return $("<img class='thumb' src='" + source + "' title='" + tooltip + "'/>") 
				.data({"externalFile" : externalFile})		// Associate the ExternalFile object for this icon with the HTML element for the icon
				.tooltip()
				.click(function (event) {
					var iconTarget = $(event.target);		// Need the clicked icon for Del/Edit/Move processing
					externalFile = $(iconTarget).data("externalFile");
					var activeTabNum = $("#icon_tabs").tabs("option","active");
					var activeTab	 = (activeTabNum == 1) ? $("#icons_MyIcons") : $("#icons_SSIL");
					var inactiveTab	 = (activeTabNum == 1) ? $("#icons_SSIL") : $("#icons_MyIcons");
					var fromIL 		 = (activeTabNum == 1) ? MYAPP.currentLoggedInUser.MyIcons : MYAPP.scenario.scSSIL;
					var toIL   		 = (activeTabNum == 1) ? MYAPP.scenario.scSSIL : MYAPP.currentLoggedInUser.MyIcons;
					if (MYAPP.iconMode == "select") {
						MYAPP.selectModeProcessingFunction(iconTarget); // Invoke event type-specific function to select icon's source and 
						return;											// copy it into event type-specific field within the event object
					}
					var iconMgmtDialog = $("<div id='icon_manage_button_array' title='Icon: " + tooltip +"'></div>").dialog({
						autoOpen: true,
						show: { duration: 600 },
						hide: { duration: 600 },
						position: { my: "left",
									at: "left+" + event.pageX + " top+" + event.pageY,
									of: $(document)
								   },
						buttons: [
							// Delete icon from the active tab/icon library
							{ text: "Delete", click: function(event) {
															iconMgmtDialog.dialog("close").css("display","none");
															if (userIsSystemAdmin()) { // System Admin can't delete icons
																$("<div title='Not Allowed'>System Admin cannot move or delete icons in MyIcons</div>").dialog();
																return;
															}
															var msg = (activeTabNum == 1) ? "other scenarios" : "this scenario";
															var d = $("<div title='Delete Icon '" + externalFile.tooltip + "'>This icon may still be used in " + msg + ".  If so, it will show up as <img src='foo'></div>");
															d.dialog({ buttons: [
																			{ text: "Cancel", click: function () { d.dialog("close"); }
																			},
																			{ text: "Delete", click: function () {
																										d.dialog("close");
																										var deferredDeleteFile = $.Deferred();
																										storage.deleteExternalFile_Async(externalFile,deferredDeleteFile);
																										deferredDeleteFile.done(function() {
																											var whatChanged = (activeTabNum == 1) ? "changedMyIcons" : "changedSSIL";
																											MYAPP[whatChanged] = true;
																											activeTab.children().filter($(iconTarget)).remove();
																											removeIconFromSet(fromIL,externalFile);
																										})
																										.fail(function() {
																											setError($("#icon_add_files"),"deleteFail");
																										});
																									
																									}
																			}
																		]
																	});
														}
							},
							
							// Edit the icon's tooltip
							{ text: "Edit", click: function() {
															iconMgmtDialog.dialog("close").css("display","none");
															var d = $("<div title='Edit Tooltip for Icon'><input type='text' value='" + externalFile.tooltip + "' id='icon_tooltip'/></div>");
															d.dialog({	buttons: [
																			{ text: "Cancel", click: function () { d.dialog("close"); }
																			},
																			{ text: "Save", click: function () {
																										tooltip = $("#icon_tooltip").val();
																										if (tooltip.length > 20) tooltip = tooltip.substr(0,20);
																										for (var i=0; i < fromIL.length; i++) {	
																											if (fromIL[i].matchesExternalFile(externalFile)) {
																												fromIL[i].tooltip = tooltip;		// Set the new tooltip in the ExternalFile object in the fromIL icon library
																												break;
																											}
																										}
																										d.dialog("close"); 
																										$(iconTarget).attr("title",tooltip);  // Set the new tooltip in the title attribute of the clicked image
																										var whatChanged = (activeTabNum == 1) ? "changedMyIcons" : "changedSSIL";
																										MYAPP[whatChanged] = true;
																									}
																			}	
																		]
																});
														}
							},
							
							// Move the icon from the active icon library to the inactive one (i.e., from MyIcons to the SSIL, or vice versa)
							{ text: "Move", click: function() {
															iconMgmtDialog.dialog("close").css("display","none");
															if (userIsSystemAdmin()) { // System Admin can't move icons
																$("<div title='Not Allowed'>System Admin cannot move or delete icons in MyIcons</div>").dialog();
																return;
															}
															inactiveTab.append(activeTab.children().filter($(iconTarget)).detach());
															removeIconFromSet(fromIL,externalFile);
															toIL.push(externalFile);
															MYAPP.changedMyIcons = true;
															MYAPP.changedSSIL = true;
														} 
							}
						]
					});
				});
	
	}
	
	// Helper function to select an icon file to add to the active tab of the Icon Manager, and to upload its contents to the server.
	//
	// Note that the icon's file is read as an ArrayBuffer, converted to a string, and sent to the server, which will convert it back to a 
	// Buffer and write the file.
	
	function handleFileSelect(event) {
		clearAllErrors();
		var files = event.target.files; // FileList object.
		for (var i = 0, f; f = files[i]; i++) {
			// Only process image files or PDFs
		    if (!(f.type.match('image.*') || (f.type == "application/pdf"))) {
		    	setError($("#icon_add_files"),"notImage");
				continue;
		    }
		    else if (f.size > MYAPP.maxUploadableFileSize) {
		    	setError($("#icon_add_files"),"fileTooBig");
				continue;
		    }
		    clearAllErrors();
			var externalFile = new ht.ExternalFile({ user: MYAPP.currentLoggedInUser,
													 fileType: "icon",
													 fileExtension: f.name.substr(f.name.lastIndexOf(".")+1)
											});
			var activeTab = $("#icon_tabs").tabs("option","active");
			var deferredIconSavedToServer = $.Deferred();
				storage.saveExternalFile_Async(externalFile,f,deferredIconSavedToServer);
				deferredIconSavedToServer.done(function(iconURL) {
					clearAllErrors(); // Clears "please wait" message
					externalFile.url = iconURL; // iconURL is the fully specified URL 
					var tooltip;
					var saved = false;
					var d = $("<div title='Edit Tooltip for Icon'><input type='text' id='icon_tooltip'/></div>");
					d.dialog({	close: function () { // Need the close function in case the user simply closes the dialog without saving a tooltip
												d.dialog("destroy");	// Have to destroy the dialog, otherwise the "saved" variable value gets used subsequently
												addExternalFile(activeTab,externalFile);  // Add the icon we just created to MyIcons or the SSIL
												if (!saved) $("#icon_tabs").children().eq(1+$("#icon_tabs").tabs("option","active")).append(makeIconForDisplay(externalFile));
											},
								buttons: [
									{ text: "Save", click: function () {
																saved = true;
																tooltip = $("#icon_tooltip").val();
																if (tooltip.length > 20) tooltip = tooltip.substr(0,20);
																externalFile.tooltip = tooltip;
																d.dialog("destroy"); // Have to destroy the dialog, otherwise the "saved" variable value gets used subsequently
																$("#icon_tabs").children().eq(1+$("#icon_tabs").tabs("option","active")).append(makeIconForDisplay(externalFile));
																addExternalFile(activeTab,externalFile);  // Add the icon we just created to MyIcons or the SSIL
															}
									}	
								]
						});
				})
				.fail(function () {
					setError($("#icon_add_files"),"uploadFail");
				});
		}
	}
    
    // Helper function to add an ExternalFile either to MyIcons or the current scenario's SSIL, depending on which active tab of the IM was affected.
    //	activeTab		zero-based index of active tab (0 = CIL, 1 = MyIcons, 2 = SSIL) (N.B. case 0 will not occur.)
    //	externalFile	ExternalFile object for the icon just created 
    
    function addExternalFile (activeTab, externalFile) {
    	if (activeTab == 1) {
    		MYAPP.currentLoggedInUser.addToMyIcons(externalFile);
    		MYAPP.changedMyIcons = true;
    	}
    	else {
    		MYAPP.scenario.addToSSIL(externalFile);
    		MYAPP.changedSSIL = true;
    	}
    }
    
    // Helper function to remove an icon from a set 

	function removeIconFromSet (iconSet, icon) {
		for (var i=0; i < iconSet.length; i++) {
			if (iconSet[i].matchesExternalFile(icon)) {
				var k = iconSet.length - 1;
				for (var j=i; j < k; j++) {
					iconSet[j] = iconSet[j+1];
				}
				iconSet.pop();
				return;
			}
		}
	}
	
	// FILE/PERMALINK
	
	$("#enclose-menu li:contains(File) li:contains(Permalink)").click(function (event) {
		if (isAnotherCommandInProgress("FILE/PERMALINK")) return; // If another command is in process, can't continue with this one
		var deferredGetPermalink = $.Deferred();
		storage.getPermalink_Async(MYAPP.currentLoggedInUser.userName, MYAPP.currentLoggedInUser.password, MYAPP.scenario.scName, deferredGetPermalink);
		deferredGetPermalink.done(function (permalink) {
			commandCompleted();
			$("<div title='Permalinks for This Scenario'>The permanent link to <u><i>copy and edit</i></u> this scenario is:<br><b>" 
						   + MYAPP.HiMWebServer + "?scen=" + permalink + "</b><br><br>The permanent link to this <u><i>read-only</i></u> scenario is:<br><b>" 
						   + MYAPP.HiMWebServer + "?scen=" + permalink + "&anon=true</b><br><br>To embed the scenario in another web site, use the following code:<br>" +
						   "<b>&lt;iframe src=\"" + MYAPP.HiMWebServer + "?scen=" + permalink + "&anon=true\" height=768 width=1024&gt;&lt;/iframe&gt;</b></div>").dialog({ position: "left+20 center",
																								width: 650 });
		})
		.fail(function () {
			commandCompleted();
			$("<div title='Unable to Access Server'>Unable to access server to get this scenario's  permalink.</div>").dialog();
		});
	});
	
	// FILE/MAPS...
	//
	// This command obtains information about a historical map the user wishes to add to HiM.  Any user can add a map and name it whatever he wishes. 
	// If a map has a name which is already in use, the user must provide an alternative.
	//
	// Depending on what type of map this is, the user will be asked for different information.  The types supported are:
	//		Google Map Engine 
	//		MapTiler 
	
	$("#enclose-menu li:contains(File) li:contains(Map)").click(function (event) {
		if (isAnotherCommandInProgress("FILE/MAP")) return; // If another command is in process, can't continue with this one
		clearAllErrors();
		$("#map_title").val("");
		$("#map_desc").val("");
		$("#GME_inputs_div").css({"visibility":"hidden", "display": "none"});
		$("#MapTiler_inputs_div").css({"visibility":"hidden", "display": "none"});
		$("#map_manager option").filter(function() {	// Find the option element that is "Choose", and set the selection to be it
														return $(this).text() == "Choose:"; 
													  }).prop('selected', true);
		var deferredGetMaps = $.Deferred();
		storage.getMaps_Async(deferredGetMaps); // Get info on all maps
		deferredGetMaps.done(function(mapList) {
			$("#map_manager").on("change", function () { 
				clearAllErrors();
				// When the user selects a map manager, then we can display the parameter inputs specific to that manager.
				// First, check that the map title is not blank or a duplicate of an existing one.
				var mapTitle = $("#map_title").val().trim();
				var mapDesc;
				if (mapTitle == "") {
					setError($("#map_title"),"noBlank");
					$("#map_manager option").filter(function() {	// Find the option element that is "Choose", and set the selection to be it
														return $(this).text() == "Choose:"; 
													  }).prop('selected', true);
					return;
				}
				var found = false;
				for (var i=0; i < mapList.length; i++) {
					if (mapList[i].title == mapTitle) {
						found = true;
						break;
					}
				}
				if (found) {
					setError($("#map_title"),"duplMapTitle");
					$("#map_manager option").filter(function() {	// Find the option element that is "Choose", and set the selection to be it
														return $(this).text() == "Choose:"; 
													  }).prop('selected', true);
					return;
				}
				// Initialize the fields specific to the map manager selected
				switch ($("#map_manager").val()) {
					case "GME":	// Google Maps Engine 
						$("#map_GME_ID").val("");
						$("#map_GME_layer_key").val("");
						$("#map_initial_zoom option").filter(function() {	// Find the option element that is 8, and set the selection to be it
															return $(this).text() == "8"; 
														  }).prop('selected', true);
						$("#map_lat").val("");
						$("#map_lng").val("");
						$("#MapTiler_inputs_div").css({"display":"none", "visibility":"hidden"});
						$("#GME_inputs_div").css({"display":"block", "visibility":"visible"});
						break;
					case "MapTiler":
						$("#map_zip").css("display","block").bind('change',function (event) { 
																				MYAPP.zipFileObject = event.target.files[0]; // Note the FilesList object returned by the user's selection.
																			}); // Handler to deal with a MapTiler zip file if user clicks "Choose Files" button
						$("#GME_inputs_div").css({"display":"none", "visibility":"hidden"});
						$("#MapTiler_inputs_div").css({"display":"block", "visibility":"visible"});
				}
			});
			$("#map_dialog").css("display","block")
			.dialog({ 	autoOpen: true,
						show: { duration: 600 },
						hide: { duration: 600 },
						width: 550,
						close: function () { 
									commandCompleted(); 
									$("#map_zip").unbind('change').replaceWith($("#map_zip").clone()); // Will get re-bound the next time FILE/MAP is invoked
									$("#map_dialog").css("display","none");	
								},
						buttons: [ { text: "Cancel", click: function () {
																clearAllErrors();
																$("#map_dialog").dialog("close");
																return;
															}
								   },
								   { text: "Save", click: function () {
								   								clearAllErrors();
								   								var mapOptions = {};
								   								mapOptions.title = $("#map_title").val().trim();
																mapOptions.desc	 = $("#map_desc").val().trim();
																if (mapOptions.title == "") { 
																	setError($("#map_title"),"noBlank");
																	return;
																}
																var found = false;
																for (var i=0; i < mapList.length; i++) {
																	if (mapList[i] == mapOptions.title) {
																		found = true;
																		break;
																	}
																}
																if (found) {
																	setError($("#map_title"),"duplMapTitle");
																	return;
																}
																// Read and edit the manager-specific fields
								   								switch ($("#map_manager").val()) {
																	case "GME":	// Google Maps Engine 
																		mapOptions.manager = "GME";
																		mapOptions.GME_ID 			= $("#map_GME_ID").val();
																		mapOptions.GME_layer_key 	= $("#map_GME_layer_key").val();
																		mapOptions.initial_zoom 	= $("#map_initial_zoom").val();
																		mapOptions.lat 				= $("#map_lat").val();
																		mapOptions.lng 				= $("#map_lng").val();
																		var errorOccurred = false;
																		if (mapOptions.GME_ID.length == 0)						{ setError($("#map_GME_ID"),"noBlank"); errorOccurred = true; }
																		if (mapOptions.GME_layer_key.length == 0)				{ setError($("#map_GME_layer_key"),"noBlank"); errorOccurred = true; }
																		if (mapOptions.lat.length == 0)							{ setError($("#map_lat"),"noBlank"); errorOccurred = true; }
																		else mapOptions.lat = Number(mapOptions.lat);
																		if (mapOptions.lng.length == 0)							{ setError($("#map_lng"),"noBlank"); errorOccurred = true; }
																		else mapOptions.lng = Number(mapOptions.lng);
																		if (isNaN(mapOptions.lat)) 								{ setError($("#map_lat"),"latIsNaN"); errorOccurred = true; }
																		if ((mapOptions.lat < -90) || (mapOptions.lat > 90))	{ setError($("#map_lat"),"latBounds"); errorOccurred = true; }
																		if (isNaN(mapOptions.lng))								{ setError($("#map_lng"),"lngIsNaN"); errorOccurred = true; }
																		if ((mapOptions.lng < -180) || (mapOptions.lng > 180))	{ setError($("#map_lng"),"lngBounds"); errorOccurred = true; }
																		if (errorOccurred) return;
																		
																		var deferredSaveMap = $.Deferred();
																		storage.saveMap_Async(mapOptions,undefined, deferredSaveMap);
																		$("#map_dialog").dialog("close");
																		deferredSaveMap.done(function () {
																			$("<div title='Map Saved'>Saved the Google Maps Engine map as a historical map with title<b> " + mapOptions.title + "</b>.</div>").dialog();
																		})
																		.fail(function () {
																			$("<div title='Map Not Saved'>Unable to save the Google Maps Engine map as a historical map with title<b> " + mapOptions.title + "</b>.</div>").dialog();
																		});
																		
																		break;
																	case "MapTiler":
																		mapOptions.manager = "MapTiler";
																		clearAllErrors();
																		var zip = MYAPP.zipFileObject; // FileList object set by handleMapZipFileSelect
																		if (zip == undefined) { // User clicked Save without having chosen a zip file
																			setError($("#map_zip_div"),"needZip");
																			return;
																		}
																		// Only process a zip file (based on the file type)
																		var isZipFile = false;
																		var zipFileTypes = ["application/zip",
																							"application/x-zip",
																							"application/octet-stream",
																							"application/x-octet-stream",
																							"application/x-zip-compressed",
																							"application/gz",
																							"application/gzip"
																							];
																		for (var i=0; i < zipFileTypes.length; i++) {
																			if (zipFileTypes[i] == zip.type) {
																				isZipFile = true;
																				break;
																			}
																		}
																		if (!isZipFile) {
																			setError($("#map_zip_div"),"notZip");
																			return;
																		}
																		if (zip.size > MYAPP.maxMTZipFileSize) {
																			setError($("#map_zip_div"),"tooBig");
																			return;
																		}
		
                                                                        clearAllErrors();
                                                                        var deferredSaveMap = $.Deferred();
                                                                        storage.saveMap_Async(mapOptions,zip,deferredSaveMap);
                                                                        setError($("#map_zip_div"),"plsWait","#336600");	// Tell user to wait while file uploads
                                                                        deferredSaveMap.done(function() {
                                                                            $("#map_dialog").dialog("close");
                                                                            $("<div title='Map Saved'>File <b>" + zip.name + "</b> saved as a historical map with title<b> " + mapOptions.title + "</b>.</div>").dialog();
                                                                        })
                                                                        .fail(function () {
                                                                            setError($("#map_zip_div"),"uploadFail");
                                                                        });

																		break;
																}
								   							}
								   }
								 ]
				});
		})
		.fail(function () {
			setError($("#map_title"),"cantCheckTitles");
			commandCompleted();
			return;
		});
	});
	   
});

});
