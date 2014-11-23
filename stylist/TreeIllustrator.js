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
        INCHES: 'INCHES',
        CENTIMETERS: 'CENTIMETERS'
    };
    var colorDepths = {
        FULL_COLOR: 'FULL_COLOR',
        GRAYSCALE: 'GRAYSCALE',
        BLACK_AND_WHITE: 'BLACK_AND_WHITE'
    };

    /* Return the data model for a new illustration (our JSON representation) */
    var getNewIllustrationModel = function(options) {
        if (!options) options = {};
        var obj = {
            'metadata': {
                'name': "Untitled illustration",
                'description': "",
                'authors': [ ],   // assign immediately to this user?
                'tags': [ ],
                'dois': [ ]
            },
            'styleGuide': {
                // maybe the defaults here are "anything goes" (all options enabled)?
                // TODO: Explicitly list all options somewhere else? 
                // TODO: Filter styles if they fall out of conformance?
                'name': "Default styles",
                'description': "Style guides are used to suggest and constrain the overall look of your illustration for a particular publication or context. You can try different styles using the <strong>Switch styles...</strong> button.", // captured when assigned
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
                    ],
                    'fontFamilies': [
                        {
                            'name': "Times New Roman",
                            'value': "Times New Roman, Times, serif"
                        },
                        {
                            'name': "Helvetica",
                            'value': "Helvetica, Arial, sans"
                        },
                        {
                            'name': "Arial",
                            'value': "Arial, sans"
                        },
                        {
                            'name': "Something else"
                        }
                    ],
                    'colorDepths': [
                        {
                            'name': "Full color",
                            'value': colorDepths.FULL_COLOR
                        },
                        {
                            'name': "Grayscale",
                            'value': colorDepths.GRAYSCALE
                        },
                        {
                            'name': "Black and white (no gray)",
                            'value': colorDepths.BLACK_AND_WHITE
                        }
                    ]
                }
            },
            'style': {
                // choices and overrides from the style guide above
                'printSize': {
                    'units': units.INCHES,  // OR units.CENTIMETERS
                    'width': 11,  // in physical units
                    'height': 8.5,   // in physical units
                },
                'fontFamily': "Times New Roman, Times, serif",
                'minimumTextSize': 12,  
                    // specified in pt, but echoed using physical units above
                'minimumLineThickness': 2,  
                    // specified in pt, but echoed using physical units above
                'backgroundColor': "#fdd",
                'border': "none",
                // TODO: add default line color, thickness, node shape/size, etc.
            },
            'elements': [
            ]
        };
        /* TODO: Apply optional modifications?
        if (options.BLAH) {
            obj.metadata.FOO = 'BAR';
        }
        */
        return obj;
    };

    /* Return the data model for a new tree (our JSON representation) */
    var getNewIllustratedTreeModel = function(illustration, options) {
        if (!options) options = {};
        var newID = illustration.getNextAvailableID('tree'); 
        var obj = {
            'id': newID,
            'metadata': {
                'name': "Untitled ("+ newID +")",
                'description': "",
                'dois': [ ]
            },
            'data': { },
            'style': {
                // incl. only deviations from the style guide above?
                'edgeThickness': 2,  
                'edgeColor': '#933'
            },
        };
        /* TODO: Apply optional modifications?
        if (options.BLAH) {
            obj.metadata.FOO = 'BAR';
        }
        */
        return obj;
    };

    /* Return the data model for a new dataset (our JSON representation) */
    var getNewSupportingDatasetModel = function(illustration, options) {
        if (!options) options = {};
        var newID = illustration.getNextAvailableID('dataset'); 
        var obj = {
            'id': newID,
            'metadata': {
                'name': "Untitled ("+ newID +")",
                'description': "",
                'dois': [ ]
            },
            'data': { },
            'style': {
                // incl. only deviations from the style guide above?
            },
        };
        /* TODO: Apply optional modifications?
        if (options.BLAH) {
            obj.metadata.FOO = 'BAR';
        }
        */
        return obj;
    };

    /* Return the data model for a new ornament (our JSON representation) */
    var getNewOrnamentModel = function(illustration, options) {
        if (!options) options = {};
        var newID = illustration.getNextAvailableID('ornament'); 
        var obj = {
            'id': newID,
            'metadata': {
                'name': "Untitled ("+ newID +")",
                'description': ""
            },
            'data': { },
            'style': {
                // incl. only deviations from the style guide above?
            },
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
            data = getNewIllustrationModel();
        }

        // safely refer to this instance
        var self = this;

        /* define PRIVATE members (variables and methods)functions and with 'var' */

        /* We'll need to mint a unique, serial ID for each new illustration
         * element. Since we have a reasonable number of elements, we can
         * set the initial values for an illustration as it loads, by scanning
         * the existing elements of each type.
         */
        var nextAvailableID = {
            'tree': 0,
            'dataset': 0,
            'ornament': 0
        };
        // Each element nickname above is used in IDs, eg. 'tree-32'
        var initSerialElementIDs = function() {
            for (var aType in nextAvailableID) {
                nextAvailableID[ aType ] = 0;
            }
            var highestTreeIDFound = 0;
            var highestDatasetIDFound = 0;
            var highestOrnamentIDFound = 0;

            $.each(self.elements(), function(i, el) {
                var parts = el.id().split('-');
                var elementType = parts[0];
                var itsSerialID = parseInt(parts[1], 10);
                nextAvailableID[ elementType ] = Math.max( 
                    itsSerialID,
                    nextAvailableID[ elementType ] 
                );
            });
        }


        /* define PUBLIC variables (and privileged methods) with 'self' */

        self.getNextAvailableID = function( elementType ) {
            // creates a serial ID like 'dataset-4' or 'tree-12'
            var readyID = nextAvailableID[ elementType ];
            nextAvailableID[ elementType ] = readyID + 1;
            return (elementType +'-'+ nextAvailableID[ elementType ]);
        } 

        // REMINDER: computed observables should use 'deferEvaluation' in
        // case their dependencies will appear during ko.mapping
        self.styleGuideSourceHTML = ko.computed(function () {
            switch(self.styleGuide.source.type()) {
                case 'URL':
                    var itsURL = self.styleGuide.source.value();
                    return '<a href='+ itsURL +' target="_blank">'+ itsURL +'</a>';
                case 'builtin':
                    return "Built-in";
            }
            return "Undefined"; 
        }, self, {deferEvaluation:true});

        self.useChosenPrintSize = function() {
            var sizeName = $('#style-docsize-chooser').val();
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
                self.styleGuide.constraints.printSizes(), 
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
            $('#style-docsize-chooser').val(matchingSizeName);
        };
        var getPrintSizeByName = function( name ) {
            var matchingSize = $.grep(
                self.styleGuide.constraints.printSizes(), function(o) {
                    return o.name() === name;
                }
            )[0];
            if (typeof matchingSize === 'undefined') {
                console.warn('getPrintSizeByname(): no such size as "'+ name +'"!');
            }
            return matchingSize;
        }

        self.useChosenFontFamily = function() {
            var fontName = $('#style-fontfamily-chooser').val();
            var selectedFont = getFontFamilyByName( fontName );
            if (!selectedFont) {
                console.warn('useChosenFontFamily(): no matching font found!');
                return;
            }
            if (selectedFont.value) {
                // Custom size should retain current settings
                self.style.fontFamily( selectedFont.value() );
            }
            if (fontName === 'Something else') {
                $('#style-fontfamily-options').show();
            } else {
                $('#style-fontfamily-options').hide();
            }
        };
        self.updateFontFamilyChooser = function() {
            // (de)select matching font after manual adjustments
            var matchingFont = $.grep(
                self.styleGuide.constraints.fontFamilies(), 
                function(o) {
                    if (!('value' in o)) return false; // 'Something else' never matches
                    if (o.value() !== self.style.fontFamily()) return false;
                    return true;
                }
            )[0];
            var matchingFontName = 'Something else';
            if (matchingFont) {
                matchingFontName = matchingFont.name();
            }
            $('#style-fontfamily-chooser').val(matchingFontName);
        };
        var getFontFamilyByName = function( name ) {
            var matchingFont = $.grep(
                self.styleGuide.constraints.fontFamilies(), function(o) {
                    return o.name() === name;
                }
            )[0];
            if (typeof matchingFont === 'undefined') {
                console.warn('getFontFamilyByname(): no such font as "'+ name +'"!');
            }
            return matchingFont;
        }

        self.minTextSizeHelper = ko.computed(function() {
            // explain this size in chosen units
            var html;
            var chosenSize = self.style.minimumTextSize();
            if (isNaN(chosenSize) || $.trim(chosenSize) === '') {
                // rejects any non-numeric chars, allows whitespace and decimal
                html = '<em>This value must be a number</em>';
            } else {
                // echo the new size (in pt) as inches/cm
                chosenSize = parseFloat(chosenSize);
                var convertedSize = self.style.printSize.units() === units.INCHES ?
                    pointsToInches( chosenSize ) :
                    pointsToCentimeters( chosenSize );
                convertedSize = convertedSize.toFixed(2);
                var unitSuffix = self.style.printSize.units() === units.INCHES ?
                    'inches' : 'cm';
                html = 'pt &nbsp;('+ convertedSize +' '+ unitSuffix +')';
            }
            return html;
        }, self, {deferEvaluation:true});

        self.minLineThicknessHelper = ko.computed(function() {
            // explain this size in chosen units
            var html;
            var chosenSize = self.style.minimumLineThickness();
            if (isNaN(chosenSize) || $.trim(chosenSize) === '') {
                // rejects any non-numeric chars, allows whitespace and decimal
                html = '<em>This value must be a number</em>';
            } else {
                // echo the new size (in pt) as inches/cm
                chosenSize = parseFloat(chosenSize);
                var convertedSize = self.style.printSize.units() === units.INCHES ?
                    pointsToInches( chosenSize ) :
                    pointsToCentimeters( chosenSize );
                convertedSize = convertedSize.toFixed(2);
                var unitSuffix = self.style.printSize.units() === units.INCHES ?
                    'inches' : 'cm';
                html = 'pt &nbsp;('+ convertedSize +' '+ unitSuffix +')';
            }
            return html;
        }, self, {deferEvaluation:true});
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

        self.moveElementUp = function(el) {
              var tempList = self.elements().slice(0);
              var currentPos = $.inArray(el, tempList);
              var previousPos = currentPos - 1;
              tempList[currentPos] = tempList[previousPos];
              tempList[previousPos] = el;
              self.elements(tempList);
        }
        self.moveElementDown = function(el) {
              var tempList = self.elements().slice(0);
              var currentPos = $.inArray(el, tempList);
              var nextPos = currentPos + 1;
              tempList[currentPos] = tempList[nextPos];
              tempList[nextPos] = el;
              self.elements(tempList);
        }

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

        // Reset serial element IDs for this illustration
        initSerialElementIDs();

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

        addIllustratedTree: function() {
            var self = this;
            var tree = new IllustratedTree(self);
            self.elements.push(tree);
            return tree;
        },
        removeIllustratedTree: function(tree) {
            var self = this;
            self.elements.remove(tree);
            delete tree;
        },

        addSupportingDataset: function() {
            var self = this;
            var ds  = new SupportingDataset(self);
            self.elements.push(ds);
            return ds;
        },
        removeSupportingDataset: function(ds) {
            var self = this;
            self.elements.remove(ds);
            delete ds;
        },

        addOrnament: function() {
            var self = this;
            var obj  = new Ornament(self);
            self.elements.push(obj);
            return obj;
        },
        removeOrnament: function(obj) {
            var self = this;
            self.elements.remove(obj);
            delete obj;
        },
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
    var IllustratedTree = function(illustration, data) {
        if ( !(this instanceof IllustratedTree) ) {
            console.warn("MISSING 'new' keyword, patching this now");
            return new IllustratedTree(illustration, data);
        }

        if (!data || typeof(data) !== 'object') {
            // load the "empty" tree object above
            data = getNewIllustratedTreeModel(illustration);
        }

        // safely refer to this instance
        var self = this;
        ko.mapping.fromJS(data, Illustration.mappingOptions, self);

        // Add validation for fields that need it
        self.metadata.name.extend({required: true});

        // TODO: Based on the element type, offer appropriate styles and constraints
        // TODO: Include options to map selected data to visual style
        return self;
    }
    var SupportingDataset = function(illustration, data) {
        if ( !(this instanceof SupportingDataset) ) {
            console.warn("MISSING 'new' keyword, patching this now");
            return new SupportingDataset(illustration, data);
        }

        if (!data || typeof(data) !== 'object') {
            // load the "empty" dataset object above
            data = getNewSupportingDatasetModel(illustration);
        }

        // safely refer to this instance
        var self = this;
        ko.mapping.fromJS(data, Illustration.mappingOptions, self);

        // TODO: Based on the element type, offer appropriate styles and constraints
        // TODO: Include options to map selected data to visual style
        return self;
    }
    var Ornament = function(illustration, data) {
        if ( !(this instanceof Ornament) ) {
            console.warn("MISSING 'new' keyword, patching this now");
            return new Ornament(illustration, data);
        }

        if (!data || typeof(data) !== 'object') {
            // load the "empty" ornament object above
            data = getNewOrnamentModel(illustration);
        }

        // safely refer to this instance
        var self = this;
        ko.mapping.fromJS(data, Illustration.mappingOptions, self);

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
        colorDepths: colorDepths,
        Illustration: Illustration,
        SceneGraph: SceneGraph,
        IllustratedTree: IllustratedTree,
        SupportingDataset: SupportingDataset,
        Ornament: Ornament,
        StyleOverrides: StyleOverrides
    };
}(window, document, $, ko);
