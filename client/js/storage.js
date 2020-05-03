// storage.js
// 						HISTORY IN MOTION WEB CLIENT
// CODE COPYRIGHT (c) 2013 - 2015 BY PAUL M. CASHMAN (North Reading, MA) and JOHN M. LEEN (Seattle, WA)
// ALL RIGHTS RESERVED.

//
// Library for storing and retrieving persistent data.
//
// TODO: Completely encapsulate stringification within these functions.  The
// serialization format should be an implementation detail, so that the server
// can use something else if it makes sense.

define(['historical_time'], function(ht) {

// TODO(jleen): the CurrentLoggedInUser functions need to do two things:
//   - Store the entire user object to its proper key on the server.
//   - Store the name and password in localStorage.
//	"http://localhost:5555/"
// "http://historyinmotion.herokuapp.com/"


function serverUrl() {
    // Since the client is now served by the server, we can just do this.
    return "/"; 
    //return "http://localhost:5555/"
}

// Creates a new user 
//
// Returns a promise of the new user.  deferredGetUser is the Deferred object to either resolve or reject, based on the response from
// the server.

function createNewUser_Async(userName, password, userData, deferredGetUser) {
    return $.get(serverUrl() + "user/" + userName, {password: password, newuser: true, userdata: userData, uemail: eval("(" + userData + ")").uEmail})
            .done(function () { deferredGetUser.resolve(new ht.User({ "userName" : userName, "password" : password, "userData": userData }))})
            .fail(function () { deferredGetUser.reject(); });
}

// Gets a user from the server.
//
// Returns a promise of that user.  deferredGetUser is the Deferred object to either resolve or reject, based on the response from
// the server.
// status is the object returned by the server (see web.js).  It consists of:
//		code:		status code string (see web.js)
//		uname:		user name of logged in user (important because the user may have forgotten this and logged in with his email address)
//		upassword:	real (not one-time temporary) password for the user
//		data:		the user object in the database.

function getUser_Async(userName, password, deferredGetUser) {
    return $.get(serverUrl() + "user/" + userName, {password: password, newuser: false})
        	.done(function (status) { 
        					switch (status.code) {
        						case "no_user":
        						case "bad_pwd":
        							deferredGetUser.resolve(status,null); // Kick this up to main to handle the error
        							break;
        						case "logged_in_std":
        						case "logged_in_temp":
        							var userData = eval("(" + status.data + ")");
        							deferredGetUser.resolve(status, new ht.User({ "userName" : status.uname, "password" : status.upassword, "userData": userData }))
        							break;
        					}
        				})
        	.fail(function(jqXHR, textStatus, errorThrown) { console.log("text status:" + textStatus); console.log("error thrown: " + errorThrown); deferredGetUser.reject(); });
}

// Update an existing User.  On success, return a new User object (because the password may have been changed in editing).

function updateUser_Async (userName, password, userData, deferredUpdateUser) {
	return $.get(serverUrl() + "update_user/" + userName, {password: password, udata: userData, uemail: eval("(" + userData + ")").uEmail})
        	.done(function () { deferredUpdateUser.resolve(new ht.User({ "userName" : userName, "password" : password, "userData": eval("(" + userData + ")") })); })
        	.fail(function () { deferredUpdateUser.reject(); });
}

// Tell the server the user forgot his password.

function userForgotPassword_Async(userName,deferredForgotPassword) {
	return $.get(serverUrl() + "forgot_password/" + userName)
			.done(function (status) { deferredForgotPassword.resolve(status); })
			.fail(function () { deferredForgotPassword.reject(); });
}

function mostRecentScenarioNameKey(userName) {
    return userName + "_mostRecentScenarioName";
}

function workingCopyStorageKey(userName) {
    return userName + "_workingCopy";
}

function authoritativeCopyStorageKey(userName, scenarioName) {
    return userName + "+" + scenarioName;
}
	
// Fetches the given user's current working copy from browser local storage and returns it.
function getScenarioWorkingCopy(userName) {
    return localStorage.getItem(workingCopyStorageKey(userName));
}

// Saves the given scenario as the given user's working copy in browser local storage.
function saveScenarioWorkingCopy(userName, scenario) {
    var j = JSON.stringify(scenario.stringifyScenario());
    localStorage.setItem(workingCopyStorageKey(userName), j);
}

// Both getScenario and getCurrentScenario (which calls getScenario) return a JSONified version of the scenario using a scenario key
// formed from the function arguments.

// Returns a promise of a stringified scenario.
// scenarioName is just the name without the userName being prepended to it.
// deferredGetScenario is a deferred object which can be resolved or rejected based on the server's response.

function getScenario_Async(userName, password, scenarioName, deferredGetScenario) {
    // TODO(jleen): Sanitize scenarioKey.
    return $.get(serverUrl() + "scenario/" + userName + "/" + scenarioName, { password: password })
    		.done(function (JSONifiedScenario) { deferredGetScenario.resolve(JSONifiedScenario); })
        	.fail(function () { deferredGetScenario.reject(null); });
}

// Get a scenario using its permalink (global unique scenario ID).
function getScenarioWithPermalink_Async(permalink, deferredGetPermalink) {
    return $.ajax({ url: 		serverUrl() + "permalink/" + permalink,
    				type:		"GET",
    				cache:		false,
    				headers:	{ "If-None-Match": undefined } // Needed to forestall server from CORS violation
    			  })
    		.done(function (JSONifiedScenario) { deferredGetPermalink.resolve(JSONifiedScenario); })
        	.fail(function () { deferredGetPermalink.reject(null); });
}

// Get a scenario's permalink (it's not saved in the scenario itself).
function getPermalink_Async(userName, password, scenarioName, deferredGetPermalink) {
	return $.get(serverUrl() + "get_permalink/" + userName + "/" + scenarioName, { password: password })
			.done(function (permalink) { 
						// server returns object { permalink: permalink_integer }
						permalink = permalink.permalink; // We only care about the value
						deferredGetPermalink.resolve(permalink); 
					}
			)
			.fail(function () {  deferredGetPermalink.reject(null); });
}

// saveCurrentScenario saves the current scenario to storage (localStorage initially, but eventually the server).
//		newScenario				true iff this is a new scenario being created, false if it is an existing scenario being updated
//		deferredSaveScenario	deferred object to be resolved/rejected based on server's response
// 
// Returns a promise of nothing.
function saveScenario_Async(userName, password, scenarioName, scenario, newScenario, deferredSaveScenario) {
    var j = JSON.stringify(scenario.stringifyScenario());
    return saveScenarioJson_Async(userName, password, scenarioName, j, newScenario, deferredSaveScenario);
}

function saveScenarioJson_Async(userName, password, scenarioName, scenarioJson, newScenario, deferredSaveScenario) {
    var data = new FormData();
    data.append('password',password);
    data.append('newscenario',newScenario);
    data.append('data',scenarioJson);

	return $.ajax({
            url: serverUrl() + "update_scenario/" + userName + "/" + scenarioName, 
            type: "POST",
            contentType: false,
            processData: false,
            cache: false,
            data: data
        })
    		.done(function () { deferredSaveScenario.resolve(); }) 
    		.fail(function () { deferredSaveScenario.reject(); });
}

// makeScenarioUniqueForThisUser_Async is called after loading a permalinked scenario.  It invokes a function on the server 
// that checks whether the permalinked scenario is owned by the given user.  If it is, the server function returns without any further 
// action.  If it is not, then the server checks whether the user has a scenario of that same name.  If s/he doesn't, then the server saves the 
// scenario with its original name.  If the user has a scenario with the same name, then the server keeps appending integers until it finds one 
// that makes the scenario name unique for that user (e.g., if the user has a scenario "foo", the server will try "foo1," "foo2," etc. until it 
// finds a unique name).
//
// The "result" returned by the server is an object as follows:
//		{ nameChanged:	true if the server had to create a new name for the scenario; false otherwise 
//		  newName:		newly generated scenario name (if nameChanged == true), else ""
//		}

function makeScenarioUniqueForThisUser_Async(user, permalink, deferredMakeScenarioUniqueForThisUser) {
	return $.get(serverUrl() + "make_scenario_unique/" + user.userName + "/" + permalink)
			.done(function (result) { deferredMakeScenarioUniqueForThisUser.resolve(result); }) 
    		.fail(function () { deferredMakeScenarioUniqueForThisUser.reject(); });
}

// deleteScenario_Async deletes the named scenario (localStorage initially, but eventually the server).
//
// Returns a promise of nothing, which is resolved when the delete completes.
function deleteScenario_Async(userName, password, scenarioName) {
	return $.ajax({
            url: serverUrl() + "scenario/" + userName + "/" + scenarioName,
            type: 'DELETE'
        });
}

// renameScenario_Async renames the scenario originally identified by key oldKey to be identified by newKey.
//
// Returns a promise of nothing.

function renameScenario_Async(userName, oldScenarioName, newScenarioName, scenario,deferredRenameScenario) {
	var data = new FormData();
    data.append('data',JSON.stringify(scenario.stringifyScenario()));

	return $.ajax({
            url: serverUrl() + "rename_scenario/" + userName + "/" + oldScenarioName + "/" + newScenarioName, 
            type: "POST",
            contentType: false,
            processData: false,
            cache: false,
            data: data
        })
			.done(function () { deferredRenameScenario.resolve(); })
    		.fail(function () { deferredRenameScenario.reject(); });
}
	
function setMostRecentScenarioName(userName, scenarioName) {
    localStorage.setItem(mostRecentScenarioNameKey(userName), scenarioName);
}

function getMostRecentScenarioName(userName) {
    return localStorage.getItem(mostRecentScenarioNameKey(userName));
}

function getScenarioList_Async(userName, password, deferredGetScenarioList) {
    return $.get(serverUrl() + "scenario/" + userName, {password: password})
    		.done(function (JSONifiedScenarioList) { 
    			var scenarioList = $.parseJSON(JSONifiedScenarioList);
    			var scenarioNamesOnly = [];
    			for (var i=0; i < scenarioList.length; i++) {
    				scenarioNamesOnly[i] = scenarioList[i].name; // Make array of just the scenario names -- don't include version #s
    			}
    			deferredGetScenarioList.resolve(scenarioNamesOnly); 
    		})
        	.fail(function () { 
        		deferredGetScenarioList.reject(null); 
        	});
}

// Upload a file (icon, image, video, audio) to server.  Parameters:
//	externalFile			ExternalFile object describing the external file (see historical_time.js)
//	fileObject				File object returned from <input type="file>
//	deferredSavedToServer	jQuery deferred object via which to signal success or failure 
//	Success return:
//	url						Full URL of file on server side

function saveExternalFile_Async(externalFile,fileObject,deferredSavedToServer) {
	var data = new FormData();
    data.append('data', fileObject);

	return $.ajax({
            url: serverUrl() + "save_file/" + externalFile.fileName,
            type: "POST",
            contentType: false,
            processData: false,
            cache: false,
            data: data
        })
		 .done(function () { deferredSavedToServer.resolve(serverUrl() + "get_file/" + externalFile.fileName); })
		 .fail(function () { deferredSavedToServer.reject(null); });
}

// Delete an external file (icon, image, video, audio) from server.  Parameters:
//	externalFile			ExternalFile object describing the external file (see historical_time.js)
//	deferredDeleteFile		jQuery deferred object via which to signal success or failure 

function deleteExternalFile_Async(externalFile,deferredDeleteFile) {
	 return $.get(serverUrl() + "delete_file/" + externalFile.fileName)
    		 .done(function () { deferredDeleteFile.resolve(); })
        	 .fail(function () { deferredDeleteFile.reject(); });
}

// Make a copy of an existing external file under a new name.  Arguments:
//		translation			{ oldXF: (original external file object), newXF: (new external file object) }
//		deferredCopyFile	jQuery deferred object via which to signal success or failure 
//	Success return:
//	url						Full URL of file on server side

function copyExternalFile_Async(translation,deferredCopyFile) {
	 return $.get(serverUrl() + "copy_file/" + translation.oldXF.fileName + "/" + translation.newXF.fileName)
    		 .done(function () { deferredCopyFile.resolve(serverUrl() + "get_file/" + translation.newXF.fileName); })
        	 .fail(function () { deferredCopyFile.reject(); });
}

// getCommonIcons_Async gets the HiM common icons.  In fact, these are the icons in the MyIcons element of the user object for the HiM System Admin.
// To keep the server as dumb as possible, the server will just return the entire user object for "HiM" (the system admin) and this function will extract 
// the MyIcons element and return that to the caller upon success.

function getCommonIcons_Async(deferredGetCIL) {
	return $.get(serverUrl() + "get_CIL/")
			.done(function (status) { 
									var userData = eval("(" + status.data + ")");
									var user = new ht.User({ "userName" : status.uname, "password" : status.upassword, "userData": userData });
									deferredGetCIL.resolve(user.MyIcons)
								})
			.fail(function(jqXHR, textStatus, errorThrown) { console.log("text status:" + textStatus); console.log("error thrown: " + errorThrown); deferredGetCIL.reject(); });

}

// saveMap_Async takes three arguments:
// The first argument is always an object with the map options, as follows:
//			mapOptions:
//							mapOptions.manager			"MapTiler" or "GME" (Google Maps Engine)
//							mapOptions.title			Map's unique title 
//							mapOptions.desc				Text description of map
// 		The remaining options depend on the value of mapOptions.manager.  
//			For mapOptions.manager = "GME":
//							mapOptions.GME_ID			Google Maps Engine's mapID for this map 			
//							mapOptions.GME_layer_key 	Google Maps Engine's layer key for this map (GME usually provides this as an array, but we only take one layer per map, so this value is a scalar)
//							mapOptions.initial_zoom 	Initial zoom setting to view this map
//							mapOptions.lat 				Latitude of map center
//							mapOptions.lng 				Longitude of map center
//			There are no other options when  mapOptions.manager = "MapTiler".
// The second argument depends of mapOptions.manager:
//							"MapTiler":		The binary contents of the MapTiler zip file (see www.maptiler.com for a description of the directory 
//												structure 
//							"GME":			undefined
// The last argument is always a Deferred object to use for signaling success or failure (no result is returned).

function saveMap_Async(mapOptions,file,deferredSaveMap) {
    var data = new FormData();
    data.append('options', JSON.stringify(mapOptions));
    data.append('manager', mapOptions.manager);
    data.append('data', file);

	return $.ajax({
            url: serverUrl() + "save_map/",
            type: "POST",
            contentType: false,
            processData: false,
            cache: false,
            data: data
        }).done(function () { deferredSaveMap.resolve(); })
          .fail(function () { deferredSaveMap.reject(); });
}


// getMaps_Async gets a list consisting of objects of the form { mapID: xxx, mapdata: yyy } where xxx is the map's global ID and yyy is the map's data 
// in the server database.  It returns to the caller a list of objects of the form {mapID: xxx, "map-prop-1": value, ..., "map-prop-N": value }, where 
// each "map-prop-i" is a property of that type of map.  See saveMap_Async for the properties of the different map manager types.

function getMaps_Async (deferredGetMaps) {
	return $.get(serverUrl() + "get_maps/")
			.done(function (mapListFromServer) { 
					var maps = [];	// The result for the caller
					if (mapListFromServer.length > 0) {
						for (var i=0; i < mapListFromServer.length; i++) {
							maps[i] = $.parseJSON(mapListFromServer[i].mapdata); // De-JSONify the mapdata object
							maps[i].mapID = mapListFromServer[i].mapID;
						}
					}
					deferredGetMaps.resolve(maps); })
			.fail(function () { deferredGetMaps.reject(); });
}

// getMap_Async gets the server's map entry for one map whose global mapID is the parameter mapID.  It returns a single map object; see saveMap_Async 
// for the map type-specific properties.

function getMap_Async (mapID,deferredGetMap) {
	return $.get(serverUrl() + "get_map/" + mapID)
			.done(function (mapFromServer) { 
					var map = $.parseJSON(mapFromServer.mapdata); // De-JSONify the mapdata object
					map.mapID = mapFromServer.mapID;
					deferredGetMap.resolve(map); })
			.fail(function () { deferredGetMap.reject(); });
}

// getMTMapURL takes a global mapID and returns a function which takes a MapTiler vector (x,y,z) where z is the zoom and x and y are the MapTiler 
// coordinates of a segment of the entire map, and returns a string which is the URL for MapTiler's runtime to invoke to get that map segment.  
// Neither getMTMapURL nor the function it returns retrieve the map segment itself, and getMTMapURL is NOT asynchronous.  

function getMTMapURL(mapID) {
	return function (x,y,z) { return serverUrl() + "get_MT_segment/" + mapID + "/" + z + "/" + x + "/" + y; };
}


return {
    createNewUser_Async: createNewUser_Async,
    getUser_Async: getUser_Async,
    updateUser_Async: updateUser_Async,
    userForgotPassword_Async: userForgotPassword_Async,
    getScenarioWorkingCopy: getScenarioWorkingCopy,
    saveScenarioWorkingCopy: saveScenarioWorkingCopy,
    getScenario_Async: getScenario_Async,
    getPermalink_Async: getPermalink_Async,
    getScenarioWithPermalink_Async: getScenarioWithPermalink_Async,
    makeScenarioUniqueForThisUser_Async: makeScenarioUniqueForThisUser_Async,
    saveScenario_Async: saveScenario_Async,
    saveScenarioJson_Async: saveScenarioJson_Async,
    deleteScenario_Async: deleteScenario_Async,
    renameScenario_Async: renameScenario_Async,
    setMostRecentScenarioName: setMostRecentScenarioName,
    getMostRecentScenarioName: getMostRecentScenarioName,
    getScenarioList_Async: getScenarioList_Async,
    saveExternalFile_Async: saveExternalFile_Async,
    deleteExternalFile_Async: deleteExternalFile_Async,
    copyExternalFile_Async: copyExternalFile_Async,
    getCommonIcons_Async: getCommonIcons_Async,
    saveMap_Async: saveMap_Async,
    getMaps_Async: getMaps_Async,
    getMap_Async: getMap_Async,
    getMTMapURL: getMTMapURL
};

});
