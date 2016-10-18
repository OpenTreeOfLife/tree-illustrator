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

// Manage illustrations from the current docstore (phylesystem via its API)

function getIllustrationList(callback) {
    /* The 'data' (if successful) should be an array of objects, each with
     * 'name', 'description', and 'source' properties.
     */

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
}

function loadIllustration(id, callback) {
    // 'callback' should expect a single obj with 'data' or 'error' properties)
    callback(notImplementedResponse);
}

function saveIllustration(forcePosition, callback) {
    // 'callback' should expect a single obj with 'data' or 'error' properties)
    // TODO: support save, save-as, copy?

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
    
    callback(notImplementedResponse);
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
    'saveIllustration'
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
