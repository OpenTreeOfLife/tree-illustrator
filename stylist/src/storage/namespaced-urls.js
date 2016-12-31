/*
 * This is the default host adapter for a standalone web-app (all logic is
 * client-side JS) using web services from the OpenTree APIs. This includes a
 * storage backend based on peyotl[1] and phylesystem[2] conventions for a
 * "folderish" illustration type:
 *
 * Each object ID is unique, but this might be a subpath and web-slug[3]. So
 * there might be multiple illustrations called 'my-favorite', but they'd need
 * to be under different subpaths (per user, or based on some other grouping).
 *
 * [1] peyotl
 * [2] phylesystem
 * [3] web slug
 */

/* The methods below constitute a general API for the Tree Illustrator. 
 * These should support asynchronous operations via callbacks. When defining
 * function names and arguments, keep in mind that we expect to build parallel
 * implementations in other contexts (e.g., within a dedicated website or the
 * Tools tab of the OpenTree curation app).
 *
 * Generally speaking, each callback expets a single object with 'data' or
 * 'error' properties, but not both. Details for 'data' are specific to each
 * method.
 */

// Return a sensible error from placeholder methods
var notImplementedResponse = {
    error:"Not yet implemented in this storage backend!"
};

/* Manage illustrations from the current docstore (phylesystem via its API).
 * N.B. that these methods are used to manage a few subtypes (illustrations,
 * templates, style guides, etc.) in a uniform way.
 */
var illustrationAPIBaseURL = "https://devapi.opentreeoflife.org";
var listAllIllustrations_url = illustrationAPIBaseURL + '/v3/illustrations/list_all';
var createIllustration_POST_url = illustrationAPIBaseURL + '/v3/illustration';
var loadIllustration_GET_url = illustrationAPIBaseURL + '/v3/illustration/{DOC_ID}';
var updateIllustration_PUT_url = illustrationAPIBaseURL + '/v3/illustration/{DOC_ID}';
var deleteIllustration_DELETE_url = illustrationAPIBaseURL + '/v3/illustration/{DOC_ID}';
/* Manage sub-resources for complex types, e.g. supporting data for an illustration */
var createFile_POST_url = illustrationAPIBaseURL + '/v3/illustration/{DOC_ID}/file';
var loadFile_GET_url = illustrationAPIBaseURL + '/v3/illustration/{DOC_ID}/file/{FILE_ID}';
var updateFile_PUT_url = illustrationAPIBaseURL + '/v3/illustration/{DOC_ID}/file/{FILE_ID}';
var removeFile_DELETE_url = illustrationAPIBaseURL + '/v3/illustration/{DOC_ID}/file/{FILE_ID}';

/* Most operations (beyond a simple fetch) will require the user to be logged
 * in via GitHub. Store their id, name, and credentials here.
 */
var githubAPIBaseURL = 'https://api.github.com';
var getGitHubToken_url = githubAPIBaseURL + '/authorizations';
var getGitHubUserInfo_url = githubAPIBaseURL + '/user';
var userDisplayName,
    userID,
    userEmail,
    userAuthToken;
var githubTokenProps = {
    "scopes": ["public_repo"], 
    "note": "Tree Illustrator ("+ window.location.hostname +")",
    "fingerprint": "tree-illustrator-one-time-token"
}
function getUserDisplayName() {
    return userDisplayName;
}
function getUserID() {
    return userID;
}
function getUserEmail() {
    return userEmail;
}
function loginToGitHub( username, password ) {
    // TODO: Accept stored username+password?
    var $popup = $('#github-login-popup');
    $popup.find(':input').val('');  // clear any old values
    $popup.find('#github-authorize').unbind('click').click(function() {
        // N.B. we need to encode credentials to Base64 for the Auth header
        var username = $.trim( $popup.find('#github-userid').val() );
        var password = $.trim( $popup.find('#github-password').val() );
        var b64credentials = btoa( username+':'+password );
        // N.B. atob(b64header) should cleanly restore the input values
        var basicAuthHeaders = {
            "Authorization": "Basic "+ b64credentials
        }
        var deletePriorAuthToken = function() {
            /* We call this if we're blocked (below) from creating a new OAuth
             * token by the presence of a stale one with the same properties.
             */
            $.ajax({
                type: 'GET',
                url: getGitHubToken_url,
                headers: basicAuthHeaders,
                //data: {},
                //crossdomain: true,
                //contentType: "application/json; charset=utf-8",
                success: function( data ) {  // success callback
                    // TODO: Find the id of the existing token with my properties
                    var staleTokenID = null;
                    $.each(data, function(i, tokenInfo) {
                        if ((tokenInfo.app.name === githubTokenProps.note) &&
                            (tokenInfo.fingerprint === githubTokenProps.fingerprint)) {
                            staleTokenID = tokenInfo.id;
                            return false;
                        }
                    });
                    if (!staleTokenID) {
                        alert("Unknown error clearing old GitHub OAuth token. Please wait a moment and try again");
                        return;
                    }
                    $.ajax({
                        type: 'DELETE',
                        url: (getGitHubToken_url +"/"+ staleTokenID),
                        headers: basicAuthHeaders,
                        // This really shouldn't go wrong..
                        complete: function( jqXHR, textStatus ) {
                            // Try again to create a new token
                            createNewAuthToken();
                        }
                    });
                    return;
                },
                error: function( jqXHR, textStatus, errorThrown ) {
                    if (errorThrown == 'Unauthorized') {
                        alert("GitHub credentials not recognized! Please try again.");
                    } else {
                        alert("Unknown error contacting GitHub. Please wait a moment and try again");
                    }
                },
                // complete: function( jqXHR, textStatus ) { }
            });
        }
        var createNewAuthToken = function() {
            /* Call GitHub API to generate a new OAuth token for this user.  Note
             * that we're getting a general "personal access" token for this user,
             * not something application-specific since that would require exposing
             * its client secret, as described here:
             *   https://developer.github.com/v3/oauth_authorizations/#get-or-create-an-authorization-for-a-specific-app
             */
            $.ajax({
                type: 'POST',
                url: getGitHubToken_url,
                data: JSON.stringify( githubTokenProps ),
                /* NOTE that we can't use jQuery's newer `username` and `password` 
                 * properties here, since the GitHub API won't present an auth
                 * challenge. Instead, we'll need to pre-emptively send the user's
                 * credentials in our first request.
                 */
                headers: basicAuthHeaders,
                //crossdomain: true,
                //contentType: "application/json; charset=utf-8",
                success: function( data ) {  // success callback
                    // raw response should be JSON
                    userAuthToken = data.token;
                    ///console.warn(">>> GitHub OAuth token: "+ userAuthToken);
                    $popup.find(':input').val('');
                    $popup.modal('hide');
                    // Use the new token to fetch user id, display name, email(?)
                    $.ajax({
                        type: 'GET',
                        url: getGitHubUserInfo_url,
                        headers: {
                            "Authorization": "Token "+ userAuthToken
                        },
                        success: function(data) {
                            // These should have proper values
                            userDisplayName = data.name || "NAME_NOT_FOUND";
                            userID = data.login || "USERID_NOT_FOUND";
                            userEmail = data.email || "EMAIL_NOT_FOUND";
                        },
                        complete: function() {
                            // TODO: Update UI to show that we're now logged in (show Save buttons, etc.)
                            console.warn("Now I'd update the UI!");
                        }
                    });
                },
                error: function( jqXHR, textStatus, errorThrown ) {
                    switch (errorThrown) {
                        case 'Unauthorized':  // 401
                            alert("GitHub credentials not recognized! Please try again.");
                            break;
                        case 'Unprocessable Entity':  // 422
                            console.warn("This token already exists! Clobbering old token to retry...");
                            // NOTE that this will search-and-destroy the old token, then retry.
                            deletePriorAuthToken();
                            break;
                        default:
                            alert("Unknown error '"+ errorThrown +"' ("+ jqXHR.status +") contacting GitHub. Please wait a moment and try again");
                    }
                    return;
                }
            });
        };
        // Start the process, using local funcs and credentials
        createNewAuthToken();
    });
    $popup.modal('show');
}


function getIllustrationList(callback) {
    /* The 'data' (if successful) should be an array of objects, each with
     * 'name', 'description', and 'source' properties.
     */
    // Until we have a fast index, fetch the complete illustration list from the illustrations API
    // https://devapi.opentreeoflife.org/v3/illustrations/list_all
    var resp = {};
    // 'callback' expects a single obj with 'data' or 'error' properties
    $.ajax({
        type: 'GET',
        url: listAllIllustrations_url,
        //crossdomain: true,
        //contentType: "application/json; charset=utf-8",
        success: function( data ) {  // success callback
            // convert raw response to JSON
            var foundIllustrations = $.parseJSON(data);
            resp.data = [ ];
            if (foundIllustrations.length) {
                // TODO: Convert these properties to the more generic ones expected
                // by the Tree Illustrator (name, description, source)
                console.warn('=== found '+ resultsJSON.length +' illustrations ===');
                $.each( data, function(i, illustrationInfo) {
                    console.warn(illustrationInfo);
                });
            } else if ($.isArray(foundIllustrations)) {
                console.warn('=== no illustrations found ===');
            } else {
                console.error('=== invalid response! ===');
                console.error(foundIllustrations);
            }
        },
        error: function( jqXHR, textStatus, errorThrown ) {
            resp.error = "Unable to load illustration list!";
        },
        complete: function( jqXHR, textStatus ) {
            callback(resp);
        }
    });
/* Here's a dummy list (for test purposes only)
    callback({data: [
        {
            name: 'Example one',
            description: 'This is something special!',
            source: 'blah/foo'
        },
        {
            name: 'Example two',
            description: 'This is also something special!',
            source: 'blah/foo2'
        },
        {
            name: 'Example three',
            description: 'This too is something special!',
            source: 'blah/foo3'
        }]
    });
*/
}

function loadIllustration(id, callback) {
    callback(notImplementedResponse);
}

function saveIllustration(illustrationID, callback) {
    // 'callback' should expect a single obj with 'data' or 'error' properties)
    // TODO: support save, save-as, copy?

    // add this user to the authors list, if not found
    // TODO: add email or userid here, so we can link to authors?
    var listPos = $.inArray( userDisplayName, stylist.ill.metadata.authors() );
    if (listPos === -1) {
        stylist.ill.metadata.authors.push( userDisplayName );
    }

    // TODO: add a "scrubber" as we do for OpenTree studies? 
    // scrubIllustrationForTransport(stylist.ill);

    // flatten the current illustration to simple JS using our 
    // Knockout mapping options
    var clonableIllustration = ko.mapping.toJS(stylist.ill);


    //callback(notImplementedResponse);
    callback({
        error:"FOO (move this!)"
    });


    // Are we creating a new one, or updating an existing one?
    if (illustrationID && typeof(illustrationID) === 'string') {
        // Update the existing illustration
        var saveURL = updateIllustration_PUT_url.replace('{DOC_ID}', illustrationID);
        /* TODO? gather commit message (if any) from pre-save popup
        var commitMessage;
        var firstLine = $('#save-comment-first-line').val();
        var moreLines = $('#save-comment-more-lines').val();
        if ($.trim(firstLine) === '') {
            commitMessage = $.trim(moreLines);
        } else if ($.trim(moreLines) === ''){
            commitMessage = $.trim(firstLine);
        } else {
            commitMessage = $.trim(firstLine) +"\n\n"+ $.trim(moreLines);
        }
        */

        // add non-Nexson values to the query string
        var qsVars = $.param({
            author_name: userDisplayName,
            author_email: userEmail,
            auth_token: userAuthToken,
            starting_commit_SHA: stylist.ill.startingCommitSHA,
            commit_msg: 'Saved from Tree Illustrator'       // add version?
        });
        saveURL += ('?'+ qsVars);

        $.ajax({
            global: false,  // suppress web2py's aggressive error handling
            type: 'PUT',
            dataType: 'json',
            // crossdomain: true,
            contentType: "application/json; charset=utf-8",
            url: saveURL,
            processData: false,
            data: ('{"illustration":'+ JSON.stringify(clonableIllustration) +'}'),  // TODO: some kind of wrapper needed?
            complete: function( jqXHR, textStatus ) {
                // report errors or malformed data, if any
                if (textStatus !== 'success') {
                    if (jqXHR.status >= 500) {
                        // major server-side error, just show raw response for tech support
                        /*
                        var errMsg = 'Sorry, there was an error saving this illustration. <a href="#" onclick="toggleFlashErrorDetails(this); return false;">Show details</a><pre class="error-details" style="display: none;">'+ jqXHR.responseText +'</pre>';
                        hideModalScreen();
                        showErrorMessage(errMsg);
                        */
                        alert("Sorry, there was an error saving this illustration:\n\n"+ jqXHR.responseText);
                        return;
                    }
                    // Server blocked the save, probably due to validation errors!
                    var data = $.parseJSON(jqXHR.responseText);
                    // TODO: this should be properly parsed JSON, show it more sensibly
                    // (but for now, repeat the crude feedback used above)
                    /*
                    var errMsg = 'Sorry, there was an error in the study data. <a href="#" onclick="toggleFlashErrorDetails(this); return false;">Show details</a><pre class="error-details" style="display: none;">'+ jqXHR.responseText +'</pre>';
                    hideModalScreen();
                    showErrorMessage(errMsg);
                    */
                    alert("Sorry, there was an error in the illustration data:\n\n"+ jqXHR.responseText);
                    return;
                }
                var putResponse = $.parseJSON(jqXHR.responseText);
                viewModel.startingCommitSHA = putResponse['sha'] || viewModel.startingCommitSHA;
                /*
                // update the History tab to show the latest commit
                if ('versionHistory' in putResponse) {
                    viewModel.versions(putResponse['versionHistory'] || [ ]);
                }
                */
                if (putResponse['merge_needed']) {
                    var errMsg = 'Your changes were saved, but an edit by another user prevented your edit from merging to the publicly visible location. In the near future, we hope to take care of this automatically. In the meantime, please <a href="mailto:info@opentreeoflife.org?subject=Illustration%20merge%20needed%20-%20'+ viewModel.startingCommitSHA +'">report this error</a> to the Open Tree of Life software team';
                    /* TODO: make this a cleaner, more friendly display (with active mailto: hyperlink)
                    hideModalScreen();
                    showErrorMessage(errMsg);
                    */
                    alert(errMsg);
                    return;
                }
                // presume success from here on
                //hideModalScreen();
                //showSuccessMessage('Study saved to remote storage.');
                /* TODO: Block page-exit on unsaved changes?
                popPageExitWarning('UNSAVED_STUDY_CHANGES');
                studyHasUnsavedChanges = false;
                disableSaveButton();
                */
                // TODO: update viz?
            }
        });
    } else {
        // Store the new illustration
        $.ajax({
            global: false,  // suppress web2py's aggressive error handling
            type: 'POST',
            dataType: 'json',
            // crossdomain: true,
            // contentType: "application/json; charset=utf-8",
            url: createIllustration_POST_url,
            data: {
                // misc identifying information
                'author_name': (userDisplayName || ""),
                'author_email': (userEmail || ""),
                'auth_token': (userAuthToken || ""),
                'json': JSON.stringify(clonableIllustration)
            },
            success: function( data, textStatus, jqXHR ) {
                // creation method should return either a redirect URL to the new illustration, or an error
                //hideModalScreen();

                console.log('saveIllustration(): done! textStatus = '+ textStatus);
                // report errors or malformed data, if any
                if (textStatus !== 'success') {
                    alert('Sorry, there was an error creating this illustration.');
                    return;
                }

                /*
                alert('Illustration created, redirecting now....');
                // bounce to the new illustration, to load it normally?
                window.location = "/curator/study/edit/"+ data['resource_id'];
                */
            },
            error: function( data, textStatus, jqXHR ) {
                //hideModalScreen();
                var errMsg; 
                if ((typeof(jqXHR.responseText) !== 'string') || jqXHR.responseText.length === 0) {
                    errMsg = 'Sorry, there was an error creating this illustration. (No more information is available.)';
                } else {
                    errMsg = 'Sorry, there was an error creating this illustration:\n\n '+ jqXHR.responseText;
                }
                alert(errMsg);
            }
        });
    }
    

}

// Get user-friendly list of available source data for trees, etc.?

function getTreeSourceList(callback) {
    // 'callback' should expect a single obj with 'data' or 'error' properties)
    callback(notImplementedResponse);
}
function getTreeSourceData(id, callback) {
    // 'callback' should expect a single obj with 'data' or 'error' properties)
    callback(notImplementedResponse);
}

function getSupplementalDataSourceList(id, callback) {
    // 'callback' should expect a single obj with 'data' or 'error' properties)
    callback(notImplementedResponse);
}
function getSupplementalDataSourceValue(id, callback) {
    // 'callback' should expect a single obj with 'data' or 'error' properties)
    callback(notImplementedResponse);
}

function getOrnamentSourceList(id, callback) {
    // 'callback' should expect a single obj with 'data' or 'error' properties)
    callback(notImplementedResponse);
}
function getOrnamentSourceValue(id, callback) {
    // 'callback' should expect a single obj with 'data' or 'error' properties)
    callback(notImplementedResponse);
}

// Expose some members to outside code (eg, Knockout bindings, onClick
// attributes...)
var api = [
    // expected API for storage backend
    'getIllustrationList',
    'loadIllustration',
    'saveIllustration',
    // auth information (specific to this backend?)
    'getUserDisplayName',
    'getUserID',
    'getUserEmail',
    //'userAuthToken'
    'loginToGitHub',
    /* TODO: Add providers for minor types?
    'getTreeSourceList',
    'getTreeSourceData',
    'getSupplementalDataSourceList',
    'getSupplementalDataSourceData',
    'getOrnamentSourceList',
    'getOrnamentSourceData',
     */
];
$.each(api, function(i, methodName) {
    // populate the default 'module.exports' object
    exports[ methodName ] = eval( methodName );
});
