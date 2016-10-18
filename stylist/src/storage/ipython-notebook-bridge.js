/*
 * This script adds cross-document messaging (postMessage) support [1,2], to allow
 * embedding one or many instances of the Tree Illustrator UI in an
 * IPython notebook. This lets us provide tree data from the surrounding
 * IPython session, and save SVG output or complete illustration JSON from each
 * instance.
 *
 * This should be useful in pre-publication and exploratory scenarios for a
 * single user, or fairly easy collaboration, using Wakari or another notebook
 * server.
 *
 * [1] https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
 * [2] http://caniuse.com/#search=postMessage
 */

// notebook window is opener (for separate tab/window) or parent (for IFRAME)
var notebookWindow = window.opener || window.parent;

// TODO: set expected calling domain when instance is created?

function receiveMessage(e) {
    var msg = e.originalEvent;
    /* REMINDER: A message has three properties of interest:
     *   msg.origin is the domain that holds the surrounding IPython notebook
     *   msg.data is its payload
     *   msg.source is the window that sent the message (the notebook viewer)
     */
    if (msg.source !== notebookWindow) {
        console.warn("Expected this message from my notebookWindow (opener or parent)!\n"
                    +"  msg.source="+ msg.source +"\n"
                    +"  notebookWindow="+ notebookWindow
        );
        debugger;
        //return;
    }

    if (!msg.data['method']) {
        alert("Expected a named method in msg.data.method!");
        return;
    }

    if (!msg.data['response']) {
        alert("Expected an object in msg.data.response!");
        return;
    }

    switch(msg.data['method']) {
        case 'addTree':
            var treeData = msg.data['treeData'];
            if (!treeData) {
                alert("No tree data provided!");
                return;
            }
            // TODO
            break;

        case 'dumpCurrentIllustration':
            var targetCell = getTargetCell(msg);
            // TODO
            break;

        case 'dumpCurrentIllustrationSVG':
            var targetCell = getTargetCell(msg);
            // TODO
            break;

        /* Handle callbacks for messages FROM this window */

        case 'getIllustrationList_response':
            getIllustrationList_callback(msg.data.response);
            break;
        case 'loadIllustration_response':
            loadIllustration_callback(msg.data.response);
            break;
        case 'saveIllustration_response':
            saveIllustration_callback(msg.data.response);
            break;

        case 'listAllNotebookVars_response':
            // N.B. the expected callback is named for a general API, not the
            // details of Jupyter notebook.
            getTreeSourceList_callback(msg.data.response);
            break;
        case 'getTreeSourceData_response':
            getTreeSourceData_callback(msg.data.response);
            break;

        default:
            alert("Unexpected method ["+ msg.data.method +"] in this message!");
            return;
    }
}

function getTargetCell(msg) {
    // Return the specified cell, or the next available
    // TODO: what kind of cell reference works for notebook JS?
    //  - nth cell?
    //  - by name or element ID?
    //  v a direct reference? NO, these are not shared across windows
}

console.warn("ADDING event listener (bridge JS) to this window: "+ window.location.href);
//window.addEventListener("message", receiveMessage, false);
$(window).off('message.TreeIllustrator')
         .on('message.TreeIllustrator', receiveMessage);

/* The methods below constitute a general API for the Tree Illustrator. 
 * These should support asynchronous operations via callbacks. When defining
 * function names and arguments, keep in mind that we expect to build parallel
 * implementations in other contexts (e.g., within a dedicated website or the
 * Tools tab of the OpenTree curation app).
 */

// Manage illustrations from the current docstore (in this case, the notebook metadata)

// stash callbacks for use by cross-window responses
var getIllustrationList_callback = null,
    loadIllustration_callback = null,
    saveIllustration_callback = null;

function getIllustrationList(callback) {
    getIllustrationList_callback = callback;

    notebookWindow.postMessage({
        method: 'getIllustrationList'
    }, 
    '*');  // TODO: restrict to this particular notebook's domain?
}

function loadIllustration(id, callback) {
    loadIllustration_callback = callback;

    notebookWindow.postMessage({
        method: 'loadIllustration',
        uniqueID: id
    }, 
    '*');  // TODO: restrict to this particular notebook's domain?
}

function saveIllustration(forcePosition, callback) {
    // TODO: support save, save-as, copy?
    saveIllustration_callback = callback;

    // flatten the current illustration to simple JS using our 
    // Knockout mapping options
    var clonableIllustration = ko.mapping.toJS(stylist.ill);

    var msgInfo = {
        method: 'saveIllustration',
        illustration: clonableIllustration
    };
    // To re-save in the same slot, omit the uniqueID
    if (typeof(forcePosition) !== 'undefined') {
        msgInfo.uniqueID = forcePosition;
    }
    
    notebookWindow.postMessage(msgInfo, '*');  
    // TODO: restrict to this particular notebook's domain?
}

// Get user-friendly list of available source data for trees, etc.
// TODO: Include JS variables, from window scope (or scope provided)?
// TODO: Support multiple kernels (Python, Julia, etc) if available?
// TODO: Filter kernel vars (using regular expressions?) to show only suitable variables for each query?

// stash callbacks for use by cross-window responses
var getTreeSourceList_callback = null,
    getTreeSourceData_callback = null;

function getTreeSourceList(callback) {
    getTreeSourceList_callback = callback;

    notebookWindow.postMessage({
        method: 'listAllNotebookVars'
    }, 
    '*');  // TODO: restrict to this particular notebook's domain?
}

function getTreeSourceData(id, callback) {
    // 'callback' should expect a single obj with 'data' or 'error' properties)
    getTreeSourceData_callback = callback;

    notebookWindow.postMessage({
        method: 'getNotebookVar',
        varName: id
    }, 
    '*');  // TODO: restrict to this particular notebook's domain?
}

function getSupplementalDataSourceList(id, callback) {
    // TODO
}

function getOrnamentSourceList(id, callback) {
    // TODO
}

// Expose some members to outside code (eg, Knockout bindings, onClick
// attributes...)
var api = [
    // expected API for storage backend
    'getIllustrationList',
    'loadIllustration',
    'saveIllustration',
    // functions unique to an IPython notebook
    'getTreeSourceList',
    'getTreeSourceData'
];
$.each(api, function(i, methodName) {
    // populate the default 'module.exports' object
    exports[ methodName ] = eval( methodName );
});
