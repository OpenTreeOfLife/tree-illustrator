/*
 * A reader/writer for TreeCSS stylesheets, see
 * https://github.com/TreeViz/metastyle/wiki
 */

// Any dependencies to declare?
var utils = require('./ti-utils.js'),
    stylist = require('./stylist.js'),
    //postcss = require('postcss-js'),  // limited parsing of AST only
    postcss = require('postcss'),
    prefixer = require('autoprefixer'),
    selectorparser = require('postcss-selector-parser'),
    treess = require('./postcss-treess.js'),
    TreeIllustrator = require('./TreeIllustrator.js');

var TreeSS = function(window, document, $, ko, stylist) {

    // Explicitly check for dependencies by passing them as args to the module
    if (typeof($) !== 'function') {
        alert("TreeSS module cancelled, needs jQuery (as '$')");
        return null;
    }
    if (!ko || typeof(ko) !== 'object') {
        alert("TreeSS module cancelled, needs KnockoutJS (as 'ko')");
        return null;
    }
    if (!stylist || typeof(stylist) !== 'object') {
        alert("TreeSS module cancelled, needs 'stylist' module (as 'stylist')");
        return null;
    }

    /* Define enumerations (for legibility, and to avoid typos)? */
    var TODOenums = {
        FOO: 'FOO',
        BAR: 'BAR'
    };

    /* Here we can share information among all classes and instances */

    /* Which illustration style properties are currently supported in TreeSS?
     * (We support multiple possible TreeSS names, in case there are variants.)
     */
    var stylePropertiesToTreeSSNames = {
        backgroundColor: ['color', 'background-color'],  // specific to body? root?
        edgeThickness: ['branch-width'],  // typically there's just one value
        yyy: ['yyy-name']
    };

    /*
     * Class methods
     */

    /* Use the mappings above to find correspondences between TreeSS and
     * internal properties.
     */
    var getIllustrationStylePropertyForTreeSSName = function( name ) {
        var matchingProperty = null;
        // "Normalize" the name for easy comparison
        var name = $.trim(name);  // trim any whitespace (ASSUME lower-case)
        for (prop in stylePropertiesToTreeSSNames) {
            var listPos = $.inArray( name, stylePropertiesToTreeSSNames[ prop ] );
            if (listPos !== -1) {
                matchingProperty = prop;
            }
        }
        return matchingProperty;
    }
    var getTreeSSNameForIllustrationStyleProperty = function( prop ) {
        var possibleNames = stylePropertiesToTreeSSNames[ prop ];
        if (!possibleNames) {
            // This style property is not currently supported in TreeSS
            return null;
        }
        // ASSUME the first name is our preferred TreeSS term
        return $.trim(possibleNames[0]);
    }

    /* Translate a TreeSS selector (if possible) into a filter function that
     * will gather all matching elements in the current Illustration.
     */
    var filterFromTreeSSSelector = function(selector) {
        // TODO: Parse/split/tokenize the selector and return an equivalent function
        return function() {
            console.log("Now I'd select elements matching ["+ selector +"] in this Illustration:");
            console.log(stylist.ill);
        }
    }

    /* Apply incoming TreeSS string to the current illustration.  N.B. this
     * creates a AST, but treats it as a disposable source of styles for
     * translation into our "native" properties in `<Illustration>.style`.
     */
    var applyStylesheetToCurrentStyle = function(treess, options) {
        treess = treess || testCss; // static, defined above
        // Mark and pass along any options to our PostCSS processor
        options = options || {};
        options.illustration = stylist.ill;
        options.source = 'applyStylesheetToCurrentStyle';
        var ast;  // the abstract syntax tree for the resulting styles
        treessProcessor.process(treess, options).then(function(ast) {
            console.log("=== modified AST ===");
            // show modified AST as a JavaScript object
            console.log(ast);
            // any warnings to report?
            ast.warnings().forEach(function (warn) {
                console.warn(warn.toString());
            });
            // show modified AST again, rendered as CSS
            console.log(ast.css);

            // Look for styles we can apply to the illustration
            ast.root.walkDecls(
                //options,    // anything useful to pass along here?
                function(decl, i) {
                    var testStyle = getIllustrationStylePropertyForTreeSSName( decl.prop );
                    if (!testStyle) { return; }  // we ignore this property name
                    // OK, this property is interesting. To which elements does it apply?
                    var rule = decl.parent;
                    console.log("SELECTOR: "+ rule.selector);
                    if (!rule.selectMatchingElements) {
                        console.log("ATTACHING a selector function here...");
                        /* Create a function that culls selected elements in our
                         * Illustration model, and attach it to this rule in the
                         * PostCSS AST (unless there's one already here).
                         */
                        rule.selectMatchingElements = filterFromTreeSSSelector( rule.selector );
                    } else {
                        console.log("FOUND an existing selector function!");
                    }
                    /* Should this just be a chain of filter funcs? e.g.
                     *   var matchFilter = [ getRootElement, function() {return matchNodesByID('ott2968')}, getNodeNameElement ];
                     * ... or should we keep the normalized(?) selector string
                     * as our key, and read/parse it each time we run the
                     * selector? (maybe it's fast!)
                     *
                     * I mention "key" above since it would be nice to re-unite
                     * all the property changes tied to the same selector. This
                     * means we can select once and run several rules, rather
                     * than repeating the work. Or should we just cache these
                     * results alongside the filter functions?
                     *
                     * Maybe we keep the PostCSS AST around after all, just as
                     * an ordered ruleset that we can use to attach only the
                     * relevant filters and property changes. If not, we need
                     * to recreate it in a sparse, skeletal form to support
                     * frequent, deterministic styling operations.
                     *
                     * On second thought, this is not the right approach. As a
                     * limited subset of Tree Illustrator's styling options,
                     * TreeSS is strictly for interchange and should disappear
                     * once read or written. Instead, it would make more sense
                     * to build on our existing `Illustration.style` object,
                     * using Knockout to add callable functions (one per
                     * rule/selector) and any cached elements. Of course, both would
                     * be dropped when serializing an Illustration back to
                     * JSON, but the selector strings will be preserved. So of
                     * course we'll need to be able to translate back and forth
                     * between selector strings and gathering functions (or at
                     * least be able to recreate each function based on its
                     * selector string).
                     */
                }
            );
        });
        debugger;
    }

    // TODO: Capture the current illustration's style as a TreeSS string
    var currentStyleToStylesheet = function() {
        var treess = "/* This is a fake TreeSS file! */\n\n";
        return treess;
    }

    // TODO: Return a new cascade (series of stylesheets)
    var getNewTreeStyleCascade = function(options) {
        return [];
    }

    // TODO: Return a new stylesheet
    var getNewTreeStyleSheet = function(options) {
        return {};
    }

    // TODO: Return a new TreeSS style rule

    // TODO: Render the cascade (manipulate tree properties, generate CSS, add inline style to SVG)
    /* quick smoke test */
    var testCss = 'body {\n'
                 +'  color: #eee /* inner (value) comment, preserved but has no node */;\n'
                 +'  font-family: fontstack("Comic Sans"); /* one-liner comment! */\n'
                 +'}\n'
                 +'div#foo {\n'
                 +'  display: flex !important;\n'
                 +'  font-family: fontstack("Arial") !important;\n'
                 +'}';

    var treessProcessor = postcss()
        .use(prefixer)
        //.use(treess({illustration: stylist.ill}))   // TODO: set plugin defaults?
        //.use(selectorparser, {updateSelector: true})
        .use(treess);
        // list more plugins here?

    /* Use PostCSS for smarter parsing of our style selectors */
    var selectorProcessor = selectorparser();
    /* Do we need to modify these selectors? (N.B. this is not required for
     * deep parsing of selectors.)
    var transform = function(selectors) {
        console.log(selectors);
    };
    var selectorProcessor = selectorparser(transform);  // options
     */

    /*
     * Support functions to interpret TreeSS selectors in Tree Illustrator
     */
    var buildGatheringFunction = function(selectorString) {
        /* Convert a TreeSS selector string into a function for gathering
         * the matching elements in an Illustration.
         *
         * For best performance, we should cache the latest list of
         * elements, but also allow easy clearing as the illustration
         * changes).
         */
        var cachedResult = null;
        var ast = selectorProcessor.astSync(selectorString);
        // TODO: Use PostCSS selector plugin to do this more safely?
        var gatherer = function(options) {
            options = options || {CLEAR_CACHE: false};

            console.log(">>> GATHERING elements that match '"+ selectorString +"'...");
            // Clear cache on demand (and abort without new result)
            if (options.CLEAR_CACHE) {
                cachedResult = null;
                // TODO: Continue and return fresh result?
                console.log("    CLEARING CACHE for this selector");
                return null;
            }

            // Return cached result, if any (else refresh this now)
            if ($.isArray(cachedResult)) {
                console.log("    USING CACHED VALUE for this selector");
                return cachedResult;
            }

            // Build (and cache) the list of elements matching this rule.
            // N.B. there might be *multiple* selectors whose results must be joined!
            var ruleMatchingElements = [ ];
            console.log("    WALKING the AST to find elements...");
            ast.each(function(item, i) {
                console.log("      AST item, a "+ item.type +" in position ("+ i +")...");
                /*
                console.log("      position: "+ i);
                console.log(item);
                */
                if (item.type == 'selector') {
                    //item.walk(function(nodePos, node) {...}
                    /* Avoid `<selector>.walk()` methods here, since they won't distinguish
                     * between superficial and "deeper" selectors, e.g. within
                     * a Pseudo element like ":tree(3)"
                     */
                    var selMatchingElements = [ ];  // this list is shaped along the way
                    $.each(item.nodes, function(nodePos, node) {
                        console.log("          SELECTOR CHILD, a "+ node.type +" in position ("+ i +")...");
                        console.log("            its value: "+ node.value);
                        /* Handle all element types, see https://github.com/postcss/postcss-selector-parser/blob/master/API.md#nodetype
                         * See also https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors
                         *
                         * N.B. that some container types (root, selector,
                         * pseudo) have their own `nodes` collection.
                         *
                         * Most node types will just winnow down the current
                         * set of matched elements. Combinators will instead
                         * move to their descendants/siblings/etc.
                         */

                        /* Helper methods needed? Or do it all inline below?
                         *
                        selMatchingElements = processSelectorNode(
                            selMatchingElements,
                            node,
                            activeCombinator
                        );
                        if (activeCombinator) {
                            selMatchingElements = applyCombinator(selMatchingElements, activeCombinator);
                        } else {
                            selMatchingElements = applyFilter(selMatchingElements, node, activeCombinator);
                        }

                        selMatchingElements = processSelectorNode( elementType, selMatchingElements );
                        selMatchingElements = applyFilter(selMatchingElements, );
                        selMatchingElements = applyCombinator(selMatchingElements, );
                        */

                        switch( node.type ) {
                            case 'tag':         // `illustration`, `tree`, `node`
                                // Filter to just the elements of the specified type
                                var elementType = node.value;
                                switch( elementType ) {
                                    case 'illustration':
                                        if (selMatchingElements.length === 0) {
                                            // auto-select the current illustration
                                            selMatchingElements = [stylist.ill];
                                        } else {
                                            // nothing else makes sense; select nothing
                                            selMatchingElements = [ ];
                                        }
                                        break;
                                    case 'tree':
                                        selMatchingElements = selMatchingElements.filter(function(el) {
                                            return (el instanceof TreeIllustrator.IllustratedTree);
                                        });
                                        break;
                                    case 'clade':
                                    case 'node':
                                    default:
                                        console.error('!!! not-yet-implemented TAG SELECTOR: '+ node.value);
                                        break;
                                }
                                break;
                            case 'universal':   // `*` (matches any element)
                                // This filter is a no-op; keep going with same selected elements!
                                break;
                            case 'combinator':  // `>`, `+`, `{NON-EMPTY WHITESPACE}`
                                // stash this and keep going to the next item...
                                console.log('... applying this combinator: ');
                                console.log(node);
                                selMatchingElements = applyCombinator(selMatchingElements, node);
                                break;
                            case 'pseudo':      // `:tree(2)`, `::adaxial-leaf`
                                // filter the current matches that match this test
                                console.log('... filtering with this qualifier: ');
                                console.log(node);
                                selMatchingElements = selMatchingElements.filter(function(el) {
                                    return testElementAgainstQualifier(el, node);
                                });
                                break;
                            case 'attribute':   // `[posterior-support >= 0.75]`
                            case 'class':       // `.highlight-3`
                            case 'comment':
                            case 'root':        // a simple container of nodes
                            case 'string':      // found in quoted args `:bar(3, "A")`
                            case 'id':          // `#foo`
                            case 'selector':    // appears *within* a Pseudo with parens/args
                                console.warn('!!! not-yet-implemented AST type: '+ node.type);
                                break;
                            case 'nesting':
                                // Not currently supporte! See https://tabatkins.github.io/specs/css-nesting/#motivation
                                console.warn('!!! unsupported AST type: '+ node.type);
                                break;
                            default:
                                console.warn('!!! unknown AST type: '+ node.type);
                        }
                        if (selMatchingElements.length === 0) {
                            // Nothing matches after this step; bail out now w/ empty list!
                            return false;
                        }
                        console.log('... NEW matching elements');
                        console.log(selMatchingElements);
                    });
                    // Append all matching elements to our main collection (incl. dupes)
                    // N.B. this modifies the first array in place.
                    $.merge(ruleMatchingElements, selMatchingElements);
                }
            });
            // Remove any duplicate elements (modifies array in place)
            $.unique(ruleMatchingElements);

            // Update my cache and return
            cachedResult = ruleMatchingElements;
            return cachedResult;
        }
        return gatherer;
    }
    /* More primitive support functions for element selection */
    var testElementAgainstQualifier = function( el, selectorNode ) {
        /* Return true if the specified element passes the qualifying test
         * defined in selectorNode, false otherwise. Typically this node is a
         * pseudo-selector, possibly with provided arguments, e.g. `:depth(3)`
         *
         * TODO: Interpret this based on element type and the semantics of our
         * expected pseudo-selectors!
         */
        return true; // TODO
    }

    var processSelectorNode = function(contextElements, node) {
        //options = options || {};
        switch (node.type === 'combinator') {
        }
        if (activeCombinator) {
        } else {
            // filter the current context elements, return a subset
        }
    }
    /*
    var applyFilter = function(contextElements, filter) {
        var matches = [ ];
        return matches;
    }
    */
    var applyCombinator = function(contextElements, combinatorNode) {
        var matchingElements = [ ];
        // return matching children/descendants/siblings of all context elements
        $.each( contextElements, function(i, el) {
            switch(activeCombinator.value) {
                case '>':       // return any children (direct children only!)
                    $.merge( matchingElements, getStyleChildren(el) );
                    break;
                case '+':       // return next adjacent sibling, if any
                    // Hm, 'next sibling' is probably not a useful concept in trees...
                    console.warn("!!! Unsupported combinator (+) in TreeSS");
                    break;
                case '~':       // return any siblings (regardless of relative position)
                    $.merge( matchingElements, getStyleSiblings(el) );
                    break;
                case ' ':       // [any whitespace] return all descendants
                default:
                    matchingElements = getStyleDescendants(el, matchingElements);
            }
        });
        return matchingElements;
    }

    /*
     * Support methods for gathering elements for TreeSS
     */
    function getStyleParent(el) {
        /* Walk "upward" from node to tree, tree to illustration, etc.
         * according to the logic used in TreeSS.
         *
         * TODO: If starting from a node or similar, should we respond with
         * intermediate nodes/clades?
         */
        if (el instanceof TreeIllustrator.Illustration) {
            console.warn("getStyleParent(): Illustration has no parent!");
            return null;
        }
        if (el instanceof TreeIllustrator.IllustratedTree) {
            // return its parent Illustration
            return (stylist.ill);
        }
        if (obj instanceof TreeIllustrator.SupportingDataset) {
            // return its parent Illustration
            return (stylist.ill);
        }
        if (obj instanceof TreeIllustrator.Ornament) {
            // return its parent Illustration
            return (stylist.ill);
        }
        // TODO: ADD cases for node, edge, clade, node label?

        console.error("getStyleParent(): unexpected context element <"+ typeof(el) +">:");
        console.error(el);
        return null;
    }
    function getStyleChildren(el, elementList) {
        /* Gather the elements considered my "children" by TreeSS.  This might
         * include instances of IllustratedTree, or more ephemeral tree features like
         * e.g. nodes and clades.
         *
         * Append these to an existing array, if provided, and return it.
         */
        var children = elementList || [ ];
        if (el instanceof TreeIllustrator.Illustration) {
            // Add all visible items from my elements list?
            var visibleChildren = $.filterl(el.elements, function(child) {
                return (child instanceof TreeIllustrator.IllustratedTree);
            });
            return $.merge( children, visibleChildren );
        }
        if (el instanceof TreeIllustrator.IllustratedTree) {
            // TODO: Add root node/clade
            var rootNode = null;
            return $.merge( children, [ rootNode ] );
        }
        if (el instanceof TreeIllustrator.SupportingDataset) {
            // don't add to the original list
            return children;
        }
        if (el instanceof TreeIllustrator.Ornament) {
            // don't add to the original list
            return children;
        }
        // TODO: ADD cases for node, edge, clade, node label?

        console.error("getStyleChildren(): unexpected parent element <"+ typeof(el) +">:");
        console.error(el);
        return children;
    }
    function getStyleDescendants(el, elementList) {
        /* Gather all my contained elements (all levels), based on the TreeSS
         * "DOM". Append these to an existing array, if provided, and return it.
         */
        var descendants = elementList || [ ];
        var children = getStyleChildren(el);
        $.each(children, function(i, childElement) {
            $.merge( descendants, getStyleDescendants(childElement) );
        });
        // Remove any duplicate elements 
        // N.B. This also mangles their order in the array!
        return $.unique(descendants);
    }
    function getStyleSiblings(el, elementList) {
        /* Gather any sibling elements, based on the TreeSS "DOM". Append these
         * to an existing array, if provided, and return it.
         */
        var siblings = elementList || [ ];
        var parent = getStyleParent(el);
        if (parent) {
            $.merge( siblings, getStyleChildren(parent) );
        }
        return siblings;
    }

    var clearAllStyleCaches = function() {
        // Walk the style rules, clearing all cached results
        $.each( stylist.ill.style(), function(i, rule) {
            // Clear per-element `cachedStyle` object, if any
            var oldMatches = rule.gatherMatchingElements();
            $.each(oldMatches, function(i, el) {
                delete el.cachedStyle;
            });
            // Clear cached result from its "gathering" function
            rule.gatherMatchingElements({CLEAR_CACHE: true});
        });
    }

    var getMatchingStyleRules = function(element) {
        /* Which rules will select this tree/node/whatever? */
        var matchingRules = [ ];
        $.each( stylist.ill.style(), function(i, rule) {
            var selectedElements = rule.gatherMatchingElements();
            if ($.inArray(element, selectedElements) !== -1) {
                matchingRules.push(rule);
            }
        });
        // N.B. that their relative order is preserved.
        return matchingRules;
    }

    var getValueFromStyleDeclarations = function(propPath, styleInfo) {
        /* Fetch the value found (if any) at the specified property name or
         * dot-delimited path. In the latter case, we expect to find nested
         * objects with our desired value at some arbitrary depth, so we'll
         * need to unpack each in turn.
         *
         * N.B. `styleInfo` is a set of declarations (values, keyed to
         * property names), typically under a style rule. But this should
         * also work on a similar structure that might be cached directly
         * under an element, e.g. a node might have a `style` property that
         * holds all its effective styles, for example:
         *   foundStyleValue = getValueFromStyleDeclarations( myProp, el.style );
         *
         * TODO: Return raw or constrained (by styleguide) value?
         */
        var propNameSeries = propPath.split('.');  // typically an array of one
        // pop the first container or value from style object
        var testObj = ko.utils.unwrapObservable(styleInfo);
        /*
        console.log('=====');
        console.log(propNameSeries);
        console.log('testObj: <'+ typeof(testObj)  +'>:');
        console.log(testObj);
        */
        $.each(propNameSeries, function(i, pn) {
            // unpack any remaining names...
            /*
            console.log('  i: <'+ typeof(i)  +'>: '+ i);
            console.log('  pn: <'+ typeof(pn)  +'>: '+ pn);
            */
            if (!pn in testObj) {
                console.error("getValueFromStyleDeclarations =(): member '"+ pn +"' not found for style '"+ propPath +"'");
                console.error(obj.style);
                return;
            }
            rawValue = ko.utils.unwrapObservable(testObj[pn]);
            testObj = rawValue;  // in case we're going deeper
            /*
            console.log('NEW testObj? <'+ typeof(testObj)  +'>:');
            console.log(testObj);
            console.log('?????');
            */
        });
        var constrainedValue = stylist.ill.getConstrainedStyle(propPath, rawValue);
        /*
        console.log('RETURNING constrainedValue <'+ typeof(constrainedValue) +'>:');
        console.log(constrainedValue);
        */
        return constrainedValue;
    }
    /* TODO: Capture piecemeal style decisions (from UI? or Vega spec?) as TreeSS
     *  - capture everything we can as TreeSS (no guarantees!)
     *  - build on existing TreeSS sheet/cascade, if found
     */

    /* expose class constructors (and static methods) for instantiation */
    return {
        // expose enumerations, classes, etc.
        TODOenums: TODOenums,
        getTreeSSNameForIllustrationStyleProperty: getTreeSSNameForIllustrationStyleProperty,
        getIllustrationStylePropertyForTreeSSName: getIllustrationStylePropertyForTreeSSName,
        applyStylesheetToCurrentStyle: applyStylesheetToCurrentStyle,
        currentStyleToStylesheet: currentStyleToStylesheet,
        postcss: postcss,  // TODO: REMOVE THIS
        selectorProcessor: selectorProcessor,  // TODO: REMOVE THIS
        buildGatheringFunction: buildGatheringFunction,
        clearAllStyleCaches: clearAllStyleCaches,
        getMatchingStyleRules: getMatchingStyleRules,
        getStyleParent: getStyleParent,
        getValueFromStyleDeclarations: getValueFromStyleDeclarations
    };
}(window, document, $, ko, stylist);

for (var name in TreeSS) {
    exports[ name ] = TreeSS[ name ];
}
/*
var api = [
    // Add more API elements here?
]
$.each(api, function(i, methodName) {
    // populate the default 'module.exports' object
    exports[ methodName ] = eval( methodName );
});
*/
