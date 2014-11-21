/* This module defines and exposes JS pseudo-classes to support a complex view
 * model for editing illustrations.
 */
var TreeIllustrator = function(window, document, $, ko) {

    // Explicitly check for dependencies by passing them as args to the module
    if (typeof($) !== 'function') {
        alert("TreeIllustrator module cancelled, needs jQuery (as '$')");
        return null;
    }
    if (!ko || typeof(ko) !== 'object') {
        alert("TreeIllustrator module cancelled, needs KnockoutJS (as 'ko')");
        return null;
    }

    /* Here we can share information among all classes and instances */
    //var shared = {};

    /* Return the values for a new illustration (outlines our JSON representation) */
    var getNewIllustrationObject = function(options) {
        if (!options) options = {};
        var obj = {
            'metadata': {
                'name': "Untitled",
                'description': "",
                'authors': [ ],   // assign immediately to this user?
                'tags': [ ],
                'dois': [ ]
            },
            'template': {
                // maybe the defaults here are "anything goes" (all options enabled)?
                // TODO: Explicitly list all options somewhere else? Filter template styles if they fall out of conformance?
                'name': "Default template",
                'description': "You can replace this with a shared template in the Style Switcher above", // captured when assigned
                'source': {'type': "builtin", 'value': "DEFAULT"},  // URL, builtin
                'version': {'type': "version number", 'value': "0.1"},  // git SHA, mod date, version number
                'constraints': {
                    // list constrained labels and values, if any (items not listed are unconstrained)
                    'units': {
                        "Inches": "inches",
                        "Centimeters": "centimeters"
                    },
                    'printSizes': {
                    }
                },
                'placeholderElements': [
                    // dummy tree(s) or data to show, eg, "two mirrored trees"
                    {
                        'id': "tree1",
                        'type': "tree",
                        'layout': "blah",
                        'source': { 'type': "URL", 'value': "blah" },
                        'styleOverrides': {
                            // 'edgeThickness': {'value': '4pt', 'edges': 'ALL'} // or ['edge23', 'edge948']
                        }
                    }
                ]
            },
            'style': {
                // choices and overrides from the template defaults above
                'units': "inches",  // OR "centimeters"
                'printWidth': 3.5,  // in physical units
                'printHeight': 5.0,   // in physical units
                'backgroundColor': "#fdd",
                'border': "none",
                'fontFamily': "Times New Roman, Times, serif",
                'fontSize': "12pt",  // use same physical units as above?
                'fontWeight': "normal"
                // TODO: add default line color, thickness, node shape/size, etc.
            },
            'elements': {
            }
        };
        /* TODO: Apply optional modifications?
        if (options.BLAH) {
            obj.metadata.FOO = 'BAR';
        }
        */
        return obj;
    };

    /* Our principle view model [1] is a single illustration. This uses basic
     * Knockout observables as members, but adds custom behavior. We'll use a
     * family of pseudo-classes to define the main illustration and selected parts.
     *
     * [1] http://knockoutjs.com/documentation/observables.html
     */
    var Illustration = function(data) {
        if ( !(this instanceof Illustration) ) {
            console.warn("MISSING 'new' keyword, patching this now");
            return new Illustration(data);
        }

        if (!data || typeof(data) !== 'object') {
            // load the "empty" illustration object above
            data = getNewIllustrationObject();
        }

        // safely refer to this instance
        var self = this;

        /* define PRIVATE members (variables and methods)functions and with 'var' */
        var secretSauce = function() {
            alert("TOP SECRET!");
        }

        /* define PUBLIC variables (and privileged methods) with 'self' */
        //self.myVariable = ko.observable();
        //self.myComputed = ko.computed(function () { return "hello" + self.myVariable() });

/*
        self.metadata = {
            name: ko.observable(data.metadata.name),
            description: ko.observable(data.metadata.description)
        };
        self.styles = ko.observable();
        self.sceneGraph = ko.observable();
        self.vegaSpec = ko.observable();
*/

        /* Instead of explicitly defining all possible members, let's
         * trust the ko.mapping plugin to handle loading and saving 
         * illustration data from JS(ON), with mapping options to handle
         * any exceptional stuff.
         */
        var mappingOptions = {
            // TODO: map some elements to objects, etc.
        };
        ko.mapping.fromJS(data, mappingOptions, self);
        // TODO: Add some valication or other sanity checks here?


        // two initial test properties for tree placement
        self.treeX = ko.observable( 'treeX' in data ? data.treeX : physicalWidth / 2.0 );
        self.treeY = ko.observable( 'treeY' in data ? data.treeY : physicalHeight / 2.0 );
*/

        self.privilegedMethod = function() {
            alert( 'calling my private method:' );
            secretSauce();
            //alert(counter);
        };

    }
    /* define PUBLIC methods (that don't need private data) in its prototype */
    Illustration.prototype = {
        constructor: Illustration,
        greet: function () {
            var self = this;
            alert(self.name() + ' says hi!');
        }
    };


    /* We need to be able to define custom styles for many different elements of
     * the scene graph, e.g., a tree, node, or caption.
     */
    var SceneGraph = function(data) {
        if ( !(this instanceof SceneGraph) ) {
            console.warn("MISSING 'new' keyword, patching this now");
            return new SceneGraph(data);
        }
        // safely refer to this instance
        var self = this;

        // TODO: Based on the element type, offer appropriate styles and constraints
        // TODO: Include options to map selected data to visual style
        return self;
    }


    /* We need to be able to define custom styles for many different elements of
     * the scene graph, e.g., a tree, node, or caption.
     */
    var StyleOverrides = function(data) {
        if ( !(this instanceof StyleOverrides) ) {
            console.warn("MISSING 'new' keyword, patching this now");
            return new StyleOverrides(data);
        }
        // safely refer to this instance
        var self = this;

        // TODO: Based on the element type, offer appropriate styles and constraints
        // TODO: Include options to map selected data to visual style
        return self;
    }


    /* expose class constructors (and static methods) for instantiation */
    return {
        //Tree: Tree,
        SceneGraph: SceneGraph,
        StyleOverrides: StyleOverrides,
        Illustration: Illustration
    };
}(window, document, $, ko);
