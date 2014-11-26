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
    var treeLayouts = {
        RECTANGLE: 'RECTANGLE',
        CIRCLE: 'CIRCLE',
        TRIANGLE: 'TRIANGLE'
    }
    var alignments = {
        TOP: 'TOP',
        RIGHT: 'RIGHT',
        BOTTOM: 'BOTTOM',
        LEFT: 'LEFT',
        CENTER: 'CENTER'
    }
    var dataSourceTypes = {
        BUILT_IN: 'BUILT_IN',
        URL: 'URL'
    }

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
                'source': {'type': dataSourceTypes.BUILT_IN, 'value': "DEFAULT"},
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
                    'width': 8.5,  // in physical units
                    'height': 11,   // in physical units
                },
                'fontFamily': "Times New Roman, Times, serif",
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
        var landmarks = getPrintAreaLandmarks();
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
            'width': landmarks.width * 0.4,
            'height': landmarks.height * 0.4,
            'radius': Math.min(landmarks.height, landmarks.width) * 0.3,
            'tipsAlignment': alignments.RIGHT,
            'rootX': landmarks.centerX + jiggle(5),   // TODO: use a bounding box instead?
            'rootY': landmarks.centerY + jiggle(5),

            'style': {
                // incl. only deviations from the style guide above?
                'edgeThickness': 1.5,  
                'edgeColor': '#aaa',
                'labeTextHeight': illustration.style.minimumTextSize()
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
            refreshViz();
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
            refreshViz();
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
                console.error("confirmRemoveElement(): unexpeced element type: '"+ el.metadata.type() +"'!");
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
                    switch(data.type) {
                        case 'IllustratedTree':
                            return new Tree(data);
                        case 'SupportingDataset':
                            return new SupportingDataset(data);
                        case 'Ornament':
                            return new Ornament(data);
                    }
                    // keep it simple by default
                    console.warn("Unexpected element type '"+ data.type +"'! Creating a generic observable...");
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
            refreshViz();
            return tree;
        },
        removeIllustratedTree: function(tree) {
            var self = this;
            self.elements.remove(tree);
            refreshViz();
            delete tree;
        },

        addSupportingDataset: function() {
            var self = this;
            var ds  = new SupportingDataset(self);
            self.elements.push(ds);
            refreshViz();
            return ds;
        },
        removeSupportingDataset: function(ds) {
            var self = this;
            self.elements.remove(ds);
            refreshViz();
            delete ds;
        },

        addOrnament: function() {
            var self = this;
            var obj  = new Ornament(self);
            self.elements.push(obj);
            refreshViz();
            return obj;
        },
        removeOrnament: function(obj) {
            var self = this;
            self.elements.remove(obj);
            refreshViz();
            delete obj;
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
            var pxPrintWidth = physicalUnitsToPixels(self.style.printSize.width(), internal_ppi);
            var pxPrintHeight = physicalUnitsToPixels(self.style.printSize.height(), internal_ppi);
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

                    // TODO: Define data source (allow for inline tree data? in dataset? other sources?)
                    switch (el.metadata.source.type()) { 
                        case dataSourceTypes.BUILT_IN:
                        case dataSourceTypes.URL:
                            // TODO: treeData.url = el.metadata.source.value;
                            treeData.url = el.metadata.source.value();
                            break;
                        // TODO: add cases for other data sources
                        default:
                            console.error("Unknown source type for tree!");
                    }

                    /* Build an appropriate chain of data transforms */

                    // TODO: First transform imports data from its source format to our basic phyloTree
                    if (true) { 
                        treeData.transform.push({
                            "type": "nexson", 
                            "treesCollectionPosition":0, 
                            "treePosition":0
                        });
                    }

                    // TODO: Shape the phyloTree using preferred tree layout and styles
                    var phylogramTransform = { 
                        "type": "phylogram", 
                        //"layout": "cartesian",
                        //"radialArc": [90, 270],
                        //"radialSweep": 'CLOCKWISE',
                        "radialSweep": 'COUNTERCLOCKWISE',
                        //"branchStyle": "diagonal",  // other options here?
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
                    var textHeight = self.style.minimumTextSize();   // TODO: adjustable font size (convert pt to px)
                    var halfTextHeight = textHeight * 0.4;   // TODO: adjustable font size (convert pt to px)
                    var initialLabelProperties = {
                        "fontSize": {"value": textHeight} 
                    };
                    switch (el.layout()) { 
                        case treeLayouts.RECTANGLE:
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
                        case treeLayouts.TRIANGLE:
                            // TODO: what happens here?
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
                            { /* N.B. This expects pre-existing links with 'source' and 'target' properties! The 'link' transform is 
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
                                  "stroke": {"value": el.style.edgeColor()},
                                  "strokeWidth": {"value": el.style.edgeThickness()}
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
                                                    "text": {"field": "ottTaxonName"},
                                                    "fill": {"value":"black"}
                                                },
                                                "hover": {
                                                    "fill": {"value": "red"}
                                                }
                                        }
                                    } /* end of label marks */
                                ]
                            } /* end of grouped node+label */ 
                        ] /* end of inner group marks */
                    }; /* end of inner group */

                    illustrationElementsGroup.marks.push( treeMarks );

                } else if (el instanceof SupportingDataset) {
                    console.log("updateVegaSpec(): ignoring datasets for now");

                } else if (el instanceof Ornament) {
                    console.log("updateVegaSpec(): ignoring ornaments for now");

                } else {
                    console.error("updateVegaSpec(): unexpeced element type: '"+ el.metadata.type() +"'!");
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
        ko.mapping.fromJS(data, Illustration.mappingOptions, self);

        // Add validation for fields that need it
        self.metadata.name.extend({required: true});

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
            refreshViz();
        }
        ,
        useChosenTreeDataSource: function() {
            var self = this;
            // pick up latest data from bound widgets
            var $chooser = $('#'+ self.id() +'-datasource-chooser');
            var $opentreeIDsPanel = $('#'+ self.id() +'-datasource-opentreeids-panel');
            var $nexsonUrlPanel = $('#'+ self.id() +'-datasource-nexsonurl-panel');
            var $fileUploadPanel = $('#'+ self.id() +'-datasource-upload-panel');
            var chosenSource = $chooser.val();
            switch(chosenSource) {
                // Match against strings defined in stylist.js
                case "Enter OpenTree study and tree ids":
                    $opentreeIDsPanel.show();
                    $nexsonUrlPanel.hide();
                    $fileUploadPanel.hide();
                    self.metadata.source.type(dataSourceTypes.URL);
                    var studyID = self.metadata.source.phylesystemStudyID(); 
                    var treeID = self.metadata.source.phylesystemTreeID();
                    var treeNexsonURL = 'http://api.opentreeoflife.org/phylesystem/v1/study/'
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

                case "Upload tree data":
                    $opentreeIDsPanel.hide();
                    $nexsonUrlPanel.hide();
                    $fileUploadPanel.show();
                    break;

                default:
                    // assume this is the name of an explicit URL
                    $opentreeIDsPanel.hide();
                    $nexsonUrlPanel.hide();
                    $fileUploadPanel.hide();
                    // find the matching URL and set it instead
                    var selectedTrees = $.grep(availableTrees, function(o) {return o.name === chosenSource;});
                    var treeInfo = null;
                    if (selectedTrees.length > 0) {
                        treeInfo = selectedTrees[0];
                    }
                    if (!treeInfo) {
                        console.warn("No tree found under '"+ treeName +"'!");
                        return;
                    }
                    self.metadata.source.type(dataSourceTypes.URL);
                    self.metadata.source.value( treeInfo.url );
            }
            refreshViz();
        }
        ,
        useChosenTipsAlignment: function(newValue) {
            var self = this;
            if (newValue in alignments) {
                self.tipsAlignment(newValue);
            } else {
                console.error("useChosenTipsAlignment(): Unknown tree layout '"+ newValue +"'!"); 
            }
            refreshViz();
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
        // expose enumerations
        units: units,
        colorDepths: colorDepths,
        treeLayouts: treeLayouts,
        alignments: alignments,
        dataSourceTypes: dataSourceTypes,

        // expose view-model classes
        Illustration: Illustration,
        SceneGraph: SceneGraph,
        IllustratedTree: IllustratedTree,
        SupportingDataset: SupportingDataset,
        Ornament: Ornament,
        StyleOverrides: StyleOverrides
    };
}(window, document, $, ko);
