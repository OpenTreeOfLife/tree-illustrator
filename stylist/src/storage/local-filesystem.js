/*
 * This script adds storage on the local filesystem for modern browsers.
 * Illustrations are saved as ZIP archives, typically with internal copies of
 * input data, transformation results, and output files.
 *
 * This should be useful in pre-publication, exploratory scenarios, and private
 * collaboration via email. 
 */

var $ = require('jquery'),
    utils = require('../ti-utils'),
    JSZip = require('jszip'),
    md5 = require('spark-md5'),
    FileSaver = require('file-saver'),  // https://github.com/eligrey/FileSaver.js
    assert = require('assert');

// TODO: expose JSZip to JS in the main UI?
// global.JSZip = JSZip;

// N.B. Some globals are already visible from here
///var stylist;

function userHasStorageAccess() {
    // If we're inside a running, editable notebook, anyone can save data.
    return utils.browserSupportsFileAPI();
    //return stylist.utils.browserSupportsFileAPI();  // also works!
}

function getIllustrationList(callback) {
    // This is not really possible in the local filesystem; return an empty list for now.
    var resp = { data: [ ] };
    // 'callback' expects a single obj with 'data' or 'error' properties
    callback(resp);
}

function loadIllustration(id, callback) {
    // in the filesystem, 'id' is a full path? or ignore it here?
}

function saveIllustration(id, callback) {
    /* In the filesystem, 'id' is just a suggested filename. 
     * NOTE that we have no control over where the browser will save a
     * downloaded file, and we have no direct knowledge of the filesystem.
     * Furthermore, most browsers won't overwrite an existing file with this
     * path+name, and will instead increment the new file, e.g.
     * 'bee-trees-compared.zip' becomes '~/Downloads/bee-trees-compared (2).zip'.
     *
     * Can we support the expected behavior for... ?
     *  Save  (not really, since we can't overwrite a file)
     *  Save As...  (by default, with a possibly munged/incremented filename)
     *  Copy  (sure, that's easy if we just allow renaming)
     */

    // TODO: add this user to the authors list, if not found?
    // (email and/or userid, so we can link to authors)
    /*
    var userDisplayName = ???
    var listPos = $.inArray( userDisplayName, stylist.ill.metadata.authors() );
    if (listPos === -1) {
        stylist.ill.metadata.authors.push( userDisplayName );
    }
    */

    // TODO: clear any existing URL? or keep last-known good one?
    //clonableIllustration.metadata.url = '';

    // TODO: add a "scrubber" as we do for OpenTree studies? 
    // scrubIllustrationForTransport(stylist.ill);

    // flatten the current illustration to simple JS using our 
    // Knockout mapping options
    var clonableIllustration = ko.mapping.toJS(stylist.ill);

    // create a Zip archive, add the core document
    var archive = new JSZip();
    archive.file("main.json", JSON.stringify(clonableIllustration));

    // TODO: offer a choice of "full" or "sparse" archive!
    var buildingFullArchive = true; // TODO: check a widget? an observable? add an arg?
    // Test all input for repeatable provenance info; if any are lacking a
    // clear source, we should embed the source data here.
    var staticInputs = TreeIllustrator.gatherStaticInputData();
    if (buildingFullArchive || (staticInputs.length > 0)) {
        // add some or all input data for this illustration
        //var inputFolder = archive.folder('input');
        var inputsToStore = buildingFullArchive ? TreeIllustrator.gatherAllInputData() : staticInputs;
        $.each(inputsToStore, function(i, inputData) {
            var itsPath = inputData.path;
            var serialized = serializeDataForSavedFile( inputData.value );
            archive.file(itsPath, serialized.value, serialized.options);
        });
    }

    // add other cache entries (transformed data)
    if (buildingFullArchive) {
        //var transformFolder = archive.folder('transform');
        var transformsToStore = TreeIllustrator.gatherAllTransformData();
        $.each(transformsToStore, function(i, transformData) {
            var itsPath = transformData.path;
            var serialized = serializeDataForSavedFile( transformData.value );
            archive.file(itsPath, serialized.value, serialized.options);
        });
    }

    // add any output docs (SVG, PDF)
    var outputFolder = archive.folder('output');
    outputFolder.file('main.svg', "TODO\n", {TODO: "What are appropriate options for SVG?"});

    /* ASSUME we have no knowledge of the chosen save path, or the prior
     * existence of the specified filename in that location.
     */
    var suggestedFileName = stylist.getDefaultArchiveFileName( id );
    archive.generateAsync( {type:"blob"}, 
                           function updateCallback(metadata) {
                               // TODO: Show progress as demonstrated in
                               // https://stuk.github.io/jszip/documentation/examples/downloader.html
                               console.log( metadata.percent.toFixed(2) + " % complete" );
                           } )
           .then( function (blob) {   
                      // success callback
                      FileSaver.saveAs(blob, suggestedFileName);
                  },
                  function (err) {    
                      // failure callback
                      alert('ERROR saving this ZIP archive:\n'+ err);
                  } );
}

function deleteIllustration(id, callback) {
    // We really can't do this under current (2017) brower security rules!
    console.error("deleteIllustration() is not possible in local filesystem!");
    callback({error: "deleteIllustration() is not possible in local filesystem!"});
}

function serializeDataForSavedFile( data ) {
    // TODO: Test data for other suitable options like {base64: true}
    var serialized = {};
    switch (typeof data) {
        case 'object':
            try {
                serialized.value = JSON.stringify(data);
            } catch (e) {
                console.error("Trouble converting object to JSON! Try another approach?");
                serialized.value = data.toString();
            }
            break;
        case 'string':
            serialized.value = data;
            break;
        default:
            serialized.value = data.toString();
    }
    serialized.options = {};
    return serialized;
}

// Get user-friendly list of available source data for trees, etc.
// TODO: Include JS variables, from window scope (or scope provided)?
// TODO: Support multiple kernels (Python, Julia, etc) if available?
// TODO: Filter kernel vars (using regular expressions?) to show only suitable variables for each query?

// Expose some members to outside code (eg, Knockout bindings, onClick
// attributes...)
var api = [
    // expected API for storage backend
    'getIllustrationList',  // always returns an empty list
    'loadIllustration',
    'saveIllustration',
    'deleteIllustration',  // not really available, but required for standard backend API
    'userHasStorageAccess'
];
$.each(api, function(i, methodName) {
    // populate the default 'module.exports' object
    exports[ methodName ] = eval( methodName );
});
