/* This module defines and exposes JS pseudo-classes to support a complex view
 * model for editing illustrations.
 */

var utils = require('./ti-utils.js'),
    stylist = require('./stylist.js');

//global.stylist = stylist;

var TreeIllustrator = function(window, document, $, ko, stylist) {

    // Explicitly check for dependencies by passing them as args to the module
    if (typeof($) !== 'function') {
        alert("TreeIllustrator module cancelled, needs jQuery (as '$')");
        return null;
    }
    if (!ko || typeof(ko) !== 'object') {
        alert("TreeIllustrator module cancelled, needs KnockoutJS (as 'ko')");
        return null;
    }
    if (!stylist || typeof(stylist) !== 'object') {
        alert("TreeIllustrator module cancelled, needs 'stylist' module (as 'stylist')");
        return null;
    }

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
    var treeLayouts = {
        RECTANGLE: 'RECTANGLE',
        CIRCLE: 'CIRCLE',
        TRIANGLE: 'TRIANGLE'
    };
    var branchRotationMethods = {
        UNCHANGED: 'UNCHANGED',  // preserve the original sibling order
        ALPHABETICAL: 'ALPHABETICAL',  // also used as a tie-breaker for all methods
        LADDERIZE_RIGHT: 'LADDERIZE_RIGHT',
        LADDERIZE_LEFT: 'LADDERIZE_LEFT',
        ZIG_ZAG: 'ZIG_ZAG'
    };
    var alignments = {
        TOP: 'TOP',
        RIGHT: 'RIGHT',
        BOTTOM: 'BOTTOM',
        LEFT: 'LEFT',
        CENTER: 'CENTER'
    };
    var sweepDirections = {
        CLOCKWISE: 'CLOCKWISE',
        COUNTERCLOCKWISE: 'COUNTERCLOCKWISE'
    };
    var dataSourceTypes = {
        BUILT_IN: 'BUILT_IN',
        URL: 'URL',
        UPLOAD: 'UPLOAD'
    };
    var versionTypes = {
        CHECKSUM: 'CHECKSUM',   // e.g., a git SHA
        TIMESTAMP: 'TIMESTAMP', // e.g., a modification date
        SEMANTIC: 'SEMANTIC'    // a conventional version number, e.g., "3.2.0a"
    };
    var hostApplications = {
        JUPYTER_NOTEBOOK: 'JUPYTER_NOTEBOOK',    // a.k.a. IPython notebook
        //TODO: ARBOR_WORKFLOW: 'ARBOR_WORKFLOW' 
        //TODO: OPENTREE_TOOLS: 'OPENTREE_TOOLS'
        STANDALONE: 'STANDALONE'                 // "naked" stylist, perhaps from a static file
    };
    var storageBackends = {
        LOCAL_FILESYSTEM: 'LOCAL_FILESYSTEM',
        JUPYTER_NOTEBOOK: 'JUPYTER_NOTEBOOK',    // JSON storage in an IPython-style notebook file
        GITHUB_REPO: 'GITHUB_REPO'               // in our designated (public) repo
    }

    /* Here we can share information among all classes and instances */

    /* Cache data to improve performance or reduce network traffic: 
     *   - tree source loaded via AJAX
     *   - intermediate tree data (after one or more transforms)
     *   - supporting datasets
     *   - etc.
     * Note that initial use is by the 'stash' transform below.
     */
    var cache = { };
    var setCachedData = function(key, value, flush) {
        // add (or update) the cache for this key
        // N.B. we'll ignore the 'flush' boolean here, in favor of a checksum.
        cache[key] = value;
    }
    var getCachedData = function(key) {
        // retrieve this key's cache from the cache (or return null)
        return (key in cache) ? cache[key] : null;
    };
    var clearCachedData = function(key, options) {
        // clobber the data for this key, and possibly its dependents
        delete cache[key];
        if (options.DELETE_DEPENDENT_ITEMS) {  // TODO
            var dependents = $.filter(cache, function(cachePath, itemInfo) {
                return ($.inArray(key, itemInfo.dependencies) !== -1);
            });
            $.each(dependents, function(cachePath, itemInfo) {
                // ... and clobber *their* dependents in turn
                clearCachedData(cachePath, {DELETE_DEPENDENT_ITEMS: true}); 
            });
        }
    };
    var flushCache = function( newCacheData ) {
        // clear all keys and entries; replace with new data if found
        cache = { };
        exports.cache = cache;  // else it lags
        if (typeof newCacheData === 'object') {
            for (var key in newCacheData) {
                // Transfer each property in turn, just in case there's
                // internal housekeeping to do (checksums, timestamps, etc.)
                setCachedData( key, newCacheData[key] );
            }
        }
    };

    /* Gather various subsets (or all) of cached data in a temp object. */
    function gatherAllCachedData() {
        return $.extend({}, cache);
    }
    function gatherAllInputData() {
        // ie, everything cached under paths starting 'input/'
        return $.map(cache, function(itemInfo, cachePath) {
            if( cachePath.match(/^input\/.*/) ) {
                return { path: cachePath, value: itemInfo };
            }
            return null;
        });

        // MOOT
        var filtered = {};
        $.each(cache, function(cachePath, itemInfo) {
            if( cachePath.match(/^input\/.*/) ) {
                filtered[ cachePath ] = itemInfo;
            }
        });
        return filtered;
    }
    function gatherStaticInputData() {
        // ie, everything cached under paths starting 'input/' AND with no
        // clear provenance
        var filtered = {};
        $.each(cache, function(cachePath, itemInfo) {
            if(cachePath.match(/^input\/.*/) &&
               itemInfo.src === '') {
                filtered[ cachePath ] = itemInfo;
            }
        });
        return filtered;
    }
    function gatherAllTransformData() {
        // ie, everything cached under paths starting 'transform/'
        var filtered = {};
        $.each(cache, function(cachePath, itemInfo) {
            if( cachePath.match(/^transform\/.*/) ) {
                filtered[ cachePath ] = itemInfo;
            }
        });
        return filtered;
    }
    function gatherAllOutputData() {
        // ie, everything cached under paths starting 'output/'
        var filtered = {};
        $.each(cache, function(cachePath, itemInfo) {
            if( cachePath.match(/^output\/.*/) ) {
                filtered[ cachePath ] = itemInfo;
            }
        });
        return filtered;
    }

    /* Return the data model for a new illustration (our JSON representation) */
    var getNewIllustrationModel = function(options) {
        if (!options) options = {};
        var obj = {
            'metadata': {
                'name': "Untitled illustration",
                'url': "",  // source URL on GitHub (GitHub storage only)
                'sha': "",  // latest SHA on GitHub (GitHub storage only)
                'description': "",
                'authors': [ ],   // assign immediately to this user?
                'tags': [ ],
                'dois': [ ],
                'date_created': new Date().toISOString()
            },
            'styleGuide': {
                // maybe the defaults here are "anything goes" (all options enabled)?
                // TODO: Explicitly list all options somewhere else? 
                // TODO: Filter styles if they fall out of conformance?
                'name': "Default styles",
                'description': "Style guides are used to suggest and constrain the overall look of your illustration for a particular publication or context. You can try different styles using the <strong>Load styles...</strong> button.", // captured when assigned
                'source': {'type': dataSourceTypes.BUILT_IN, 'value': "DEFAULT"},
                'version': {'type': versionTypes.SEMANTIC, 'value': "0.1"},
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
                    ],
                    'minimumTextSize': 12,  
                        // specified in pt, but echoed using physical units above
                    'minimumLineThickness': 2,  
                        // specified in pt, but echoed using physical units above
                    'backgroundColor': "#fdd",
                    'border': "none",
                    // add default line color, thickness, node shape/size, etc.
                    'edgeColor': "#777",
                    'edgeThickness': 0.8,
                    'nodeColor': "#339",
                    'nodeShape': 'circle'  // TODO: should be an enumerated  value
                }
            },
            'style': {
                // choices and overrides from the style guide above
                'printSize': {
                    'units': units.INCHES,  // OR units.CENTIMETERS
                    'width': 8.5,  // in physical units
                    'height': 11,   // in physical units
                },
                'fontFamily': "Times New Roman, Times, serif",
                'backgroundColor': "#fdd",
                'border': "none",
                // add default line color, thickness, node shape/size, etc.
                'edgeColor': "#777",
                'edgeThickness': 0.8,
                'nodeColor': "#339",
                'nodeShape': 'circle'  // TODO: should be an enumerated  value
            },
            'elements': [
            ],
            'vegaSpec': {
                'width': 800,
                'height': 900,
                'padding': {
                    'top': 0,
                    'left': 0,
                    'bottom': 0,
                    'right': 0
                },
                'data': [ ],
                'style': { }
            }
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
        var landmarks = stylist.getPrintAreaLandmarks();
        var obj = {
            'id': newID,
            'metadata': {
                'type': 'IllustratedTree',
                'name': "Untitled ("+ newID +")",
                'source': {
                    'type': dataSourceTypes.BUILT_IN, 
                    'value': './placeholder-tree.json',
                    'phylesystemStudyID': '',
                    'phylesystemTreeID': ''
                },
                'description': "",
                'dois': [ ]
            },
            'data': { },
            'layout': treeLayouts.CIRCLE,
            /* Overload the model with all layout properties. We'll use the
             * ones that current apply *and* retain last-known values for
             * others, in case the user switches back to a prior layout
             */
            'branchRotation': branchRotationMethods.UNCHANGED,
            'width': landmarks.width * 0.4,
            'height': landmarks.height * 0.4,
            'radius': Math.min(landmarks.height, landmarks.width) * 0.3,
            'radialArc': [0, 350],
            'radialSweep': sweepDirections.CLOCKWISE,
            'tipsAlignment': alignments.RIGHT,
            'rootX': landmarks.centerX + utils.jiggle(5),   // TODO: use a bounding box instead?
            'rootY': landmarks.centerY + utils.jiggle(5),
            'nodeLabelField': 'ottTaxonName',         // matches the placeholder tree
            'style': {
                // incl. only deviations from the style guide above?
/*
                'edgeThickness': 1.0,  
                'edgeColor': '#999',
                'labelTextHeight': illustration.styleGuide.constraints.minimumTextSize()
*/
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
                'type': 'SupportingDataset',
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
                'type': 'Ornament',
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

        self.getElementByID = function( elementID ) {
            // return an element (eg, an IllustratedTree), or null if not found
            var foundElement = null;
            $.each(self.elements(), function(i, el) {
                if (el.id() === elementID) {
                    foundElement = el;
                    return false;
                }
            });
            return foundElement;
        }

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
                case dataSourceTypes.URL:
                    var itsURL = self.styleGuide.source.value();
                    return '<a href='+ itsURL +' target="_blank">'+ itsURL +'</a>';
                case dataSourceTypes.BUILT_IN:
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

            // update visible canvas and d3 viz
            stylist.refreshViz();
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

            // update visible canvas and d3 viz
            stylist.refreshViz();
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
        self.unitsFullName = ko.computed(function() {
            switch( self.style.printSize.units() ) {
                case units.INCHES:
                    return "inches"
                case units.CENTIMETERS:
                    return "centimeters";
            }
        }, self, {deferEvaluation:true});
        self.unitsDisplayAbbreviation = ko.computed(function() {
            switch( self.style.printSize.units() ) {
                case units.INCHES:
                    return "in."
                case units.CENTIMETERS:
                    return "cm";
            }
        }, self, {deferEvaluation:true});
        self.unitsCssSuffix = ko.computed(function() {
            switch( self.style.printSize.units() ) {
                case units.INCHES:
                    return "in"
                case units.CENTIMETERS:
                    return "cm";
            }
        }, self, {deferEvaluation:true});

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
                $('#style-fontfamily-options').hide();
            } else {
                $('#style-fontfamily-options').show();
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
            var chosenSize = self.styleGuide.constraints.minimumTextSize();
            if (isNaN(chosenSize) || $.trim(chosenSize) === '') {
                // rejects any non-numeric chars, allows whitespace and decimal
                html = '<em>This value must be a number</em>';
            } else {
                // echo the new size (in pt) as inches/cm
                chosenSize = parseFloat(chosenSize);
                var convertedSize = self.style.printSize.units() === units.INCHES ?
                    stylist.pointsToInches( chosenSize ) :
                    stylist.pointsToCentimeters( chosenSize );
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
            var chosenSize = self.styleGuide.constraints.minimumLineThickness();
            if (isNaN(chosenSize) || $.trim(chosenSize) === '') {
                // rejects any non-numeric chars, allows whitespace and decimal
                html = '<em>This value must be a number</em>';
            } else {
                // echo the new size (in pt) as inches/cm
                chosenSize = parseFloat(chosenSize);
                var convertedSize = self.style.printSize.units() === units.INCHES ?
                    stylist.pointsToInches( chosenSize ) :
                    stylist.pointsToCentimeters( chosenSize );
                convertedSize = convertedSize.toFixed(2);
                var unitSuffix = self.style.printSize.units() === units.INCHES ?
                    'inches' : 'cm';
                html = 'pt &nbsp;('+ convertedSize +' '+ unitSuffix +')';
            }
            return html;
        }, self, {deferEvaluation:true});

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
        self.confirmRemoveElement = function(el) {
            var displayName, removeMethod;
            if (el instanceof IllustratedTree) {
                if (confirm("Are you sure you want to remove this tree? This cannot be undone!")) {
                    self.removeIllustratedTree(el);
                }
            } else if (el instanceof SupportingDataset) {
                if (confirm("Are you sure you want to remove this dataset? This cannot be undone!")) {
                    self.removeSupportingDataset(el);
                }
            } else if (el instanceof Ornament) {
                if (confirm("Are you sure you want to remove this ornament? This cannot be undone!")) {
                    self.removeOrnament(el);
                }
            } else {
                console.error("confirmRemoveElement(): unexpected element type: '"+ el.metadata.type() +"'!");
                return;
            }
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
            'copy': [ 'vegaSpec' ],
            // 'observe': [ ], // WARNING: using this flips default mapping!
            'elements': {
                'create': function(options) {
                    // create these as object instances
                    var data = options.data;
                    var dataParent = options.parent;
                    var _illustration = self;
                    switch(data.metadata.type) {
                        // pass illustration to get IDs as needed
                        case 'IllustratedTree':
                            return new IllustratedTree(_illustration, data);
                        case 'SupportingDataset':
                            return new SupportingDataset(_illustration, data);
                        case 'Ornament':
                            return new Ornament(_illustration, data);
                    }
                    // keep it simple by default
                    console.warn("Unexpected element type '"+ data.metadata.type +"'! Creating a generic observable...");
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

        applyStyleGuide: function(data) {
            var self = this;
            ko.mapping.fromJS(data, Illustration.mappingOptions, self.styleGuide);

            /* Some properties are *forced* (rather then suggested) to comply
             * with the active style guide. 
             *
             * TODO: Reconsider this! Each field should probably be defined
             * either as a constraint OR a per-illustration * style assertion.
             */
            var forcedStyles = [
                'backgroundColor',
                'border',
                'edgeColor',
                'edgeThickness',
                'nodeColor',
                'nodeShape'
            ];
            $.each(forcedStyles, function(i, propName) {
                self.style[propName]( self.styleGuide.constraints[propName]() );
            });

            self.updatePrintSizeChooser();
            self.updateFontFamilyChooser();
            stylist.refreshViz();
        },

        addIllustratedTree: function() {
            var self = this;
            var tree = new IllustratedTree(self);
            self.elements.push(tree);
            stylist.refreshViz();
            return tree;
        },
        removeIllustratedTree: function(tree) {
            var self = this;
            self.elements.remove(tree);
            stylist.refreshViz();
            delete tree;
        },

        addSupportingDataset: function() {
            var self = this;
            var ds  = new SupportingDataset(self);
            self.elements.push(ds);
            stylist.refreshViz();
            return ds;
        },
        removeSupportingDataset: function(ds) {
            var self = this;
            self.elements.remove(ds);
            stylist.refreshViz();
            delete ds;
        },

        addOrnament: function() {
            var self = this;
            var obj  = new Ornament(self);
            self.elements.push(obj);
            stylist.refreshViz();
            return obj;
        },
        removeOrnament: function(obj) {
            var self = this;
            self.elements.remove(obj);
            stylist.refreshViz();
            delete obj;
        },

        /* For a given node, retrieve the best possible label field
         * (optionally from a ranked list of fields) or its text.
         *
         * This is CURRENTLY UNUSED, but may be useful if we want to support
         * fallback labeling based on a ranked list of sources, for example
         *   ['explicitLabel', 'ottTaxonName', 'originalLabel']
         */
        getPreferredLabelField: function(node, rankedFields) {
            if (!rankedFields) {
                rankedFields = ['explicitLabel','ottTaxonName','originalLabel','ottId'];
            }
            var foundNonEmptyLabel = 'explicitLabel';  // a harmless default
            $.each(rankedFields, function(i,fieldName) {
                if (node[fieldName]) {
                    foundNonEmptyLabel = fieldName;
                    return false;  // stop checking
                }
            });
            console.warn("Using label field '"+ foundNonEmptyLabel +"' for this node:");
            console.warn(node);
            return foundNonEmptyLabel;
        },
        getPreferredLabelText: function(node, rankedFields) {
            var self = this;
            var preferredField = self.getPreferredLabelField(node, rankedFields);
            var preferredText = node[preferredField];
            if (typeof preferredText === 'string') {
                return preferredText;
            }
            return '';
       },

        /* For a given element (eg, a tree, node, edge, ornament, or the
         * illustration itself), get the most "local" matching style value for
         * the specified property. By default, this should conform to the 
         * illustration itself, or its active style guide.
         */
        getEffectiveStyle: function(obj, propName) {
            var self = this;
            if ('style' in obj) {
                if (propName in obj.style) {
                    // handle observables or simple values
                    var rawValue = ko.utils.unwrapObservable(obj.style[propName]);
                    var constrainedValue = self.getConstrainedStyle(propName, rawValue);
                    return constrainedValue;
                }
            }
            // property wasn't found locally; check the next "innermost" context 
            if (obj instanceof IllustratedTree) {
                return self.getEffectiveStyle(self, propName);
            } else if (obj instanceof Illustration) {
                console.error("getEffectiveStyle(): style '"+ propName +"' not found in this tree's style:");
                console.error(obj.style);
                return;
            } else if (obj instanceof SupportingDataset) {
                console.error("getEffectiveStyle(): SupportingDataset is not yet supported!");
                return;
            } else if (obj instanceof Ornament) {
                console.error("getEffectiveStyle(): Ornament is not yet supported!");
                return;
            } else {
                console.error("getEffectiveStyle(): unexpected context object:");
                console.error(obj);
                return;
            }
        },
        getConstrainedStyle: function (propName, rawValue) {
            var self = this;
            switch(propName) {
                case 'edgeThickness':
                case 'borderThickness':
                    // assume these are in common units (pt?)
                    var thinnest = self.styleGuide.constraints.minimumLineThickness();
                    return Math.max(rawValue, thinnest);
                // TODO: add (many) more cases here, or constrain elsewhere..
                default:
                    // anything goes, return unchanged
                    return rawValue;
            }
        },

        updateVegaSpec: function(options) {
            /* Sweep the Illustration model and (re)generated a full Vega spec.
             * This drives the d3 visualization in the editor viewport.
             */
            var self = this;
            var spec = self.vegaSpec;

            // clear all groups and marks, and restore the empty illustration-elements group
            spec.marks = [ ];
            // reckon the current width and height as internal px
            var pxPrintWidth = stylist.physicalUnitsToPixels(self.style.printSize.width(), stylist.internal_ppi);
            var pxPrintHeight = stylist.physicalUnitsToPixels(self.style.printSize.height(), stylist.internal_ppi);
            var illustrationElementsGroup = {
                "type": "group",
                "name": "illustration-elements",  // becomes marker class .illustration-elements
                "properties": {
                    "enter": {
                        "x": {"value": 0},
                        "y": {"value": 0},
                        "height": {"value": pxPrintHeight },
                        "width": {"value": pxPrintWidth }
                    }
                },
                "scales": [ ],
                "axes": [ ],
                "marks": [ ]
            };
            spec.marks.push( illustrationElementsGroup );

            // clear and rebuild data based on current elements
            spec.data = [ ];

            $.each(self.elements(), function(i, el) {
                // Add appropriate data *and* marks as needed
                if (el instanceof IllustratedTree) {
                    var dataSourceName = el.id();  // "tree-3" or similar
                    var treeData = {
                        'name': dataSourceName,
                        'format': {"type":"treejson"},  // initial match for JSON object, vs. array
                         // TODO: support args for "treesCollectionPosition", "treePosition" or "treeID"?
                        'transform': [
                            // TODO: add all possible properties (common to by all formats?)
                            // TODO: merge supporting data from other files? or do that downstream?
                            // TODO: final tailoring to phylogram layout (one, or several?)
                        ]
                    }

                    /* Define data source for this element (allow for inline tree data? in 
                     * existing datasets? other kinds of sources?)
                     * NOTE that we should use cached data when possible, to avoid 
                     * an AJAX fetch each time we tweak the visual presentation of a tree!
                     */
                    var treeSourceCacheKey = 'input/ELEMENT-SOURCE-';
                    console.warn('=== source for element "'+ dataSourceName +'" ===');
                    console.warn('  type: '+ el.metadata.source.type());
                    console.warn('  value: '+ el.metadata.source.value());
                    switch (el.metadata.source.type()) { 
                        case dataSourceTypes.BUILT_IN:
                        case dataSourceTypes.URL:
                            treeSourceCacheKey += $.trim(el.metadata.source.value());
                            var cachedValue = getCachedData( treeSourceCacheKey );
                            if (cachedValue) {
                                // N.B. This data will be safely cloned by Vega when spec is parsed!
                                treeData.values = cachedValue;
                            } else {
                                treeData.url = el.metadata.source.value();
                            }
                            break;
                        case dataSourceTypes.UPLOAD:
                            var sourceValue = $.trim(el.metadata.source.value());
                            if (sourceValue === '') {
                                console.log("updateVegaSpec(): ignoring empty paste/uploads for now");
                                return;
                            }
                            //var treeSourceCacheKey = ('PASTED-SOURCE-' + sourceValue);
                            var treeSourceCacheKey = ('input/PASTED-TREE-' + sourceValue);

                            var cachedValue = getCachedData( treeSourceCacheKey );
                            if (cachedValue) {
                                // N.B. This data will be safely cloned by Vega when spec is parsed!
                                treeData.values = cachedValue;
                            } else {
                                console.warn("Still waiting for pasted text (Newick?) of '"+ el.metadata.name() +"'to be converted...");
                            }
                            break;
                        // TODO: add cases for other data sources
                        default:
                            console.error("Unknown source type for tree!");
                    }

                    /* Build an appropriate chain of data transforms */

                    // Cache the source data, if not already found
                    treeData.transform.push({
                        "type": "stash", 
                        "cacheSetter": 'TreeIllustrator.setCachedData',
                        "key": treeSourceCacheKey,
                        "flush": false
                    });

                    // Next transform imports data from its source format to our basic phyloTree
                    if (true) {   // TODO: Pivot to other importers (e.g. NEXUS), as appropriate
                        treeData.transform.push({
                            "type": "nexson", 
                            "treesCollectionPosition":0, 
                            "treePosition":0,
                            "branchRotation": el.branchRotation(),
                            "nodeLabelField": el.nodeLabelField()   // needed for alphabetical branch rotation!
                        });
                    }

                    // TODO: Shape the phyloTree using preferred tree layout and styles
                    var phylogramTransform = { 
                        "type": "phylogram", 
                        //"layout": "cartesian",
                        //"branchStyle": "diagonal",  // other options here?
                        "radialArc": el.radialArc(),
                        "radialSweep": el.radialSweep(),
                        "branchLengths": "",  // empty/false, or a property name to compare?
                        "width": el.width(),
                        "height": el.height(), 
                        "radius": el.radius(), 
                        "tipsAlignment": el.tipsAlignment()
                    };
                    treeData.transform.push( phylogramTransform );
                    switch (el.layout()) { 
                        case treeLayouts.RECTANGLE:
                            phylogramTransform.layout = 'cartesian';
                            break;
                        case treeLayouts.CIRCLE:
                            phylogramTransform.layout = 'radial';
                            break;
                        case treeLayouts.TRIANGLE:
                            phylogramTransform.layout = 'cladogram';
                            break;
                    }

                    spec.data.push(treeData);

                    // set label properties (esp. positioning) based on the chosen layout
                    var textHeight = self.styleGuide.constraints.minimumTextSize();   // TODO: adjustable font size (convert pt to px)
                    var halfTextHeight = textHeight * 0.4;   // TODO: adjustable font size (convert pt to px)
                    var initialLabelProperties = {
                        "fontSize": {"value": textHeight} 
                    };
                    switch (el.layout()) { 
                        case treeLayouts.RECTANGLE:
                        case treeLayouts.TRIANGLE:
                            // Label offsets depend on orientation
                            var labelNudgeX, labelNudgeY, labelAlign, labelRotation;
                            var nodeLabelGap = 6;  // TODO: base this on font size
                            switch (el.tipsAlignment()) {
                                case alignments.TOP:
                                    // NOTE the odd mapping of X and Y
                                    labelNudgeX = nodeLabelGap;
                                    labelNudgeY = halfTextHeight;
                                    labelAlign = 'left';
                                    labelRotation = -90;
                                    break;
                                case alignments.RIGHT:
                                    labelNudgeX = nodeLabelGap;
                                    labelNudgeY = halfTextHeight;
                                    labelAlign = 'left';
                                    labelRotation = 0;
                                    break;
                                case alignments.BOTTOM:
                                    labelNudgeX = nodeLabelGap;
                                    labelNudgeY = halfTextHeight;
                                    labelAlign = 'left';
                                    labelRotation = 90;
                                    break;
                                case alignments.LEFT:
                                    labelNudgeX = -nodeLabelGap;
                                    labelNudgeY = halfTextHeight;
                                    labelAlign = 'right';
                                    labelRotation = 0;
                                    break;
                            }
                            // Add simple properties for cartesian / rectangular layouts
                            $.extend(initialLabelProperties, {
                                "x": {"field": "x"},
                                "y": {"field": "y"},
                                "dx": {"value": labelNudgeX},
                                "dy": {"value": labelNudgeY},
                                "align": {"value": labelAlign},
                                "angle": {"value": labelRotation}
                            });
                            break;

                        case treeLayouts.CIRCLE:
                           /* Add properties for radial/polar layouts.
                            * Radius and theta (angle from origin, in radians) are the
                            * alternatives to X and Y for polar projection, and assume
                            * that the x and y properties represent the origin or center
                            * of the layout, ie, the root node. See discussion at
                            *  https://github.com/trifacta/vega/pull/187
                            */
                            $.extend(initialLabelProperties, {
                                "x": {"value": 0},  // this is origin for radial/polar projection
                                "y": {"value": 0},
                                "radius": {"field": "radius"},  // px from origin
                                "theta": {"field": "theta"},  // in radians (what direction from origin)
                                "align": {"field": 'align'},  // NOTE that some labels are flipped 180deg for legibility
                                "angle": {"field": "angle"}   // in degrees
                            });
                            break;
                    }

                    // place new trees in the center of the printable area (slightly staggered for clarity)
                    var treeMarks = { 
                        "type": "group",
                        "name": el.id(),  // becomes marker class .tree-3 or similar
                        "properties": {
                            "enter": {
                                "x": {"value": el.rootX()},
                                "y": {"value": el.rootY()}
                            },
                            "update": {
                                //"transform": {"value":"scale(800,300)"}
                                //"transform": {"value":"rotate(25) scale(20,20)"}
                            }
                        },
                        "marks": [
                            { /* pathsfor tree edges 
                                 N.B. This expects pre-existing links with 'source' and 'target' properties! The 'link' transform is 
                                 just to provide a rendered path of the desired type. */
                              "type": "path",
                              //"from": {"data": "phyloTree", "property": "links", "transform": [{"type": "link", "shape": "line"}]},
                              "from": {
                                "data": dataSourceName,
                                "transform": [
                                  {"type":"pluck", "field":"phyloEdges" }
                                // how do apply the 'time' scale here? TRY brute-forcing x and y properties
                                  //{"type":"formula", "field":"source.x", "expr":"d.source.y"},
                                  //{"type":"formula", "field":"target.x", "expr":"d.target.y"},
                                  // {"type":"link", "shape":"line" }  // line | curve | diagonal | diagonalX | diagonalY
                                  // {"type":"phylogramLink", "shape":"rightAngleDiagonal" }  // rightAngleDiagonal | radialRightAngleDiagonal
                                ]
                              },
                              "properties": {
                                "update": {
                                  "path": {"field": "path"}, // , "transform":{"scale":"x"}},
                                  "stroke": {"value": self.getEffectiveStyle(el, 'edgeColor')},
                                  "strokeWidth": {"value": self.getEffectiveStyle(el, 'edgeThickness')}
                                },
                                "hover": {
                                 // "stroke": {"value": "red"}
                                    }
                                  }
                                }
                                ,
                                {   /* group node/label pairs, for easier event binding later */
                                    "type":"group",
                                    "marks":[
                                        {
                                            "type": "symbol",
                                            "from": {"data": dataSourceName, "transform": [{"type":"pluck", "field":"phyloNodes" }] },
                                            "properties": {
                                                "enter": {
                                                    "x": {"XXscale": "x", "field": "x", "mult":1},
                                                    "y": {"XXscale": "y", "field": "y", "mult":1}
                                                },
                                                "update": {
                                                    "shape": {"value":"circle"},
                                                    "size": {"value": 8},
                                                    "fill": {"value": "black"}
                                                },
                                                "hover": {
                                                    // "fill": {"value": "red"}
                                                }
                                            }
                                        } /* end of node marks */
                                        ,
                                        {  // label marks
                                            "type": "text",
                                            "from": {"data": dataSourceName, "transform": [{"type":"pluck", "field":"phyloNodes" }] },
                                            "properties": {
                                                "enter": initialLabelProperties,
                                                "update": {
                                                    "text": {"field": el.nodeLabelField() },
                                                    "fill": {"value":"black"}
                                                },
                                                "hover": {
                                                    "fill": {"value": "red"}
                                                }
                                        }
                                    } /* end of label marks */
                                ]
                            } /* end of grouped node+label */ 
                            ,
                            {   /* group tree hotspot and handles */
                                "type":"group",
                                "name": "handles",
                                "marks":[
                                    {  /* hotspot for direct manipulation of the tree */
                                        "name": "tree-hotspot",
                                        "type": "path",
                                        "from": {
                                            "data": dataSourceName,
                                            "transform": [
                                                {"type":"pluck", "field":"hotspot" }
                                            ]
                                        },
                                        "properties": {
                                            "update": {
                                                "path": {"field": "path"},  // TODO: Can we make this dynamic, perhaps a callable?
                                                "stroke": {"value": "#0f0"},
                                                "strokeWidth": {"value": "1px"},
                                                "strokeOpacity": {"value": "0.0"},
                                                "fill": {"value": "#000"},  /* override this in CSS */
                                                "fillOpacity": {"value": "0.0"}
                                            },
                                            "hover": {
                                                //"opacity": {"value": "0.1"}
                                            }
                                        }
                                    },
                                    {  /* corner handles for size and angle adjustments */
                                        "name": "vertex-handle actual-size",
                                        "type": "symbol",
                                        "from": {
                                            "data": dataSourceName,
                                            "transform": [
                                              {"type":"pluck", "field":"vertexHandles" }
                                            ]
                                        },
                                        "properties": {
                                            "enter": {
                                                "name": {"field":"name"},  /* assigned to datum, not to mark! */
                                                "tooltip": {"field":"tooltip"},  /* assigned to datum, not to mark! */
                                                "shape": {"field": "shape"}, /* default shape is "circle" */
                                                "size": {"field": "size"},
                                                "fill": {"value": "#000"},  /* override this in CSS */
                                                "fillOpacity": {"value": "0.0"},
                                                "stroke": {"value": "#f00"},
                                                "strokeWidth": {"value": "6"},  /* hidden hit area */
                                                "strokeOpacity": {"value": "0.0"}
                                            },
                                            "update": {
                                                "x": {"field": "x"},
                                                "y": {"field": "y"},
                                            },
                                            "hover": {
                                                //"opacity": {"value": "0.1"}
                                            }
                                        }
                                    }
                                 ]
                            }
                        ] /* end of inner group marks */
                    }; /* end of inner group */

                    illustrationElementsGroup.marks.push( treeMarks );

                } else if (el instanceof SupportingDataset) {
                    console.log("updateVegaSpec(): ignoring datasets for now");

                } else if (el instanceof Ornament) {
                    console.log("updateVegaSpec(): ignoring ornaments for now");

                } else {
                    console.error("updateVegaSpec(): unexpected element type: '"+ el.metadata.type() +"'!");
                }
            });

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

        // point back to my parent illustration?
        //self.illustration = illustration;

        /* Apply hard constraints to some properties and wrap their fields
         * accordingly. We do this by binding each basic property to a
         * writable computed observable that applies any constraints before
         * updating its value, protecting us from out-of-bounds or nonsensical
         * values.
         */
        var treeSizeConstraint = {
            'type': Number,
            'min': stylist.inchesToPixels( 0.25, stylist.internal_ppi),  // 1/4" tree seems like a reasonable minimum
            // TODO: Check for a minimum in the current style guide?
            'max': stylist.inchesToPixels( 1000, stylist.internal_ppi)  // stop at 1000 inches wide
        }
        self.constrainedWidth = wrapFieldWithConstraints(self, 'width', treeSizeConstraint);
        self.constrainedHeight = wrapFieldWithConstraints(self, 'height', treeSizeConstraint);
        self.constrainedRadius = wrapFieldWithConstraints(self, 'radius', treeSizeConstraint);

        // Bind some fields to writable computed observables, so users can "think in physical units"
        self.physicalWidth = wrapFieldWithPhysicalUnits(self, 'constrainedWidth');
        self.physicalHeight = wrapFieldWithPhysicalUnits(self, 'constrainedHeight');
        self.physicalRadius = wrapFieldWithPhysicalUnits(self, 'constrainedRadius');
        self.physicalRootX = wrapFieldWithPhysicalUnits(self, 'rootX');
        self.physicalRootY = wrapFieldWithPhysicalUnits(self, 'rootY');

        ko.mapping.fromJS(data, Illustration.mappingOptions, self);

        // (Un)bundle 'startAngle' and 'endAngle' values used in radialArc
        self.startAngle = ko.computed({
            read: function() {
                return self.radialArc()[0];
            },
            write: function(value) {
                var arc = self.radialArc();
                arc[0] = Number(value);
                self.radialArc(arc);
            },
            deferEvaluation: true
        });
        self.endAngle = ko.computed({
            read: function() {
                return self.radialArc()[1];
            },
            write: function(value) {
                var arc = self.radialArc();
                arc[1] = Number(value);
                self.radialArc(arc);
            },
            deferEvaluation: true
        });

        // Add validation for fields that need it
        self.metadata.name.extend({required: true});

        // capture hotspot and handle logic?
        self.hotspot = data.hotspot;

        // TODO: Based on the element type, offer appropriate styles and constraints
        // TODO: Include options to map selected data to visual style
        return self;
    }
    IllustratedTree.prototype = {
        constructor: IllustratedTree,

        useChosenLayout: function(newValue) {
            var self = this;
            if (newValue in treeLayouts) {
                self.layout(newValue);
            } else {
                console.error("useChosenLayout(): Unknown tree layout '"+ newValue +"'!"); 
            }
            stylist.refreshViz();
        }
        ,
        useChosenTreeDataSource: function() {
            var self = this;
            // pick up latest data from bound widgets
            var $chooser = $('#'+ self.id() +'-datasource-chooser');
            var $opentreeIDsPanel = $('#'+ self.id() +'-datasource-opentreeids-panel');
            var $nexsonUrlPanel = $('#'+ self.id() +'-datasource-nexsonurl-panel');
            var $fileUploadPanel = $('#'+ self.id() +'-datasource-upload-panel');
            var $fileFormatChooser = $('#'+ self.id() +'-datasource-format');
            var chosenSource = $chooser.val();
            switch(chosenSource) {
                /* Match against strings defined in `stylist.js`. We'll start
                 * with some special cases that drive changes to the UI.
                 */
                case "Enter OpenTree study and tree ids":
                    $opentreeIDsPanel.show();
                    $nexsonUrlPanel.hide();
                    $fileUploadPanel.hide();
                    self.metadata.source.type(dataSourceTypes.URL);
                    var studyID = self.metadata.source.phylesystemStudyID(); 
                    var treeID = self.metadata.source.phylesystemTreeID();
                    var treeNexsonURL = 'https://api.opentreeoflife.org/phylesystem/v1/study/'
                                      + studyID +'/tree/'+ treeID +'?output_nexml2json=1.0.0';
                    self.metadata.source.value( treeNexsonURL );
                    break;

                case "Enter URL to NexSON 1.0":
                    $opentreeIDsPanel.hide();
                    $nexsonUrlPanel.show();
                    $fileUploadPanel.hide();
                    self.metadata.source.type(dataSourceTypes.URL);
                    var $otherField = $('#'+ self.id() +'-datasource-nexsonurl');
                    self.metadata.source.value( $.trim($otherField.val()) );
                    break;

                case "Enter URL to a GitHub gist":
                    $opentreeIDsPanel.hide();
                    $nexsonUrlPanel.show();
                    $fileUploadPanel.hide();
                    self.metadata.source.type(dataSourceTypes.URL);
                    var $otherField = $('#'+ self.id() +'-datasource-nexsonurl');
                        // TODO: Use another field for Gist URLs?
                    self.metadata.source.value( $.trim($otherField.val()) );
                    break;

                case "Enter or upload tree data":
                //case "Upload tree data":
                case "Newick string":
                case "Newick string with extra data":
                case "NEXUS":
                    $opentreeIDsPanel.hide();
                    $nexsonUrlPanel.hide();
                    // enable "pasted text" field for this method
                    var $pastedField = $('#'+ self.id() +'-datasource-pasted');
                    $pastedField.attr('disabled', false)
                                .css('color','#aaa');
                    $fileUploadPanel.show();

                    switch(chosenSource) {
                        case "Newick string":
                        case "Newick string with extra data":
                            $fileFormatChooser.val('newick');
                            break;
                        case "NEXUS":
                            $fileFormatChooser.val('nexus');
                            break;
                        case 'NeXML':
                            $fileFormatChooser.val('nexml');
                            break;
                        case 'phylo (R data frame)':
                            $fileFormatChooser.val('phylo');
                            break;
                        default:
                            $fileFormatChooser.val('');
                            break;
                    }
                    break;

                default:
                    /* Handle common cases for listed tree sources:
                     *  - explicit "fetch" URLs for data on the web
                     *  - Jupyter kernel values from a hosting notebook
                     */
                    // Look for the matching URL at any level of this tree of *observable* arrays
                    var testLists = [stylist.availableTrees()];
                    $.each(stylist.availableTrees(), function(i, testItem) {
                        if ('children' in testItem) {
                            testLists.push(testItem.children());
                        }
                    });
                    var treeInfo = null;
                    $.each(testLists, function(i, testList) {
                        // ASSUMES unique display text for all items in nested list!
                        var selectedTrees = $.grep(testList, function(o) {
                            return o.name() === chosenSource;
                        });
                        if (selectedTrees.length > 0) {
                            treeInfo = selectedTrees[0];
                        }
                    });
                    if (!treeInfo) {
                        console.warn("No tree found under '"+ chosenSource +"'!");
                        return;
                    }
                    if ('url' in treeInfo) {
                        $opentreeIDsPanel.hide();
                        $nexsonUrlPanel.hide();
                        $fileUploadPanel.hide();
                        self.metadata.source.type(dataSourceTypes.URL);
                        self.metadata.source.value( treeInfo.url() );
                    } else if ('kernel' in treeInfo) { // or 'kernel'? 'nbkernel'?
                        // assume this is 'python' for now
                        $opentreeIDsPanel.hide();
                        $nexsonUrlPanel.hide();
                        // Disable the format chooser while we try to guess
                        var $inputFormatChooser = $('#'+ self.id() +'-datasource-format');
                        $inputFormatChooser.attr('disabled', true);
                        // disable "pasted text" field (display only)
                        var $pastedField = $('#'+ self.id() +'-datasource-pasted');
                        $pastedField.attr('disabled', true)
                                    .css('color',''); // restore default text color
                        $fileUploadPanel.show();
                        // TODO: For a multi-kernel notebook, expect a specific kernel-id, eg 'python2'
                        var nbVarName = treeInfo.name().split(' ')[0];
                        stylist.storage[ storageBackends.JUPYTER_NOTEBOOK ].getTreeSourceData(nbVarName, function(response) {
                            console.warn('getTreeSourceData returning for tree "'+ treeInfo.name() +'"...');
                            if ('data' in response) {
                                var treeSourceData = response.data;
                                /* To interpret this as tree source data, we'll 
                                 * need to figure out its format. Pass it to a 
                                 * series of "sniffers" to identify Newick, Nexson, etc.
                                 */
                                // TODO: push this source into persistent storage?
                                ///self.metadata.source.value(treeSourceData);
                                var matchingFormat = mostLikelyDataFormat(treeSourceData);
                                $inputFormatChooser.val(matchingFormat);
                                // show something friendly in the (disabled) text field
                                var treeSourceAsText = (typeof treeSourceData === 'string') ?
                                    treeSourceData :
                                    JSON.stringify(treeSourceData);
                                $pastedField.val(treeSourceAsText);
                            } else {
                                var msg = response.error || "No data returned (unspecified error)!";
                                console.error(msg);
                                alert(msg);
                            }
                            $inputFormatChooser.attr('disabled', false);
                        });
                    } else {
                        // Maybe this string should be added to the special cases above!
                        console.warn("No URL or kernel found for '"+ chosenSource +"'!");
                        return;
                    }
            }
            stylist.refreshViz();
        }
        ,
        useChosenLabelField: function() {
            var self = this;
            // pick up latest data from bound widgets
            var $chooser = $('#'+ self.id() +'-labelfield-chooser');
            self.nodeLabelTextField = $chooser.val();
            stylist.refreshViz();
        }
        ,
        convertSourceDataToNexson: function(treeID, srcText) {
            // Convert pasted/uploaded source data to nexson, using the
            // conversion methods in the main open tree curation tool.  
            // N.B. This is used for newly pasted/uploaded text as well as for
            // source data loaded from an existing illustration.
            var self = this;  // the tree in question

        }
        ,
        convertPastedDataToTree: function(treeID) {
            // Try to convert pasted/uploaded text to nexson, using the conversion
            // methods in the main open tree curation tool.
            var self = this;  // the tree in question
            var $pastedField = $('#'+ self.id() +'-datasource-pasted');
            var pastedText = $.trim($pastedField.val());
            if (pastedText === '') {
                alert("Please paste Newick or other text into the text area provided, then try again.");
                // TODO: clear any cached and internal values regardless, to hide an old tree?
                return;
            }
            self.convertSourceDataToNexson(treeID, pastedText);

            // TODO
            self.metadata.source.value( pastedText );
            self.metadata.source.type(dataSourceTypes.UPLOAD);
            //var treeSourceCacheKey = ('PASTED-SOURCE-' + $.trim(self.metadata.source.value()));
            var treeSourceCacheKey = ('input/PASTED-TREE-' + $.trim(self.metadata.source.value()));
            console.warn('...converting pasted data to tree...');
            // TODO: build up cache key with format + content?
            var cachedValue = getCachedData( treeSourceCacheKey );
            if (cachedValue) {
                // N.B. This data will be safely cloned by Vega when spec is parsed!
                // NOTE that we should still refresh immediately, in case the cached tree data was loaded
                // created for another tree, or an earlier version of this one.
                self.nodeLabelField('explicitLabel');
                stylist.refreshViz();
            } else {
                // call opentree web services to convert to nexson
                //TODO: Apply other pasted formats (and REMEMBER THEM in the saved illustration!)
                var $inputFormatChooser = $('#'+ self.id() +'-datasource-format');
                //$inputFormatChooser.attr('disabled', true);
                var inputFormat = $inputFormatChooser.val();
                if (inputFormat === '') {
                    alert("Please choose the format of this tree data, then try again.");
                    return;
                }
                $.ajax({
                    type: 'POST',
                    dataType: 'json',
                    // crossDomain: true,
                    contentType: "application/json; charset=utf-8",
                    url: 'https://devtree.opentreeoflife.org/curator/to_nexson',
                    /* NOTE that idPrefix and firstAvailable*ID args are
                     * currently required to get well-formed Nexson!
                     */
                    data: ('{"output": "ot:nexson", '+
                            '"auth_token": "ANONYMOUS", '+
                            '"idPrefix": "", ' +
                            '"firstAvailableEdgeID": "1", '+
                            '"firstAvailableNodeID": "1", '+
                            '"firstAvailableOTUID": "1", '+
                            '"firstAvailableOTUsID": "1", '+
                            '"firstAvailableTreeID": "1", '+
                            '"firstAvailableTreesID": "1", '+
                            '"firstAvailableAnnotationID": "1", '+
                            '"firstAvailableAgentID": "1", '+
                            '"firstAvailableMessageID": "1", '+
                            '"inputFormat": '+ JSON.stringify(inputFormat) +', '+
                            '"content": '+ JSON.stringify($.trim(self.metadata.source.value())) +
                           ' }'),
                    processData: false,
                    complete: function( jqXHR, textStatus ) {
                        // report errors or malformed data, if any
                        if (textStatus !== 'success') {
                            if (jqXHR.status >= 500) {
                                // major server-side error, just show raw response for tech support
                                var errMsg = 'Sorry, there was an error ('+ jqXHR.status +') converting this tree to Nexson:\n\n'+ jqXHR.responseText;
                                alert(errMsg);
                                return;
                            }
                            // Server blocked the save due to major validation errors!
                            var data = $.parseJSON(jqXHR.responseText);
                            // TODO: This should be properly parsed JSON, show it more sensibly
                            // (but for now, repeat the crude feedback used above)
                            var errMsg = 'Sorry, there was an error ('+ jqXHR.status +') converting this tree to Nexson:\n\n'+ jqXHR.responseText;
                            alert(errMsg);
                            return;
                        }
                        // Pasted tree was converted successfully; capture the Nexson as a string
                        var data = $.parseJSON(jqXHR.responseText);

                        // fix any quirks to conform to our expected Nexson structure
                        fixUpConvertedNexson(data);

                        // store it in the cache, at the key defined above
                        console.warn('...storing pasted data in cache... key='+ treeSourceCacheKey);
                        setCachedData( treeSourceCacheKey, data );
                        // force node-label field to show "explicit" labels (TODO: for Newick only?)
                        self.nodeLabelField('explicitLabel');
                        stylist.refreshViz();
                    }
                });
            }
        }
        ,
        useChosenTipsAlignment: function(newValue) {
            var self = this;
            if (newValue in alignments) {
                self.tipsAlignment(newValue);
            } else {
                console.error("useChosenTipsAlignment(): Unknown tips alignment '"+ newValue +"'!");
            }
            stylist.refreshViz();
        }
        ,
        useChosenRadialSweep: function(newValue) {
            var self = this;
            if (newValue in sweepDirections) {
                self.radialSweep(newValue);
            } else {
                console.error("useChosenRadialSweep(): Unknown sweep direction '"+ newValue +"'!");
            }
            stylist.refreshViz();
        }
    };

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
    SupportingDataset.prototype = {
        constructor: SupportingDataset,

        useChosenDataSource: function() {
            var self = this;
            // pick up latest data from bound widgets
            var $chooser = $('#'+ self.id() +'-datasource-chooser');
            var $opentreeIDsPanel = $('#'+ self.id() +'-datasource-opentreeids-panel');
            var $nexsonUrlPanel = $('#'+ self.id() +'-datasource-nexsonurl-panel');
            var $fileUploadPanel = $('#'+ self.id() +'-datasource-upload-panel');
            // TODO: Replace these with appropriate panels!?
            var chosenSource = $chooser.val();
            switch(chosenSource) {
                /* Match against strings defined in `stylist.js`. We'll start
                 * with some special cases that drive changes to the UI.
                 */
                /*
                case "Enter OpenTree study and tree ids":
                    $opentreeIDsPanel.show();
                    $nexsonUrlPanel.hide();
                    $fileUploadPanel.hide();
                    self.metadata.source.type(dataSourceTypes.URL);
                    var studyID = self.metadata.source.phylesystemStudyID(); 
                    var treeID = self.metadata.source.phylesystemTreeID();
                    var treeNexsonURL = 'https://api.opentreeoflife.org/phylesystem/v1/study/'
                                      + studyID +'/tree/'+ treeID +'?output_nexml2json=1.0.0';
                    self.metadata.source.value( treeNexsonURL );
                    break;

                */
                case "Enter URL to data file":
                    $opentreeIDsPanel.hide();
                    $nexsonUrlPanel.show();
                    $fileUploadPanel.hide();
                    self.metadata.source.type(dataSourceTypes.URL);
                    var $otherField = $('#'+ self.id() +'-datasource-nexsonurl');
                    self.metadata.source.value( $.trim($otherField.val()) );
                    break;

                case "Enter URL to a GitHub gist":
                    $opentreeIDsPanel.hide();
                    $nexsonUrlPanel.show();
                    $fileUploadPanel.hide();
                    self.metadata.source.type(dataSourceTypes.URL);
                    var $otherField = $('#'+ self.id() +'-datasource-nexsonurl');
                        // TODO: Use another field for Gist URLs?
                    self.metadata.source.value( $.trim($otherField.val()) );
                    break;

                case "Enter or upload data":
                //case "Newick string":
                //case "Newick string with extra data":
                //case "NEXUS":
                    $opentreeIDsPanel.hide();
                    $nexsonUrlPanel.hide();
                    // enable "pasted text" field for this method
                    var $pastedField = $('#'+ self.id() +'-datasource-pasted');
                    $pastedField.attr('disabled', false)
                                .css('color','#aaa');
                    $fileUploadPanel.show();
                    break;

                default:
                    /* Handle common cases for listed tree sources:
                     *  - explicit "fetch" URLs for data on the web
                     *  - Jupyter kernel values from a hosting notebook
                     */
                    // Look for the matching URL at any level of this tree of *observable* arrays
                    var testLists = [stylist.availableTrees()];
                    $.each(stylist.availableTrees(), function(i, testItem) {
                        if ('children' in testItem) {
                            testLists.push(testItem.children());
                        }
                    });
                    var treeInfo = null;
                    $.each(testLists, function(i, testList) {
                        // ASSUMES unique display text for all items in nested list!
                        var selectedTrees = $.grep(testList, function(o) {
                            return o.name() === chosenSource;
                        });
                        if (selectedTrees.length > 0) {
                            treeInfo = selectedTrees[0];
                        }
                    });
                    if (!treeInfo) {
                        console.warn("No data found under '"+ chosenSource +"'!");
                        return;
                    }
                    if ('url' in treeInfo) {
                        $opentreeIDsPanel.hide();
                        $nexsonUrlPanel.hide();
                        $fileUploadPanel.hide();
                        self.metadata.source.type(dataSourceTypes.URL);
                        self.metadata.source.value( treeInfo.url() );
                    } else if ('kernel' in treeInfo) { // or 'kernel'? 'nbkernel'?
                        // assume this is 'python' for now
                        $opentreeIDsPanel.hide();
                        $nexsonUrlPanel.hide();
                        // Disable the format chooser while we try to guess
                        var $inputFormatChooser = $('#'+ self.id() +'-datasource-format');
                        $inputFormatChooser.attr('disabled', true);
                        // disable "pasted text" field (display only)
                        var $pastedField = $('#'+ self.id() +'-datasource-pasted');
                        $pastedField.attr('disabled', true)
                                    .css('color',''); // restore default text color
                        $fileUploadPanel.show();
                        // TODO: For a multi-kernel notebook, expect a specific kernel-id, eg 'python2'
                        var nbVarName = treeInfo.name().split(' ')[0];
                        stylist.storage[ storageBackends.JUPYTER_NOTEBOOK ].getTreeSourceData(nbVarName, function(response) {
                            console.warn('getTreeSourceData returning for tree "'+ treeInfo.name() +'"...');
                            if ('data' in response) {
                                var treeSourceData = response.data;
                                /* To interpret this as tree source data, we'll 
                                 * need to figure out its format. Pass it to a 
                                 * series of "sniffers" to identify Newick, Nexson, etc.
                                 */
                                // TODO: push this source into persistent storage?
                                ///self.metadata.source.value(treeSourceData);
                                var matchingFormat = mostLikelyDataFormat(treeSourceData);
                                $inputFormatChooser.val(matchingFormat);
                                // show something friendly in the (disabled) text field
                                var treeSourceAsText = (typeof treeSourceData === 'string') ?
                                    treeSourceData :
                                    JSON.stringify(treeSourceData);
                                $pastedField.val(treeSourceAsText);
                            } else {
                                var msg = response.error || "No data returned (unspecified error)!";
                                console.error(msg);
                                alert(msg);
                            }
                            $inputFormatChooser.attr('disabled', false);
                        });
                    } else {
                        // Maybe this string should be added to the special cases above!
                        console.warn("No URL or kernel found for '"+ chosenSource +"'!");
                        return;
                    }
            }
            stylist.refreshViz();
        }
        ,
        capturePastedData: function(datasetID) {
            // Try to convert pasted/uploaded text to nexson, using the conversion
            // methods in the main open tree curation tool.
            var self = this;  // the tree in question
            var $pastedField = $('#'+ self.id() +'-datasource-pasted');
            var pastedText = $.trim($pastedField.val());
            if (pastedText === '') {
                alert("Please paste Newick or other text into the text area provided, then try again.");
                // TODO: clear any cached and internal values regardless, to hide an old tree?
                return;
            }
            self.convertSourceDataToNexson(datasetID, pastedText);

            // TODO
            self.metadata.source.value( pastedText );
            self.metadata.source.type(dataSourceTypes.UPLOAD);
            //var treeSourceCacheKey = ('PASTED-SOURCE-' + $.trim(self.metadata.source.value()));
            var treeSourceCacheKey = ('input/PASTED-TREE-' + $.trim(self.metadata.source.value()));
            console.warn('...converting pasted data to tree...');
            // TODO: build up cache key with format + content?
            var cachedValue = getCachedData( treeSourceCacheKey );
            if (cachedValue) {
                // N.B. This data will be safely cloned by Vega when spec is parsed!
                // NOTE that we should still refresh immediately, in case the cached tree data was loaded
                // created for another tree, or an earlier version of this one.
                self.nodeLabelField('explicitLabel');
                stylist.refreshViz();
            } else {
                // call opentree web services to convert to nexson
                //TODO: Apply other pasted formats (and REMEMBER THEM in the saved illustration!)
                var $inputFormatChooser = $('#'+ self.id() +'-datasource-format');
                //$inputFormatChooser.attr('disabled', true);
                var inputFormat = $inputFormatChooser.val();
                if (inputFormat === '') {
                    alert("Please choose the format of this tree data, then try again.");
                    return;
                }
                $.ajax({
                    type: 'POST',
                    dataType: 'json',
                    // crossDomain: true,
                    contentType: "application/json; charset=utf-8",
                    url: 'https://devtree.opentreeoflife.org/curator/to_nexson',
                    /* NOTE that idPrefix and firstAvailable*ID args are
                     * currently required to get well-formed Nexson!
                     */
                    data: ('{"output": "ot:nexson", '+
                            '"auth_token": "ANONYMOUS", '+
                            '"idPrefix": "", ' +
                            '"firstAvailableEdgeID": "1", '+
                            '"firstAvailableNodeID": "1", '+
                            '"firstAvailableOTUID": "1", '+
                            '"firstAvailableOTUsID": "1", '+
                            '"firstAvailableTreeID": "1", '+
                            '"firstAvailableTreesID": "1", '+
                            '"firstAvailableAnnotationID": "1", '+
                            '"firstAvailableAgentID": "1", '+
                            '"firstAvailableMessageID": "1", '+
                            '"inputFormat": '+ JSON.stringify(inputFormat) +', '+
                            '"content": '+ JSON.stringify($.trim(self.metadata.source.value())) +
                           ' }'),
                    processData: false,
                    complete: function( jqXHR, textStatus ) {
                        // report errors or malformed data, if any
                        if (textStatus !== 'success') {
                            if (jqXHR.status >= 500) {
                                // major server-side error, just show raw response for tech support
                                var errMsg = 'Sorry, there was an error ('+ jqXHR.status +') converting this tree to Nexson:\n\n'+ jqXHR.responseText;
                                alert(errMsg);
                                return;
                            }
                            // Server blocked the save due to major validation errors!
                            var data = $.parseJSON(jqXHR.responseText);
                            // TODO: This should be properly parsed JSON, show it more sensibly
                            // (but for now, repeat the crude feedback used above)
                            var errMsg = 'Sorry, there was an error ('+ jqXHR.status +') converting this tree to Nexson:\n\n'+ jqXHR.responseText;
                            alert(errMsg);
                            return;
                        }
                        // Pasted tree was converted successfully; capture the Nexson as a string
                        var data = $.parseJSON(jqXHR.responseText);

                        // fix any quirks to conform to our expected Nexson structure
                        fixUpConvertedNexson(data);

                        // store it in the cache, at the key defined above
                        console.warn('...storing pasted data in cache... key='+ treeSourceCacheKey);
                        setCachedData( treeSourceCacheKey, data );
                        // force node-label field to show "explicit" labels (TODO: for Newick only?)
                        self.nodeLabelField('explicitLabel');
                        stylist.refreshViz();
                    }
                });
            }
        }
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

    /* We'll often want to show values using the chosen physical units (inches
     * or cm), but store them as internal SVG pixels. This makes it easy to
     * declare these as computed properties, eg, wrap width => 'physicalWidth'
     */
    var wrapFieldWithPhysicalUnits = function(obj, fieldName, precision) {
        // Display using selected precision (number of places), with hundredths by default.
        // EXAMPLE: self.physicalWidth = wrapFieldWithPhysicalUnits(self, 'width');
        precision = precision || 2;
        return ko.computed({
            read: function() {
                var physicalValue = stylist.pixelsToPhysicalUnits(obj[ fieldName ](), stylist.internal_ppi);
                return Number(Math.round(physicalValue + "e+" + precision) + "e-" + precision);
            },
            write: function(value) {
                obj[ fieldName ]( stylist.physicalUnitsToPixels(value, stylist.internal_ppi));
            },
            owner: obj,
            deferEvaluation: true
        })
    }

    /* Apply hard constraints to proposed values. These might be universal
     * values (e.g. minimum legible text height = 5px), or set within an active
     * style guide (e.g., figures in _Systematic Biology_ must use font sizes
     * from 10px to 64px).
     *
     * NOTE that these wrappers can be nested like so;
     *   self.constrainedWidth = wrapFieldWithConstraints(self, 'width');
     *   self.physicalWidth = wrapFieldWithPhysicalUnits(self, 'constrainedWidth');
     * This lets us get/set with constraints, using either px or physical units.
     */
    var wrapFieldWithConstraints = function(obj, fieldName, constraints, precision) {
        // Display using selected precision (number of places), with hundredths by default.
        precision = precision || 2;
        if (!constraints) {
            console.error("wrapFieldWithConstraints() expects a constraints object!");
            return;
        };
        return ko.computed({
            read: function() {
                // nothing interesting here, just call the wrapped field
                ///console.log("READING from constrained '"+ fieldName +"'!");
                return obj[ fieldName ]();
            },
            write: function(value) {
                // Interpret and apply the specified constraints, perhaps signaling
                // whether the proposed value is allowed.
                ///console.log("WRITING to a constrained '"+ fieldName +"'!");
                var itsType = constraints.type;
                var newValue;

                // Check for a whitelist of acceptable values
                if ('whitelist' in constraints) {
                    var acceptableValues = constraints.whitelist;
                    var foundPosition = acceptableValues.indexOf(value);
                    // TODO: trim whitespace? force to upper case?
                    if (foundPosition === -1) {
                        // reject the proposed value; re-assert the old value for UI refresh
                        obj[ fieldName ].valueHasMutated();
                        return false;
                    }
                }

                if (itsType === Number) {
                    // look for minimum, maximum, precision? coerce and block NaN
                    newValue = Number(value);
                    if (isNaN( newValue )) {
                        // reject the proposed value; re-assert the old value for UI refresh
                        obj[ fieldName ].valueHasMutated();
                        return false;
                    }
                    if ('min' in constraints) {
                        var minValue = Number(constraints.min);
                        newValue = Math.max( minValue, newValue );
                    }
                    if ('max' in constraints) {
                        var maxValue = Number(constraints.max);
                        newValue = Math.min( maxValue, newValue );
                    }
                }
                if (itsType === String) {
                    // Add any string-specific constraints here (min. chars, etc.)
                }

                // Still here? Update the value (which may *not* have changed) and return true
                obj[ fieldName ]( newValue );
                return true;
            },
            owner: obj,
            deferEvaluation: true
        })
    }

    /* Newick (and other?) formats converted Nexson may be missing some
     * elements we expect. Add these now. */
    var fixUpConvertedNexson = function(data) {
        // 'data' is nexml in typical JSON wrapper
        var nexml = data.data.nexml;
        var nodeHasChildren = function(node, tree) {
            var childFound = false;
            $.each(tree.edge, function(i,edge) {
                if (edge['@source'] === node['@id']) {
                    childFound = true;
                }
            });
            return childFound;
        };
        $.each(nexml.trees, function(i,treeCollection) { // mark childless nodes with 'ot:isleaf'
            $.each(treeCollection.tree, function(i, tree) {
                var leafNodes = $.grep(tree.node, function(node) { 
                    if (nodeHasChildren(node,tree)) {
                        // modify internal nodes?
                    } else {
                        node['^ot:isLeaf'] = true;
                    }
                });
            });
        });
    }

    /* Use sniffers to determine the most likely format of input tree data */
    var mostLikelyDataFormat = function (data) {
        if (utils.isProbablyNewick(data)) { return  'newick'; }
        if (utils.isProbablyNEXUS(data))  { return  'nexus'; }
        if (utils.isProbablyRPhylo(data))  { return  'phylo'; }
        if (utils.isProbablyNeXML(data))  { return  'nexml'; }
        return '';  // format unknown
    }

    /* expose class constructors (and static methods) for instantiation */
    return {
        // expose enumerations
        units: units,
        colorDepths: colorDepths,
        treeLayouts: treeLayouts,
        branchRotationMethods: branchRotationMethods,
        alignments: alignments,
        sweepDirections: sweepDirections,
        dataSourceTypes: dataSourceTypes,
        versionTypes: versionTypes,
        hostApplications: hostApplications,
        storageBackends: storageBackends,
        cache: cache,
        setCachedData: setCachedData,
        getCachedData: getCachedData,
        clearCachedData: clearCachedData,
        flushCache: flushCache,
        gatherAllCachedData: gatherAllCachedData,
        gatherStaticInputData: gatherStaticInputData,
        gatherAllInputData: gatherAllInputData,
        gatherAllTransformData: gatherAllTransformData,
        gatherAllOutputData: gatherAllOutputData,

        // expose view-model classes
        Illustration: Illustration,
        SceneGraph: SceneGraph,
        IllustratedTree: IllustratedTree,
        SupportingDataset: SupportingDataset,
        Ornament: Ornament,
        StyleOverrides: StyleOverrides
    };
}(window, document, $, ko, stylist);

for (var name in TreeIllustrator) {
    exports[ name ] = TreeIllustrator[ name ];
}
