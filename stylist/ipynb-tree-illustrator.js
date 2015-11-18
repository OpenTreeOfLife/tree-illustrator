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

    // Are we running in a "live" notebook, or static HTML?
    var isLiveNotebook = $('body.notebook_app').length > 0;
    var isStaticNotebook = !(isLiveNotebook);

    // Define some enumerated values for callers.
    var SINGLETON = 'SINGLETON';
    var TOOLBAR_BUTTON_ID = 'ti-toolbar-button';

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
            return '<iframe id="'+ elementID +'" width="100%" height="500" \
                            src="http://rawgit.com/OpenTreeOfLife/tree-illustrator/master/stylist/stylist.html" \
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
            debugger;
            var modal = IPython.dialog.modal({
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
                    // Cosmetic tweaks to the modal header
                    var $titleArea = $('h4.modal-title:contains(Tree Illustrator)');
                    var $modalHeader = $titleArea.closest('.modal-header');
                    $modalHeader.css('padding', '8px 15px');
                    $titleArea.prepend('<img src="//tree.opentreeoflife.org/favicon.ico"'
                                          +' style="width:24px; height: 24px; display: inline-block; margin: -7px 0 -5px -5px;">');

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

        var elementSelector = ('#'+ elementID);
        self.ti_element = $(elementSelector)[0];
        self.ti_window = self.ti_element.contentWindow;
        
        // add this instance to the registry above
        widgets[elementID] = self;
    }

    // Do other initial setup in the noteboo
    if (isLiveNotebook) {
        // Add a button to the shared toolbar
        if ($('#'+ TOOLBAR_BUTTON_ID).length === 0) {
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
        }
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

    /* expose class constructors (and static methods) for instantiation */
    return {
        // expose enumerations
        SINGLETON: SINGLETON,
        TOOLBAR_BUTTON_ID: TOOLBAR_BUTTON_ID,

        // expose static properties and methods
        isLiveNotebook: isLiveNotebook,
        isStaticNotebook: isStaticNotebook,

        // expose available classes
        IllustratorWidget: IllustratorWidget
    };
}(window, document, $);
