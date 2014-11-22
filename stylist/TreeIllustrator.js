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

    // define some simple enumerations (for legibility, and to avoid typos)
    var units = {
        INCHES: 'inches',
        CENTIMETERS: 'centimeters'
    };

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
                    'printSizes': [
                        {
                            'name': "Letter size (portrait)",
                            'width': 8.5, 
                            'height': 11, 
                            'units': units.INCHES 
                        },
                        {
                            'name': "Letter size (landscape)",
                            'width': 11, 
                            'height': 8.5, 
                            'units': units.INCHES 
                        },
                        {
                            'name': "Quarter-page (portrait)",
                            'width': 4.25, 
                            'height': 5.5, 
                            'units': units.INCHES 
                        },
                        {
                            'name': "Quarter-page (landscape)",
                            'width': 5.5, 
                            'height': 4.25, 
                            'units': units.INCHES 
                        },
                        {
                            'name': "Custom size"
                        }
                    ]
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
                'printSize': {
                    'units': units.INCHES,  // OR units.CENTIMETERS
                    'width': 3.5,  // in physical units
                    'height': 5.0,   // in physical units
                },
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

        // REMINDER: computed observables should use 'deferEvaluation' in
        // case their dependencies will appear during ko.mapping
        self.templateSourceHTML = ko.computed(function () {
            switch(self.template.source.type()) {
                case 'URL':
                    var itsURL = self.template.source.value();
                    return '<a href='+ itsURL +' target="_blank">'+ itsURL +'</a>';
                case 'builtin':
                    return "Built-in";
            }
            return "Undefined"; 
        }, self, {deferEvaluation:true});

        self.useChosenPrintSize = function() {
            var sizeName = $('#template-docsize-chooser').val();
            var selectedSize = getPrintSizeByName( sizeName );
            if (!selectedSize) {
                console.warn('useChosenPrintSize(): no matching size found!');
                return;
            }
            if (selectedSize.units) {
                // Custom size should retain current settings
                self.style.printSize.width( selectedSize.width() );
                self.style.printSize.height( selectedSize.height() );
                self.style.printSize.units( selectedSize.units() );
            }
        };
        self.updatePrintSizeChooser = function() {
            // (de)select matching size after manual adjustments
            var matchingSize = $.grep(
                self.template.constraints.printSizes(), 
                function(o) {
                    if (!('units' in o)) return false; // 'Custom size' never matches
                    // NOTE use of != instead of !== below, because "11" == 11
                    if (o.units() != self.style.printSize.units()) return false;
                    if (o.width() != self.style.printSize.width()) return false;
                    if (o.height() != self.style.printSize.height()) return false;
                    return true;
                }
            )[0];
            var matchingSizeName = 'Custom size';
            if (matchingSize) {
                matchingSizeName = matchingSize.name();
            }
            $('#template-docsize-chooser').val(matchingSizeName);
        };

        var getPrintSizeByName = function( name ) {
            var matchingSize = $.grep(
                self.template.constraints.printSizes(), function(o) {
                    return o.name() === name;
                }
            )[0];
            if (typeof matchingSize === 'undefined') {
                console.warn('getPrintSizeByname(): no such size as "'+ name +'"!');
            }
            return matchingSize;
        }
/*
        self.metadata = {
            name: ko.observable(data.metadata.name),
            description: ko.observable(data.metadata.description)
        };
        self.styles = ko.observable();
        self.sceneGraph = ko.observable();
        self.vegaSpec = ko.observable();

        // two initial test properties for tree placement
        self.treeX = ko.observable( 'treeX' in data ? data.treeX : physicalWidth / 2.0 );
        self.treeY = ko.observable( 'treeY' in data ? data.treeY : physicalHeight / 2.0 );
*/

        /* Instead of explicitly defining all possible members, let's
         * trust the ko.mapping plugin to handle loading and saving 
         * illustration data from JS(ON), with mapping options to handle
         * any exceptional stuff.
         */
        var mappingOptions = {
            /* Use to handle special cases:
             *  'ignore' to keep some clutter out of the saved model
             *  'include' to force view-model properties to be saved
             *  'copy' to keep simple values simple (vs. observable)
             *  'observe' ONLY if it's easier to whitelist the observables
             *  'create' map some elements to object classes
             *  'update'? convert Dates to ISO date-strings, ints to floats
             *  'key': pin elements to specified keys
             * See http://knockoutjs.com/documentation/plugins-mapping.html
             */
            'ignore': [ 'constructor' ],
            'include': [ ],
            'copy': [ ],
            // 'observe': [ ], // WARNING: using this flips default mapping!
            'elements': {
                'create': function(options) {
                    // create these as object instances
                    var data = options.data;
                    var dataParent = options.parent;
                    switch(data.type) {
                        case 'tree':
                            //TODO: return new Tree(data);
                            break;
                        case 'supporting data':
                            //TODO: return new SupportingData(data);
                            break;
                    }
                    // keep it simple by default
                    return ko.observable(data);
                },
                'key': function(data) {
                    // use 'id' attribute to pin these
                    return ko.utils.unwrapObservable(data.id);
                }
            }
        };
        /* Map incoming data from a JS object. NOTE that we can also do 
         * this piecemeal to (for example) apply new styles to an illustration.
         *
         * TODO: Add some valication or other sanity checks after mapping, to
         * make sure we're not getting nonsense from the saved model?
         */
        ko.mapping.fromJS(data, mappingOptions, self);

        // Add validation for fields that need it
        self.metadata.name.extend({required: true});

        self.exportModelAsObject = function() {
            var obj = ko.mapping.toJS(self);
            // TODO: any cleanup here?
            return obj;
        };

        self.exportModelAsJSON = function() {
            var json = ko.mapping.toJSON(self);
            // TODO: any cleanup here?
            return json;
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
        units: units,
        //Tree: Tree,
        SceneGraph: SceneGraph,
        StyleOverrides: StyleOverrides,
        Illustration: Illustration
    };
}(window, document, $, ko);
