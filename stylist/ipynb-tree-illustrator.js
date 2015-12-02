/*
 * This script can be imported into any IPython notebook (assumes the web UI)
 * to allow embedding the Tree Illustrator webapp, where it can read data from
 * the surrounding notebook and save results there. 
 * 
 * This should be useful in pre-publication and exploratory scenarios for a
 * single user, or fairly easy collaboration using Wakari or another notebook
 * server.
 * 
 * There are a few options for where the app would appear:
 *
 *   1. in a modal popup (in an IFRAME)
 *      This works best in a live (vs static HTML) notebook, where we an add a
 *      toolbar button and use IPython's built-in modal.
 *
 *   2. "inline" in a notebook cell (in an IFRAME)
 *      This makes a "static widget" in IPython parlance, so it should work
 *      even in a static HTML notebook. This allows multiple instances of Tree
 *      Illustrator to exist in different cells; is that useful?
 *
 *   3. in a new browser tab or window (esp. for static notebooks)
 *      This would need an additional bridge from the calling window to the new
 *      one. On the plus side, it should work in a live *or* static notebook.
 * 
 * In any case, we'll use cross-document messaging (postMessage) to provide
 * tree data from the surrounding IPython session and to save SVG output (or
 * complete illustration JSON) from the Tree Illustrator. [1,2]
 *
 * To use this, add a code cell to your IPython notebook and embed this script
 *   %%javascript
 *   $.getScript('https://rawgit.com/opentreeoflife/f16e.../raw/48b.../ipynb-tree-illustrator.js');
 *   ti = IPythonTreeIllustrator.IllustratorWidget();
 *   ti2 = IPythonTreeIllustrator.IllustratorWidget('(a,b,(c,d));');
 *
 * [1] https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
 * [2] http://caniuse.com/#search=postMessage
 */

var IPythonTreeIllustrator = function(window, document, $) {

    // Try to determine the URL of this script, so we can load adjacent files
    var currentScriptURL = $('script[src*="ipynb-tree-illustrator.js"]').last().attr('src');
    console.log('>>> Loading Tree Illustrator code from this URL: '+ currentScriptURL);

    // Are we running in a "live" notebook, or static HTML?
    var isLiveNotebook = $('body.notebook_app').length > 0;
    var isStaticNotebook = !(isLiveNotebook);

    // Define some enumerated values for callers.
    var SINGLETON = 'SINGLETON',
        TOOLBAR_BUTTON_ID = 'ti-toolbar-button',
        //TI_STATE_ID = 'ti-state-data',
        TI_HOME_CELL_ID = 'ti-home-cell';

    // Keep track of prefs and illustrations (in notebook metadata) 
    var state;

    /* Add a special jQuery event for when an element is removed from the DOM
     * (e.g., when a popup with a TI widget is closed).
     * See http://stackoverflow.com/a/10172676
     */
    (function($){
      $.event.special.destroyed = {
        remove: function(o) {
          if (o.handler) {
            o.handler()
          }
        }
      }
    })(jQuery);

    // Generate the initial "state" object for a new Tree Illustrator widget
    var getInitialState = function() {
        return {
            "lastUpdate": new Date().toString(),
            "prefs": {}, 
            "illustrations": []
            // an ordered list of objects, each with name, author(?), spec, convertedTrees, svgOutput
        };
    }

    /* Freeze/thaw JSON data to/from a TEXTAREA or PRE element?
     * For now, we're going to use notebook metadata for this.
    var thawStateFromJSON = function() {
        var $stateHolder = $('#'+ TI_STATE_ID);
        if ($stateHolder.length) {
            // Load the existing state JSON
            state = JSON.parse( $stateHolder.text() ); 
        } else {
            // Use default (initial) state for a new Tree Illustrator
            state = defaultState;
        }
    }
    var freezeStateToJSON = function() {
        if (isStaticNotebook) {
            // We can only save changes in a live notebook!
            console.warn("IPythonTreeIllustrator.freezeStateToJSON(): disabled in a static notebook!");
            return;
        }
        var $stateHolder = $('#'+ TI_STATE_ID);
        if ($stateHolder.length === 0) {
            var msg = "State (JSON) holder not found! Unable to save state for Tree Illustrator!";
            console.warn(msg);
            alert(msg);
            return;
        }
        $stateHolder.text( JSON.stringify(state));
        IPython.notebook.save_notebook();
    }
    */

    // Keep track of all active instances (widgets), keyed by element ID
    var widgets = { };

    // Assign unique, serial element IDs
    var nextAvailableWidgetID = 0;

    var getNextAvailableWidgetID = function( ) {
        // creates a serial ID like 'tree-illustrator-4'
        var readyID = nextAvailableWidgetID;
        nextAvailableWidgetID = readyID + 1;
        return ('tree-illustrator-'+ readyID);
    } 

    var IllustratorWidget = function(target, data) {
        if ( !(this instanceof IllustratorWidget) ) {
            console.warn("MISSING 'new' keyword for IllustratorWidget, patching this now");
            return new IllustratorWidget(data);
        }

        // Safely refer to this instance below
        var self = this;
        var elementID = getNextAvailableWidgetID();

        /* define PRIVATE members (variables and functions ) with 'var' */

        var getIframeMarkup = function() {
            // TODO: add version/SHA argument here?
            var stylistMainURL = buildScriptRelativeURL('stylist.html');
            return '<iframe id="'+ elementID +'" width="100%" height="500" \
                            src="'+ stylistMainURL +'" \
                            frameborder="0" allowfullscreen="allowfullscreen"> \
                    </iframe>';
        }

        var showInNewWindow = function() {
            // TODO: Show the Tree Illustrator in a new browser window or tab, with a link
            // back to the calling window.
            alert('showInNewWindow(): COMING SOON');
        }

        var showInNotebookCell = function(cell) {
            // create my IFRAME element in the output of the current notebook cell
            
            // N.B. This ID is mostly for internal use; user probably calls this something else
            cell.append_display_data({
              'data': {
                'text/html': getIframeMarkup()
              } 
            })
        }

        var showInModalPopup = function(data) {
            // Use IPython's support for a single modal popup, adapted from
            // https://github.com/minrk/ipython_extensions/blob/70ed77bd7fd36fbead09a1df41f93cab5cfdfe92/nbextensions/gist.js
            //var modal = IPython.dialog.parentModule.modal({
            var dialog = require("base/js/dialog");
            var modal = dialog.modal({
                title: "Tree Illustrator",
                body: $(getIframeMarkup()),
                buttons : {
                    //"Cancel": {},
                    "Close": {
                        class: "btn-primary",
                        click: function () {
                            // TODO: update TI header cell
                            console.log('clicked Close button (closes popup?)');
                            /*
                            var token = $(this).find('input').val();
                            localStorage[token_name] = token;
                            gist_notebook();
                            */
                        }
                    }
                },
                open : function (event, ui) {
                    // Cosmetic tweaks to the modal popup
                    var $titleArea = $('h4.modal-title:contains(Tree Illustrator)');
                    var $modalHeader = $titleArea.closest('.modal-header');
                    var $modalDialog = $modalHeader.closest('.modal-dialog');
                    $titleArea.prepend('<img src="//tree.opentreeoflife.org/favicon.ico"'
                                          +' style="width:24px; height: 24px; display: inline-block; margin: -7px 0 -5px -5px;">');
                    $modalHeader.css('padding', '8px 15px'); 
                    $modalDialog.css({'width':'90%', 'height':'90%'}); // almost fills the window

                    // update internal references to 
                    var elementSelector = ('#'+ elementID);
                    self.ti_element = $(elementSelector)[0];
                    self.ti_window = self.ti_element.contentWindow;
                    
                    // unloading (removing) its IFRAME should un-register this widget
                    // N.B. this uses our special 'destroyed' event, defined above
                    $(self.ti_element).bind('destroyed', function() {
                        console.log("Un-registering TI widget '"+ elementID +"'!");
                        delete widgets[elementID];
                    });

                    // HACK to test persistent window reference for a singleton
                    tiWindow = self.ti_window;
                    console.log("UPDATING single 'tiWindow' to this TI widget:");
                    console.log(tiWindow);

                    // TODO: load initial data?
                    /*
                    var that = $(this);
                    // Upon ENTER, click the OK button.
                    that.find('input[type="text"]').keydown(function (event, ui) {
                        if (event.which === 13) {
                            that.find('.btn-primary').first().click();
                            return false;
                        }
                    });
                    that.find('input[type="text"]').focus().select();
                    */
                }
            });
        };

        /* TODO: define PUBLIC variables (and privileged methods) with 'self' */

        // Initialize this instance using one of the methods above

        if (!data || typeof(data) !== 'object') {
            // instance will load the "empty" illustration as usual?
            console.log("No data specified for Tree Illustrator, will use placeholders.");
        }

        if (target === SINGLETON) {
            if (isLiveNotebook) {
                // Use the modal popup support in IPython
                showInModalPopup(data);
            } else {  // it's a static HTML notebok
                // Use a new browser window or tab
                showInNewWindow(data);
            }
        } else {
            // try to embed in a specified cell
            if (target && ('append_output' in target)) {
            ///if (target && (target instanceof OutputArea)) {
                showInNotebookCell(target);
            } else {
                if (isLiveNotebook) {
                    alert("Missing notebook cell as first argument! Try 'this':"
                        + "\n  var ti = new IPythonTreeIllustrator.IllustratorWidget(this);");
                } else {
                    alert("REMINDER: Tree Illustrator can't be embedded in a cell in the static HTML notebook!");
                }
                return null;
            }
        }

        // add this instance to the registry above
        widgets[elementID] = self;
    }

    var updateHomeCell = function() {
        // Refresh (or initialize) the home-cell display based on current state JSON
        var $homeCell = $('#'+ TI_HOME_CELL_ID);
        console.log("Updating the Tree Illustrator home cell...");
        // Update and enable the toggle
        var $inputArea = $homeCell.find('.input');
        var $toggle = $homeCell.find('a.input-toggle');
        if ($inputArea.is(':visible')) {
           $toggle.text( "Hide the code that added this Tree Illustrator" );
        } else {
           $toggle.text( "Show the code that added this Tree Illustrator" );
        }
        $toggle.unbind('click')
               .click(function() {
                   // show (or hide) the input area for this cell
                   var $toggle = $(this);
                   var $inputArea = $toggle.closest('.cell').find('.input');
                   if ($inputArea.is(':hidden')) {
                      $inputArea.show();
                      $toggle.text( $toggle.text().replace('Show','Hide') );
                   } else {
                      $inputArea.hide();
                      $toggle.text( $toggle.text().replace('Hide','Show') );
                   }
               });
        // TODO: Update the prefs UI widgets
        // Update the list of illustrations
        var $illustrationsList = $homeCell.find('ul.illustration-list');
        $illustrationsList.empty();
        $.each(state.illustrations, function(pos, ill) {
            // TODO: Add controls to re-order illustrations?
            var $illustrationEntry = $('<li><a class="illustration-name"></a> <span class="illustration-description"></span> <i class="delete">X</i></li>');
            $illustrationsList.append( $illustrationEntry );
            $illustrationEntry.find('a.illustration-name')
                .html(ill.metadata.name || "Untitled illustration")
                .attr('title', 'Slot '+ pos)
                .click(function() { 
                    // TODO: launch with this illustration! 
                    alert("Now I'd open this illustration!");
                 });
            $illustrationEntry.find('span.illustration-description')
                .html(ill.metadata.description);
            $illustrationEntry.find('.delete')
                .click(function() {
                    if (prompt("Are you sure you want to delete this illustration? This cannot be undone!"
                              +" Enter 'YES' below to confirm.") === 'YES') {
                        // clobber this illustration from the list
                        state.illustrations.splice(pos, 1);
                        updateHomeCell();
                    }
                });
        });
    }

    var buildScriptRelativeURL = function( path ) {
        var pathParts = currentScriptURL.split('/').slice(0, -1);
        pathParts.push( path );
        return pathParts.join('/');
    }

    // Do other initial setup in the noteboo
    var initNotebookUI = function( $homeCellOutputArea ) {
        // Load any prior state, or initialize it if not found
        //thawStateFromJSON();
        if (!IPython.notebook.metadata.tree_illustrator) {
            IPython.notebook.metadata.tree_illustrator = getInitialState();
        }
        state = IPython.notebook.metadata.tree_illustrator;

        if (isStaticNotebook) {
            // There's no toolbar or available cell reference; nothing we can do here
            console.warn("IPythonTreeIllustrator.initNotebookUI(): disabled in a static notebook!");
            return;
        }
        console.log("IPythonTreeIllustrator.initNotebookUI(): starting...");
        
        // Add a button to the shared toolbar
        if ($('#'+ TOOLBAR_BUTTON_ID).length === 0) {
            console.log("IPythonTreeIllustrator.initNotebookUI(): adding toolbar button");
            IPython.toolbar.add_buttons_group([
                {
                    'label'   : 'Launch the Tree Illustrator',
                    'icon'    : 'fa-leaf', // from http://fortawesome.github.io/Font-Awesome/icons/
                            // for prefixed names, see http://cascade.io/icon-reference.html
                    'callback': function() {
                        var ti = new IPythonTreeIllustrator.IllustratorWidget(IPythonTreeIllustrator.SINGLETON);
                    },
                    'id'      : TOOLBAR_BUTTON_ID
                },
            ]);
            // let's give it a nicer look
            $('#'+ TOOLBAR_BUTTON_ID).html('<img src="//tree.opentreeoflife.org/favicon.ico"'
                                              +' style="width:18px; height: 18px; margin: -1px -3px 0px -4px;"> Tree Illustrator');
        }

        // Add a "home" cell to manage illustrations, if not found
        if ($homeCellOutputArea instanceof jQuery && $homeCellOutputArea.length) {
            // Test for existing home cell (incl. JSON state)
            var homeCellAlreadyExists = $('#'+ TI_HOME_CELL_ID).length > 0;
            if (homeCellAlreadyExists) {
                updateHomeCell();
            } else {
                // Load our template HTML into the new "home" cell
                if (!currentScriptURL) {
                    $homeCellOutputArea.append('<pre><div class="ansired"></div></pre>'); // mimic IPython notebook errors
                    $homeCellOutputArea.find('pre .ansired').text( "No URL found for this script!" );
                    return;
                }
                var tiHomeCellURL = buildScriptRelativeURL('ipynb-ti-home-cell.html');
                console.log(">>> Loading home-cell UI from this URL:"+ tiHomeCellURL);
                $homeCellOutputArea.load(tiHomeCellURL, function( response, status, xhr ) {
                    if ( status == "error" ) {
                        $homeCellOutputArea.append('<pre><div class="ansired"></div></pre>'); // mimic IPython notebook errors
                        var msg = "There was an error loading the Tree Illustrator UI:\n\n";
                        $homeCellOutputArea.find('pre .ansired').text( msg + xhr.status + " " + xhr.statusText );
                        return;
                    }
                    // Freeze any prior (or default) state to stored JSON
                    //freezeStateToJSON();
                    // hide input code by default
                    $('#'+ TI_HOME_CELL_ID).closest('.cell').find('.input').hide();
                    updateHomeCell();
                });
            }
        } else {
            // No jQuery provided, or it's empty
            console.warn("IPythonTreeIllustrator.initNotebookUI(): No home cell defined!");
        }
        console.log("IPythonTreeIllustrator.initNotebookUI(): done!");
    }

    /* define PUBLIC methods (that don't need private data) in its prototype */
    IllustratorWidget.prototype = {
        constructor: IllustratorWidget,

        addTree: function(data) {
            var self = this;
            // TODO
        },
        dumpCurrentIllustration: function(data) {
            var self = this;
            // TODO
        },
        dumpCurrentIllustrationSVG: function(data) {
            var self = this;
            // TODO
        }

    }



/* Message handling across windows/domains (via postMessage)  */

// check incoming messages against the expected source domain 
var tiDomain = 'http://rawgit.com';
// check incoming messages against the known list of windows (incl. IFRAMEs)?
//var ti5window = $('#tree-illustrator-5')[0].contentWindow;

// For now, assume a singleton Tree Illustrator (just one window)
console.log("BEFORE INITIALIZING single 'tiWindow' to null:");
console.log(tiWindow);
var tiWindow = null;

// Again, assuming a singleton, keep track of the current slotPosition
// (numbered storage location). This should be set to
//  - an integer, after loading an illustration from storage
//  - 'NEW' if we're starting with a new or 'empty' illustration
//  - an integer, after saving the current illustration (to reflect 
//    Save, Save As, or Duplicate)
var currentSlotPosition = 'NEW';

// add a listener for messages from the Tree Illustrator instance (its window)
console.warn("ADDING event listener (ipynb) to this window: "+ window.location.href);
window.addEventListener("message", receiveMessage, false);
// TODO: make sure we're not duplicating this? or allow one listener per instance?

function receiveMessage(msg) {
    // the dispatched message has origin, data, source [sending window]
    if (msg.origin !== tiDomain) {
        alert("Attempted inter-window message from an unexpected domain: ["+ msg.origin +"], expected: ["+ tiDomain +"]");
        return;
    }
    /* TODO: Why does this test always fail? Disabling it for now.
    if (msg.source !== tiWindow) {
        alert("Attempted inter-window message from an unexpected window!");
        return;
    }
    */
    
    // call an appropriate local function (or complain)
    switch(msg.data['method']) {
        case 'getIllustrationList':
            // call local function and send response to calling window
            getIllustrationList(function( response ) {
                // response is an object with 'data' or 'error' property
                tiWindow.postMessage(
                    {
                        method: 'getIllustrationList_response',
                        response: response
                    },
                    tiDomain
                );
            }); 
            break;

        case 'loadIllustration':
            // call local function and send response to calling window
            loadIllustration( msg.data.uniqueID, function( response ) {
                // response is an object with 'data' or 'error' property
                tiWindow.postMessage(
                    {
                        method: 'loadIllustration_response',
                        response: response
                    },
                    tiDomain
                );
            }); 
            break;

        case 'saveIllustration':
            // call local function and send response to calling window
            var targetSlotPosition = ('uniqueID' in msg.data) ? msg.data.uniqueID : currentSlotPosition;
                                     
            saveIllustration(targetSlotPosition, msg.data.illustration, function( response ) {
                // response is an object with 'data' or 'error' property
                tiWindow.postMessage(
                    {
                        method: 'saveIllustration_response',
                        response: response
                    },
                    tiDomain
                );
            }); 
            break;

        case 'listAllNotebookVars':
            // call local function and send response to calling window
            listAllNotebookVars(function( response ) {
                // response is an object with 'data' or 'error' property
                tiWindow.postMessage(
                    {
                        method: 'listAllNotebookVars_response',
                        response: response
                    },
                    tiDomain
                );
            }); 
            break;

        case 'getNotebookVar':
            // call local function and send response to calling window
            getNotebookVar( msg.data.varName, function( response ) {
                // response is an object with 'data' or 'error' property
                tiWindow.postMessage(
                    {
                        method: 'getTreeSourceData_response',
                        response: response
                    },
                    tiDomain
                );
            });

        default:
            alert("Unexpected method ["+ msg.data.method +"] in this message!");
            return;
    }
}

// define methods for TreeIllustrator instances

function injectTree( data, treeIndex, options ) {
    // pass newick, other formats? bounce to peyotl for conversion, as needed?
    // specify nth tree to REPLACE an existing tree?
    tiWindow.postMessage(
        {
            treeData: data,
            treeIndex: treeIndex,
            options: options        
        },
        tiDomain  // TODO: restrict to the domain extracted from 'src' URL above?
    );
    // TODO: consider a more general message 'addOrReplaceElement' with friendly JS wrappers
}

function listAllNotebookVars() {
    /* Return a list of variables (the name and type for each) currently
     * defined in the kernel, so TI * can offer these as sources for its trees,
     * supplemental data, etc. 
     * TODO: Add methods for non-python kernels!
     */
    var kernelCode = "", 
        failureMsg = "Unable to retrieve kernel vars!";
    switch(IPython.notebook.metadata.kernelspec.language) {
        case 'python':
            kernelCode = "_ignore_names = ['In', 'Out', 'exit', 'get_ipython', 'quit'];"
                       + "[[_x, type(eval(_x)).__name__] for _x in dir()"
                           + "if (_x not in _ignore_names) and (_x.startswith('_') == False)]";
            break;

        default:
            console.error("I don't know how to read variables from a '"+
                IPython.notebook.metadata.kernelspec.language +"' kernel!");
            return [ ];
    }
    /* For a more thorough test of the kernel language and version, use 
       `IPython.notebook.metadata.language_info`
    */

    // Fetch a complete list of (non-default) vars from the kernel
    var kernelCallback = function(out) {
        switch (out.msg_type) {
            case 'execute_result':
                // result should be in property 'text/plain'
                console.log( out.content.data ); // see esp. ["text/plain"] 
                alert( out.content.data['text/plain'] );
                // TODO: respond to upstream callback(s)?
                break;

            case 'stream':
                // result should be the main 'data' property
                console.log( out.content.data );
                alert( out.content.data );
                break;

            case 'error':
            case 'pyerr':
            default:
                var msg = failureMsg +"\n\n"+ 
                          out.content.ename +"\n"+ 
                          out.content.evalue;
                console.error(msg);
                alert(msg);
                // TODO: respond to upstream callback(s)?
                return;
        }
    };
    IPython.notebook.kernel.execute(
        kernelCode,
        {
            "iopub": {
                "output": kernelCallback
            }
        }, 
        {
            "silent": false, 
            "store_history": false
        }
    );
}

function getNotebookVar( varName, callback ) {
    /* Return the best (JS-friendly) representation of the named variable from
     * the server-side kernel.
     * TODO: Add methods for non-python kernels!
     * 
     * 'callback' is a function that expects a response object with 'data' or 'error'
     */
    var kernelCode = "", 
        failureMsg = "Unable to retrieve variable '"+ varName +"' from this kernel!";
    switch(IPython.notebook.metadata.kernelspec.language) {
        case 'python':
            kernelCode = varName;
            break;

        default:
            console.error("I don't know how to read variables from a '"+
                IPython.notebook.metadata.kernelspec.language +"' kernel!");
            return null;
    }
    /* For a more thorough test of the kernel language and version, use 
       `IPython.notebook.metadata.language_info`
    */

    // Fetch a complete list of (non-default) vars from the kernel
    var kernelCallback = function(out) {
        var response = {};
        //console.log( out.content.data ); // see esp. ["text/plain"] 
        switch (out.msg_type) {
            case 'execute_result':
                // result should be in property 'text/plain'
                response.data = out.content.data['text/plain'];
                break;

            case 'stream':
                // result should be the main 'data' property
                response.data = out.content.data;
                break;

            case 'error':
            case 'pyerr':
            default:
                var msg = failureMsg +"\n\n"+ 
                          out.content.ename +"\n"+ 
                          out.content.evalue;
                console.error(msg);
                response.error = msg;
                // TODO: respond to upstream callback(s)?
        }
        callback( response );
    };
    IPython.notebook.kernel.execute(
        kernelCode,
        {
            "iopub": {
                "output": kernelCallback
            }
        }, 
        {
            "silent": false, 
            "store_history": false
        }
    );
}

function getIllustrationList(callback) {
    /* Return a list of all illustrations (display name and unique ID for each)
     * currently stored in this notebook's metadata.
     * TODO: Return illustration data as well?
     * 
     * 'callback' is a function that expects a response object with 'data' or 'error'
     *
     * Typical response data should be an array of objects; each object has a
     * name (unique, just for usability) and description text.
     */
    var response = {};
    if (!state || !('illustrations' in state)) {
        response.error = "No illustration list found!";
        console.error(response.error);
    } else {
        // filter the list and return just what we need here
        response.data = [];
        $.each(state.illustrations, function(pos, ill) {
            response.data.push({
                'name': ill.metadata.name,
                'description': ill.metadata.description
                // TODO: Add SVG "preview" for each?
            });
        });
    }
    if (callback) {
        callback( response );
    } else {
        // this an also be called directly
        return response;
    }
}

function saveIllustration(slotPosition, illustrationData, callback) {
    /* Save illustration data (JS object) to this notebook's metadata, in the
     * nth ordered slot. If slotPosition is 'NEW' (or any non-existent slot
     * position), append a new slot to hold this illustration.
     * TODO: Save everything (latest SVG, etc?), or just the main, monolithic JSON?
     * 
     * 'callback' is a function that expects a response object with 'data' or 'error'
     *
     * Typical response data should be an updated illustration list (as above).
     */
    var response = {};
    if (!state || !('illustrations' in state)) {
        response.error = "No illustration list found!";
        console.error(response.error);
    } else {
        // Try to save to the nth slot (append if slot not found)
        console.log("saveIllustration() to slot "+ slotPosition +" <"+ typeof(slotPosition) +">");
        var existingSlotContents = state.illustrations[slotPosition];
        console.log("BEFORE:");
        console.log(state.illustrations);
        if (typeof(existingSlotContents) === 'undefined') {
            currentSlotPosition = state.illustrations.length;  // will match the new slot
            console.log("Nothing in this slot, appending as slot "+ currentSlotPosition);
            state.illustrations.push(illustrationData);
        } else {
            console.log("Found an existing slot, replacing the illustration at "+ currentSlotPosition);
            state.illustrations[slotPosition] = illustrationData;
            currentSlotPosition = slotPosition; 
        }
        console.log("AFTER:");
        console.log(state.illustrations);

        // If there were no errors, return an updated illustration list (as above)
        if (!('error' in response)) {
            var illustrationListInfo = getIllustrationList();
            if ('error' in illustrationListInfo) {
                // return its error instead, if any
                response.error = illustrationListInfo.data;
            } else if ('data' in illustrationListInfo) {
                response.data = illustrationListInfo.data;
            }
        }
    }
    callback( response );
    // update the notebook's visible list
    updateHomeCell();
}

function loadIllustration(slotPosition, callback) {
    /* Load the illustration data in the nth slot (in notebook's metadata).
     * 
     * 'callback' is a function that expects a response object with 'data' or 'error'
     */
    var response = {};
    if (!state || !('illustrations' in state)) {
        response.error = "No illustration list found!";
        console.error(response.error);
    } else {
        // attempt to load from the nth slot
        var ill = state.illustrations[slotPosition];
        if (typeof(ill) === 'undefined') {
            response.error = "No illustration found in slot "+ slotPosition +"!";
        } else {
            response.data = ill;
            currentSlotPosition = slotPosition; 
        }
    }
    callback( response );
}

/*
function useStyleGuide( data ) {
    // specify its name/label; complain if not found!
}

function dumpSVG() {
    ** possibly options for 
     * - put SVG into (or append to?) output of this cell
     * - render it as literal SVG (plus available source?)
     * - save it to a "local" file for persistence & display
     * - show it in a new window/frame (current behavior)
     **
}
*/


    /* expose class constructors (and static methods) for instantiation */
    return {
        // expose enumerations
        SINGLETON: SINGLETON,
        TOOLBAR_BUTTON_ID: TOOLBAR_BUTTON_ID,
        TI_HOME_CELL_ID: TI_HOME_CELL_ID,
        //TI_STATE_ID: TI_STATE_ID,

        // expose static properties and methods
        initNotebookUI: initNotebookUI,
        isLiveNotebook: isLiveNotebook,
        isStaticNotebook: isStaticNotebook,

        // expose available classes
        IllustratorWidget: IllustratorWidget
    };
}(window, document, $);
