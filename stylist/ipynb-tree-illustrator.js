/*
 * This script can be imported into any IPython notebook (assumes the web UI)
 * to allow embedding the Tree Illustrator webapp in an IFRAME. This makes it a
 * static widget in IPython parlance, so it will be usable even in a "headless"
 * notebook viewer.
 *
 * This should be useful in pre-publication and exploratory scenarios for a
 * single user, or fairly easy collaboration using Wakari or another notebook
 * server.
 * 
 * Sensible encapsulation will let us embed one or many instances of the Tree
 * Illustrator UI in a notebook. 
 * 
 * We'll use cross-document messaging (postMessage) to provide tree data from
 * the surrounding IPython session and to save SVG output (or complete
 * illustration JSON) from the Tree Illustrator. [1,2]
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

    // keep track of all active instances (widgets), keyed by element ID
    var widgets = { };

    // assign unique, serial element IDs
    var nextAvailableWidgetID = 0;

    var getNextAvailableWidgetID = function( ) {
        // creates a serial ID like 'tree-illustrator-4'
        var readyID = nextAvailableWidgetID;
        nextAvailableWidgetID = readyID + 1;
        return ('tree-illustrator-'+ readyID);
    } 

    var IllustratorWidget = function(cell, data) {
        if ( !(this instanceof IllustratorWidget) ) {
            console.warn("MISSING 'new' keyword for IllustratorWidget, patching this now");
            return new IllustratorWidget(data);
        }

        if (!cell || !(cell instanceof OutputArea)) {
            console.warn("Missing notebook cell as first argument!");
            return null;
        }

        if (!data || typeof(data) !== 'object') {
            // instance will load the "empty" illustration as usual?
        }

        // safely refer to this instance
        var self = this;

        /* define PRIVATE members (variables and methods)functions and with 'var' */

        /* define PUBLIC variables (and privileged methods) with 'self' */

        // create my IFRAME element in the output of the current notebook cell
        var elementID = getNextAvailableWidgetID();
        // N.B. This ID is mostly for internal use; user probably calls this something else
        this.append_display_data({
          'data': {
            'text/html': '<iframe id="'+ elementID +'" width="100%" height="500" \
                           src="http://rawgit.com/OpenTreeOfLife/tree-illustrator/master/stylist/stylist.html" \
                           frameborder="0" allowfullscreen="allowfullscreen"> \
                          </iframe>'
          } 
        })
        self.element = $(elementID)[0];
console.log("BEFORE self.window = "+ self.window);
        self.window = $(elementID)[0].contentWindow;
console.log("AFTER self.window = "+ self.window);
        
        // add this instance to the registry above
        widgets[elementID] = self;
    }
    /* define PUBLIC methods (that don't need private data) in its prototype */
    IllustratorWidget.prototype = {
        constructor: IllustratorWidget,

        addTree: function(data) {
            // TODO
            var self = this;
        }
    }

    /* expose class constructors (and static methods) for instantiation */
    return {
        // TODO: expose enumerations?

        // TODO: expose static methods?

        // expose available classes
        IllustratorWidget: IllustratorWidget
    };
}(window, document, $);
