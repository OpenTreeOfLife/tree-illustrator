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
var utils = require('../ti-utils'),
    JSZip = require('jszip');

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
/* Manage sub-resources (opaque files) within complex types, e.g. supporting
 * data for an illustration.
 *
 * N.B. We'll use PUT (vs. POST) for creation *and* updates, since we'll
 * specify the desired file-path in the URL. Any subsequent PUTs to this URL
 * will update the resource stored there.
 */
//var createFile_POST_url = illustrationAPIBaseURL + '/v3/illustration/{DOC_ID}/file';
var createOrUpdateFile_PUT_url = illustrationAPIBaseURL + '/v3/illustration/{DOC_ID}/{FILE_PATH}';
var loadFile_GET_url = illustrationAPIBaseURL + '/v3/illustration/{DOC_ID}/{FILE_PATH}';
var removeFile_DELETE_url = illustrationAPIBaseURL + '/v3/illustration/{DOC_ID}/{FILE_PATH}';

// Use a known-good URL fragment to extract an illustration ID from its API URL
var illustrationURLSplitterAPI = '/illustration/';
// Fall back to raw-data URL in some cases
var illustrationURLSplitterRaw = '/docs-by-owner/';  // or 'illustrations'?

function getIllustrationIDFromURL(url) {
    // anything after the known API endpoint is a illustration ID
    var fromAPI = url.split( illustrationURLSplitterAPI )[1];
    var fromRawData = url.split( illustrationURLSplitterRaw )[1];
    if (fromRawData) {
        // strip file extension
        fromRawData = fromRawData.split('.json')[0];
    }
    return fromAPI || fromRawData;
}

/* Most operations (beyond a simple fetch) will require the user to be logged
 * in via GitHub. Store their id, name, and credentials here.
 */
var githubAPIBaseURL = 'https://api.github.com';
var getGitHubToken_url = githubAPIBaseURL + '/authorizations';
var getGitHubUserInfo_url = githubAPIBaseURL + '/user';
var userDisplayName = ko.observable(),
    userLogin = ko.observable(),
    userEmail = ko.observable(),
    userAuthToken;
var githubTokenProps = {
    "scopes": ["public_repo"], 
    "note": "Tree Illustrator ("+ window.location.hostname +")",
    "fingerprint": "tree-illustrator-"+ window.location.hostname +"-one-time-token"
}
function userHasStorageAccess() {
    return userLogin() && (userLogin() !== 'LOGIN_NOT_FOUND');
}

function loginToGitHub() {
    // N.B. we need to encode credentials to Base64 for the Auth header
    var $popup = $('#storage-options-popup');
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
                    //if ((tokenInfo.app.name === githubTokenProps.note) && ...
                    if (tokenInfo.fingerprint === githubTokenProps.fingerprint) {
                        staleTokenID = tokenInfo.id;
                        return false;
                    }
                });
                if (!staleTokenID) {
                    console.warn("Unknown error clearing old GitHub OAuth token. Probably just a 404 error, no need for action.");
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

                // Use the new token to fetch user id, display name, email(?)
                $.ajax({
                    type: 'GET',
                    url: getGitHubUserInfo_url,
                    headers: {
                        "Authorization": "Token "+ userAuthToken
                    },
                    success: function(data) {
                        // These should now have proper values
                        userDisplayName(data.name || "NAME_NOT_FOUND");
                        userLogin(data.login || "LOGIN_NOT_FOUND");
                        userEmail(data.email || "EMAIL_NOT_FOUND");
                        // clear the password-input field, hide login, show some contents
                        $popup.find('#github-password').val('');
                        $('#github-login-panel').hide();
                        $('#github-logged-in').show();
                    },
                    complete: function() {
                        // Anything else to do here?
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
}

function userIsLoggedIntoGitHub() {
    return !!userAuthToken;  // fails on "", null, undefined
}

function getDefaultGitHubIllustrationID( ) {
    // suggest an ID, based on prior storage *or* illustration name
    /* CURRENTLY UNUSED! but seems handy... */
    var priorStorageURL = stylist.ill.metadata.url();
    if (priorStorageURL) {
        return getIllustrationIDFromURL(priorStorageURL);
    }
    var nameSlug = slugify(stylist.ill.metadata.name());
    return (userLogin() +'/'+ nameSlug);
}

function slugify(str) {
    // Convert any string into a simplified "slug" suitable for use in URL or query-string
    return str.toLowerCase()
              .replace(/[^a-z0-9 -]/g, '')  // remove invalid chars
              .replace(/\s+/g, '-')         // collapse whitespace and replace by -
              .replace(/-+/g, '-');         // collapse dashes
}

function getIllustrationList(callback) {
    /* The 'data' (if successful) should be an array of objects, each with
     * 'name', 'description', and 'source' properties.
     */
    // Until we have a fast index, fetch the complete illustration list from the illustrations API
    // https://devapi.opentreeoflife.org/v3/illustrations/list_all
    // 'callback' expects a single obj with 'data' or 'error' properties
    var resp = {};
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
                console.warn('=== found '+ foundIllustrations.length +' illustrations ===');
                $.each( foundIllustrations, function(i, illustrationInfo) {
                    // build a rich HTML description block
                    /* Skipping this for now (a general GitHub URL to its folder would be better!)
                    var srcURL = 'https://devapi.opentreeoflife.org/v3/illustration/{ID}'
                                   .replace('{ID}', illustrationInfo['id']);
                    // TODO: Adapt the URL above to use matching API domain!
                    var descHTML = '<a href="{URL}" target="_blank" title="Click to see source in a new window">{ID}</a></div>'
                                     .replace('{URL}', srcURL)
                                     .replace('{ID}', illustrationInfo['id']);
                   */
                    var descHTML = '';
                    if (illustrationInfo.metadata['description']) {
                        descHTML += '<div class="github-description">{DESC}</div>'
                                      .replace('{DESC}', illustrationInfo.metadata['description']);
                    }
                    resp.data.push({
                        // use the expected properties for simple-chooser
                        name: illustrationInfo.metadata['name'],
                        description: descHTML,
                        source: illustrationInfo['id']
                    });
                });
            } else if ($.isArray(foundIllustrations)) {
                console.warn('=== no illustrations found ===');
            } else {
                console.error('=== invalid response! ===');
                console.error(foundIllustrations);
                resp.error = "Invalid response (illustration list): "+ foundIllustrations;
            }
        },
        error: function( jqXHR, textStatus, errorThrown ) {
            resp.error = "Unable to load illustration list!";
        },
        complete: function( jqXHR, textStatus ) {
            callback(resp);
        }
    });
}

function loadIllustration(id, callback) {
    // 'callback' expects a single obj with 'data' or 'error' properties
    var resp = {};
    $.ajax({
        global: false,  // suppress web2py's aggressive error handling
        type: 'GET',
        dataType: 'json',
        // crossdomain: true,
        // contentType: "application/json; charset=utf-8",
        url: loadIllustration_GET_url.replace('{DOC_ID}', id),
        data: {
            // misc identifying information
            'author_name': (userDisplayName() || ""),
            'author_email': (userEmail() || ""),
            'auth_token': (userAuthToken || "")
        },
        success: function( data, textStatus, jqXHR ) {
            // fetch method should return either the new illustration JSON, or an error
            //hideModalScreen();

            console.log('loadIllustration(): done! textStatus = '+ textStatus);
            // report errors or malformed data, if any
            if (textStatus !== 'success') {
                alert('Sorry, there was an error loading this illustration.');
                return;
            }

            // TODO: Add version history or other metadata?
            /* The callback provided will replace stylist.ill and rebind UI
             * and the rendering pipeline. It expects a response object with
             * 'data' or 'error'.
             */
            var ill = data['data'];  // illustration as JS object
            if (!ill) {  // TODO
                resp.error = "No illustration data found!";
                console.error(resp.error);
            } else {
                if (typeof(ill) === 'undefined') {
                    resp.error = "No illustration '"+ id +"' found!";
                } else {
                    resp.data = ill;
                }
            }
        },
        error: function( data, textStatus, jqXHR ) {
            //hideModalScreen();
            if ((typeof(jqXHR.responseText) !== 'string') || jqXHR.responseText.length === 0) {
                resp.error = 'Sorry, there was an error loading this illustration. (No more information is available.)';
            } else {
                resp.error = 'Sorry, there was an error loading this illustration:\n\n '+ jqXHR.responseText;
            }
        },
        complete: function( jqXHR, textStatus ) {
            callback(resp);
        }
    });
}

function saveIllustration(illustrationID, callback, options) {
    options = options || {FULL_ARCHIVE: true};
    // 'callback' expects a single obj with 'data' or 'error' properties
    var resp = {};
    // TODO: support save, save-as, copy?
    if (!userAuthToken) {
        // We can't save without a token; stop and prompt for login
        loginToGitHub();
        resp.error = "User not logged into GitHub! Prompting for login now."
        callback(resp);
        return;
    }
    // add this user to the authors list, if not found
    // TODO: add email or userid here, so we can link to authors?
    var listPos = $.inArray( userDisplayName(), stylist.ill.metadata.authors() );
    if (listPos === -1) {
        stylist.ill.metadata.authors.push( userDisplayName() );
    }

    // TODO: add a "scrubber" as we do for OpenTree studies? 
    // scrubIllustrationForTransport(stylist.ill);

    // flatten the current illustration to simple JS using our 
    // Knockout mapping options
    var clonableIllustration = ko.mapping.toJS(stylist.ill);

    // Are we creating a new one, or updating an existing one?
    var createOrUpdate;
    if (('sha' in stylist.ill.metadata) && stylist.ill.metadata.sha()) {
        // we're UPDATING an existing collection
        createOrUpdate = 'UPDATE';
    } else {
        // we're CREATING a new collection
        createOrUpdate = 'CREATE';
    }
    if (illustrationID && typeof(illustrationID) === 'string') {
        // update (or add) an internal URL with the specified ID, e.g. from Save As...
        clonableIllustration.metadata.url = illustrationURLSplitterAPI + illustrationID;
    } else if (clonableIllustration.metadata.url) {
        // we'll use the ID already stored in its URL
    } else {
        // we'll build a propsed url, based on the illustration's name
        var nameSlug = slugify(clonableIllustration.metadata.name);
        // build a fresh ID with current user as creator
        clonableIllustration.metadata.url = illustrationURLSplitterAPI + userLogin() +'/'+ nameSlug;
    }
    illustrationID = getIllustrationIDFromURL(clonableIllustration.metadata.url);

    // create a Zip archive, add the core document and static input data
    var archive = new JSZip();
    archive.file("main.json", JSON.stringify(clonableIllustration));
    // Test all input for repeatable provenance info; if any are lacking a
    // clear source, we should embed the source data here.
    var staticInputs = TreeIllustrator.gatherStaticInputData();
    if (options.FULL_ARCHIVE || (staticInputs.length > 0)) {
        // add some or all input data for this illustration
        var inputsToStore = options.FULL_ARCHIVE ? TreeIllustrator.gatherAllInputData() : staticInputs;
        $.each(inputsToStore, function(i, inputData) {
            var itsPath = inputData.path;
            var serialized = utils.serializeDataForSavedFile( inputData.value );
            archive.file(itsPath, serialized.value, serialized.options);
        });
    }
    if (options.FULL_ARCHIVE) {
        // add other cache entries (transformed data)
        ///var transformFolder = archive.folder('transform');
        var transformsToStore = TreeIllustrator.gatherAllTransformData();
        $.each(transformsToStore, function(i, transformData) {
            var itsPath = transformData.path;
            var serialized = utils.serializeDataForSavedFile( transformData.value );
            archive.file(itsPath, serialized.value, serialized.options);
        });
    }

    if (createOrUpdate === 'UPDATE') {
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
            author_name: userDisplayName(),
            author_email: userEmail(),
            auth_token: userAuthToken,
            starting_commit_SHA: stylist.ill.metadata.sha(),
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
            data: ('{"json":'+ JSON.stringify(clonableIllustration) +'}'),  // TODO: move auth info to this wrapper?
            complete: function( jqXHR, textStatus ) {
                // report errors or malformed data, if any
                if (textStatus !== 'success') {
                    if (jqXHR.status >= 500) {
                        // major server-side error, just show raw response for tech support
                        resp.error = "Sorry, there was an error saving this illustration:\n\n"+ jqXHR.responseText;
                        alert(resp.error);
                        callback(resp);
                        return;
                    }
                    // Server blocked the save, probably due to validation errors!
                    var data = $.parseJSON(jqXHR.responseText);
                    // TODO: this should be properly parsed JSON, show it more sensibly
                    // (but for now, repeat the crude feedback used above)
                    resp.error = "Sorry, there was an error in the illustration data:\n\n"+ jqXHR.responseText;
                    alert(resp.error);
                    callback(resp);
                    return;
                }
                var putResponse = $.parseJSON(jqXHR.responseText);
                var newCommitSHA = putResponse['sha'];
                if (newCommitSHA) {
                    stylist.ill.metadata.sha(newCommitSHA);
                }
                /* TODO: add 'versions' or 'metadata.versions' to record these commits?
                if ('versionHistory' in putResponse) {
                    stylist.ill.metadata.versions(putResponse['versionHistory'] || [ ]);
                }
                */
                if (putResponse['merge_needed']) {
                    var errMsg = 'Your changes were saved, but an edit by another user prevented your edit from merging to the publicly visible location. In the near future, we hope to take care of this automatically. In the meantime, please <a href="mailto:info@opentreeoflife.org?subject=Illustration%20merge%20needed%20-%20'+ newCommitSHA +'">report this error</a> to the Open Tree of Life software team';
                    /* TODO: make this a cleaner, more friendly display (with active mailto: hyperlink) */
                    alert(errMsg);
                    // NB, we treat this as a warning, but not a save error; return the data as expected!
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
                resp.data = putResponse;
                callback(resp);
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
                'author_name': (userDisplayName() || ""),
                'author_email': (userEmail() || ""),
                'auth_token': (userAuthToken || ""),
                'json': JSON.stringify(clonableIllustration)
            },
            success: function( data, textStatus, jqXHR ) {
                // creation method should return either a redirect URL to the new illustration, or an error
                //hideModalScreen();
                console.log('saveIllustration(): done! textStatus = '+ textStatus);
                // report errors or malformed data, if any
                if (textStatus !== 'success') {
                    resp.error = 'Sorry, there was an error creating this illustration.';
                    alert(resp.error);
                    callback(resp);
                    return;
                }

                // update the internal 'url' of the live illustration to match what was assigned
                // (API ensures uniqueness, typically by incrementing duplicate ids)
                // EXAMPLE:  https://api.opentreeoflife.org/v3/illustration/jimallman/my-illustration
                var assignedURL = data.resource_url;
                stylist.ill.metadata.url( assignedURL );
                var newCommitSHA = data['sha'];
                if (newCommitSHA) {
                    stylist.ill.metadata.sha(newCommitSHA);
                }
                // TODO: add 'versions' or 'metadata.versions' to record these commits?
            },
            error: function( data, textStatus, jqXHR ) {
                //hideModalScreen();
                if ((typeof(jqXHR.responseText) !== 'string') || jqXHR.responseText.length === 0) {
                    resp.error = 'Sorry, there was an error creating this illustration. (No more information is available.)';
                } else {
                    resp.error = 'Sorry, there was an error creating this illustration:\n\n '+ jqXHR.responseText;
                }
                alert(resp.error);
            },
            complete: function( data, textStatus, jqXHR ) {
                callback(resp);
            }
        });
    }
}


function deleteIllustration(illustrationID, callback) {
    // 'callback' should expect a single obj with 'data' or 'error' properties)
    var resp = {};

    if (!userAuthToken) {
        // We can't save without a token; stop and prompt for login
        loginToGitHub();
        resp.error = "User not logged into GitHub! Prompting for login now."
        callback(resp);
        return;
    }

    if (!illustrationID || typeof(illustrationID) !== 'string') {
        // we need this to clobber anything on GitHub
        resp.error = "deleteIllustration() needs a proper location string, not "+ illustrationID +" <"+ typeof(illustrationID) +">!";
        callback(resp);
        return;
    }

    // Delete the chosen illustration
    var deleteURL = deleteIllustration_DELETE_url.replace('{DOC_ID}', illustrationID);
    $.ajax({
        global: false,  // suppress web2py's aggressive error handling
        type: 'DELETE',
        dataType: 'json',
        // crossdomain: true,
        // contentType: "application/json; charset=utf-8",
        url: deleteURL,
        data: {
            // misc identifying information (for auth)
            'author_name': (userDisplayName() || ""),
            'author_email': (userEmail() || ""),
            'auth_token': (userAuthToken || ""),
        },
        success: function( data, textStatus, jqXHR ) {
            // TODO: creation method should return ??? on success, or an error message
            //hideModalScreen();
            console.log('deleteIllustration(): done! textStatus = '+ textStatus);
            // report errors or malformed data, if any
            if (textStatus === 'success') {
                /* NB the callback (below) should handle any cleanup, if e.g. we just
                 * deleted the currently loaded illustration.
                 */
            } else {
                resp.error = "Sorry, there was an error deleting this illustration.";
                alert(resp.error);
            }
        },
        error: function( data, textStatus, jqXHR ) {
            //hideModalScreen();
            if ((typeof(jqXHR.responseText) !== 'string') || jqXHR.responseText.length === 0) {
                resp.error = 'Sorry, there was an error deleting this illustration. (No more information is available.)';
            } else {
                resp.error = 'Sorry, there was an error deleting this illustration:\n\n '+ jqXHR.responseText;
            }
            alert(resp.error);
        },
        complete: function( jqXHR, textStatus ) {
            callback(resp);
        }
    });
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
    'deleteIllustration',
    'getDefaultGitHubIllustrationID',
    'getIllustrationIDFromURL',
    'userHasStorageAccess',
    // auth information (specific to this backend?)
    'userDisplayName',
    'userLogin',
    'userEmail',
    //'userAuthToken'
    'loginToGitHub',
    'userIsLoggedIntoGitHub'
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
