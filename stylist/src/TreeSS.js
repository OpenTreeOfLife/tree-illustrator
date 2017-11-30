/*
 * A reader/writer for TreeCSS stylesheets, see
 * https://github.com/TreeViz/metastyle/wiki
 */

// Any dependencies to declare?
var utils = require('./ti-utils.js'),
    assert = require('assert'),
    stylist = require('./stylist.js'),
    //postcss = require('postcss-js'),  // limited parsing of AST only
    postcss = require('postcss'),
    prefixer = require('autoprefixer'),
    selectorparser = require('postcss-selector-parser'),
    valueparser = require('postcss-values-parser'),
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
        edgeThickness: ['edge-thickness'],  // typically there's just one value
        edgeColor: ['edge-color']
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
            ///console.log(ast);       // show modified AST as JS object
            ///console.log(ast.css);   // show modified AST as CSS
            // any warnings to report?
            ast.warnings().forEach(function (warn) {
                console.warn(warn.toString());
            });
            // Look for styles we can apply to the illustration
            ast.root.walkDecls(
                //options,    // anything useful to pass along here?
                function(decl, i) {
                    var testStyle = getIllustrationStylePropertyForTreeSSName( decl.prop );
                    ///console.log("TESTING for illustration style? "+ decl.prop +" => "+ testStyle);
                    if (!testStyle) {
                        // we ignore this property name
                        ///console.log("..NOT FOUND! skipping ahead to the next...");
                        return;
                    }
                    // OK, this property is interesting. To which elements does it apply?
                    var treessRule = decl.parent;
                    ///console.log("..FOUND! parent selector is '"+ treessRule.selector +"'");
                    /* If our illustration's style already includes a rule with
                     * this selector, add or overwrite the specified style using
                     * a proper name and value.
                     *
                     * OR, we could simply append new rules with the selector
                     * provided, even if it's redundant, and populate it with
                     * translated styles. For now, let's try the former.
                     *
                     * Why don't we keep this PostCSS AST around and use it for
                     * styling? Because the styles that can be expressed in TreeSS
                     * are a limited subset of Tree Illustrator's styling
                     * options, so TreeSS is strictly for interchange and
                     * its parsed rules should disappear once read or written.
                     *
                     * Instead, we should build on our existing
                     * `Illustration.style` object, using Knockout(?) to add
                     * callable functions (one per rule/selector) and any
                     * cached elements. Of course, both these would be dropped
                     * when serializing an Illustration back to JSON, but the
                     * selector strings will be preserved. So each time we load
                     * an illustration, we'll need to be able to recreate each
                     * rule's "gathering" function based on its selector
                     * string.
                     */
                    var matchingExistingRules = stylist.ill.style().filter(function(existingRule) {
                        return (existingRule.selector() === treessRule.selector);
                    });
                    if (matchingExistingRules.length > 1) {
                        console.error("Not expecting this selector to match more than one rule!");
                        console.log(matchingExistingRules);
                    }
                    var illustrationStyleRule;
                    if (matchingExistingRules.length === 0) {
                        // Add a new rule to our live style, and transcribe our compatible TreeSS declarations
                        //illustrationStyleRule = {};
                        //stylist.ill.style.push(illustrationStyleRule);
                        illustrationStyleRule = ko.mapping.fromJS(
                            { // wrap in 'style' to trigger proper wrapping
                                style: {
                                    selector: treessRule.selector,
                                    declarations: { }
                                }
                            },
                            TreeIllustrator.mappingOptions
                        ).style;    // ... and unwrap before adding it
                        stylist.ill.style.push(illustrationStyleRule);
                    } else {
                        // Transcribe our compatible TreeSS declarations to the first matching rule
                        illustrationStyleRule = matchingExistingRules[0];
                    }
                    // Add (or overwrite) our "native" element-style property
                    illustrationStyleRule.declarations[ testStyle ] = ko.observable(decl.value);
                    // TODO: Translate non-obvious values? Consider units, calculations...
                }

            );
            ///console.log("AFTER, illustration style:");
            ///console.log(stylist.ill.style());
            stylist.refreshViz();
        });
    }

    // TODO: Capture the current illustration's style as a TreeSS string
    var currentStyleToStylesheet = function(options) {
        options = options || {};
        // Build the stylesheet as an AST, using PostCSS helper methods
        var stylesheetRoot = postcss.root({
            raws: {after: '\n', semicolon: false}
        });
        // Add a brief comment pointing to TreeSS docs
        var comment = postcss.comment({
            text: "\n * This TreeSS file was generated by the Tree Illustrator, which is\n"
                   +" * part of the Open Tree of Life project. Details on its syntax and\n"
                   +" * keywords can be found at\n"
                   +" *\n"
                   +" * https://github.com/TreeViz/metastyle/wiki/TreeSS-is-not-(quite)-CSS\n"
        });
        stylesheetRoot.append(comment);
        // Create a new stylesheet and copy any TreeSS-compatible declarations to it.
        $.each(stylist.ill.style(), function(i, rule) {
            var compatiblePropertyNames = [ ];
            // Our internal declarations are in an object, keyed by property name
            for (propName in rule.declarations) {
                var treessName = getTreeSSNameForIllustrationStyleProperty( propName );
                if (treessName) {
                    // Gather *internal* names for processing below
                    compatiblePropertyNames.push( propName );
                }
            }
            if (compatiblePropertyNames.length > 0) {
                // Create a rule with this selector and create declarations
                var newRule = postcss.rule({
                    selector: rule.selector(),
                    raws: {before: '\n'}  // add a line break before each rule
                });
                $.each(compatiblePropertyNames, function(i, propName) {
                    var treessName = getTreeSSNameForIllustrationStyleProperty( propName );
                    var newDecl = postcss.decl({
                        prop: treessName,
                        value: rule.declarations[propName]()
                    })
                    newRule.append(newDecl);
                });
                stylesheetRoot.nodes.push(newRule);
            }
        });
        return stylesheetRoot.toString();
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

    /* We can also use PostCSS for smarter parsing of our style values.  This
     * should do a fast job of separating values from units etc. in a complex
     * value string:
     *  edgeThickness: calc(support * 1.5pt);
     * EXAMPLE:
        var valueProcessor = valueparser('calc(support * 1.5pt)');
        var ast = valueProcessor.parse();
        console.warn("VALUEPROCESSOR ast:");
        console.warn(ast);
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

            // Clear cache on demand (and abort without new result)
            if (options.CLEAR_CACHE) {
                cachedResult = null;
                // TODO: Continue and return fresh result?
                console.log("    CLEARING CACHE for selector '"+ selectorString +"'");
                return null;
            }

            // Return cached result, if any (else refresh this now)
            if ($.isArray(cachedResult)) {
                console.log("    USING CACHED VALUE for selector '"+ selectorString +"'");
                return cachedResult;
            }

            // Build (and cache) the list of elements matching this rule.
            // N.B. there might be *multiple* selectors whose results must be joined!
            console.log("    GATHERING elements that match '"+ selectorString +"'...");
            var allIllustrationElements = getAllIllustrationElements( );
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
                    var selMatchingElements = $.merge([ ], allIllustrationElements);
                    // This will be winnowed down (or clobbered) by nodes below
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
                        switch( node.type ) {
                            case 'tag':         // `illustration`, `tree`, `node`
                                // Filter to just the elements of the specified type
                                var elementType = node.value;
                                switch( elementType ) {
                                    case 'illustration':
                                        selMatchingElements = selMatchingElements.filter(function(el) {
                                            return (el instanceof TreeIllustrator.Illustration);
                                        });
                                        /*
                                        if (selMatchingElements.length === 0) {
                                            // auto-select the current illustration
                                            selMatchingElements = [stylist.ill];
                                        } else {
                                            // nothing else makes sense; select nothing
                                            selMatchingElements = [ ];
                                        }
                                        */
                                        break;
                                    case 'tree':
                                        selMatchingElements = selMatchingElements.filter(function(el) {
                                            return (el instanceof TreeIllustrator.IllustratedTree);
                                        });
                                        break;
                                    case 'clade':
                                    case 'node':
                                    default:
                                        console.warn('!!! IGNORING this unrecognized tag selector: '+ node.value);
                                        break;
                                }
                                break;
                            case 'universal':   // `*` (matches any element)
                                // This filter is a no-op; keep going with same selected elements!
                                /* TODO: Reconsider this? If '*' follows a
                                 * whitespace combinator, we should probably
                                 * move our focus to all descendants of the
                                 * currently matching elements.
                                 */
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
                                    return testElementAgainstQualifier(el, node, selMatchingElements);
                                });
                                break;
                            case 'attribute':   // `[posterior-support >= 0.75]`
                            case 'class':       // `.highlight-3`
                            case 'comment':
                            case 'root':        // a simple container of nodes
                            case 'string':      // found in quoted args `:bar(3, "A")`
                            case 'id':          // `#foo`
                            case 'selector':    // appears *within* a Pseudo with parens/args
                                console.warn('!!! IGNORING this unrecognized AST type: '+ node.type);
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
            /*
            console.log("GATHERING results:");
            console.log(ruleMatchingElements);
            */
            return cachedResult;
        }
        return gatherer;
    }
    /* More primitive support functions for element selection */
    var getAllIllustrationElements = function() {
        /* The default starting point for element selection is to grab the
         * illustration itself *and* everything in it: trees, clades, nodes...
         * What else?
         */
        var everything = [stylist.ill];
        $.merge( everything, getStyleDescendants(stylist.ill) );
        return everything;
    }
    var testElementAgainstQualifier = function( el, pseudoNode, matchingElementsSoFar ) {
        /* Return true if the specified element passes the qualifying test
         * defined in pseudoNode, false otherwise. Typically this node is a
         * pseudo-selector, possibly with provided arguments, e.g. `:depth(3)`
         *
         * TODO: Interpret this based on element type and the semantics of our
         * expected pseudo-selectors!
         */
        assert((pseudoNode.type === 'pseudo'),
               "testElementAgainstQualifier() is for Pseudo nodes, not type '"+ pseudoNode.type +"'!");
        // curry any supplied arguments (packaged for easy use below)
        var args = [];
        console.log("*** here come its arguments: ***");
        assert(pseudoNode.nodes.length === 1,
               "Expecting just one child Selector node in Pseudo filter!"); 
        assert(pseudoNode.nodes[0].type === 'selector',
               "Expecting the only child node in Pseudo filter to be a Selector!"); 
        var innerSelector = pseudoNode.nodes[0];
        assert(innerSelector.nodes.length > 0,
               "Expecting the Selector node in Pseudo filter to have child nodes!"); 
        $.each(innerSelector.nodes, function(i, node) {
            console.log(i, node.type, node.value);
            switch(node.type) {
                case 'number':
                    // Try to coerce numeric string to a proper number, preserve units
                    var num = {
                        value: Number(node.value),
                        unit: node.unit  // default is ""
                    };
                    if (isNaN(num.value)) {
                        console.warn("Pseudo arg "+ i +" in this node should be a number!");
                        console.warn(node);
                    } else {
                        args.push(num);
                    }
                    break;
                case 'tag':
                    /* Preserve these as strings here, since we can't be
                     * certain of the author's intent.
                     */
                    args.push(node.value);
                    break;
                default:
                    console.warn("Unable to handle args of type '"+ node.type +"'!");
                    console.warn(node);
            }
            if (node.nodes) {
                console.warn("! This arg also has "+ node.nodes.length +" inner nodes:");
                console.warn(node);
            }
        });

        // handle our expected filters only!
        switch(pseudoNode.value) {
            case ':eq':
                // EXAMPLE: `tree:eq(1)` keeps only the SECOND tree found
                console.log("Now I'd filter for :eq!");
                // keep only the n-th of our current set of matching elements
                var matchingPosition = Number(args[0]);
                if (isNaN(matchingPosition)) {
                    console.error("First argument to :eq() must be an integer!");
                    return false;
                }
                return ($.inArray(el, matchingElementsSoFar) === matchingPosition);
            case ':selected':  // TODO?
                console.log("Now I'd filter for :selected!");
                break;
            default:
                throw new Error("Unknown filter <"+ pseudoNode.value +"> found in this selector!");
        }
        return false; // TODO: What's the sensible fallback here?
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
/*
console.log("BEFORE combinator '"+ combinatorNode.value +"':");
console.log(matchingElements);
*/
        $.each( contextElements, function(i, el) {
            switch(combinatorNode.value) {
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
/*
console.log("AFTER combinator:");
console.log(matchingElements);
*/
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
            // Add all trees (and any other visible children) from its main elements list
            var styleChildren = el.elements().filter(function(child) {
                return (child instanceof TreeIllustrator.IllustratedTree);
            });
            return $.merge( children, styleChildren );
        }
        if (el instanceof TreeIllustrator.IllustratedTree) {
            // TODO: Add root node/clade
            if ($.isEmptyObject(el.data)) {
                // data is not loaded yet, skip for now...
                return children;
            } else {
                var rootNode = null; // TODO: fetch the root node?
                return $.merge( children, [ rootNode ] );
            }
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
        $.merge( descendants, children );   // add my children
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

    var flattenStylePropertyValue = function(val) {
        /* After any calculations are complete, reduce a complex (number + unit)
         * value to familiar CSS value strings, e.g. "30px"
         */
        try {
            return String(val.value) + String(val.unit);
        } catch(e) {
            // we were passed something unexpected
            console.error('flattenStylePropertyValue() was passed something unexpected:');
            console.error(val);
            return val;
        }
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

    var evaluateValueNode = function(valueNode, valueProcessor) {
        assert((valueNode.type === 'value'),
               "evaluateValueNode() is for Value nodes, not type '"+ valueNode.type +"'!");
        // Does the this value node children?
        switch (valueNode.nodes.length) {
            case 0:
                // There's no value here! Probably due to a bad selector (input)
                throw new Error("Unable to parse non-string selector input <"+ typeof(valueProcessor.input) +">: "+ valueProcessor.input);
            case 1:
                /* Just one Value node, usually with more detail in its children. (This is the typical case.)
                 *
                 * N.B. for now, we ignore all but the first inner
                 * child. If there are 2 or more, it means they're using
                 * CSS "shortcut" notation, for example `margin: 0 2px 4em;`
                 */
                switch (valueNode.nodes.length) {
                    case 0:
                        throw new Error("Missing inner value node from this input: "+ valueProcessor.input);
                    case 1:
                        valueNodeChild = valueNode.nodes[0];
                        switch (valueNodeChild.type) {
                            case 'word':  // probably an enumerated value like 'INCHES'
                                return (valueNodeChild.value);
                            case 'number':  // includes its numeric value (as a string!) and units
                                return flattenStylePropertyValue(valueNodeChild);
                            case 'operator':  //
                                return null; // TODO
                            case 'func':
                                evaluateFuncNode(valueNodeChild, valueProcessor);
                                /*
                                */
                            default:
                                throw new Error("Unexpected inner value node <"+
                                                valueNodeChild.type +"> from this input: "+
                                                valueProcessor.input);
                        }
                    default:
                        throw new Error("Unexpected multiple inner value nodes from this input: "+
                                        valueProcessor.input);
                }
            default:
                // More than one top-level node! This is not expected...
                console.warn(valueNode);
                throw new Error("Multiple inner value(?) nodes from this input <"+
                                typeof(valueProcessor.input) +">: "+ valueProcessor.input);
        }
        assert( false, "evaluateValueNode(): We should not reach this line!");
        return null;
    }

    var evaluateFuncNode = function(funcNode, valueProcessor) {
        assert((funcNode.type === 'func'),
               "evaluateFuncNode() is for Function nodes, not type '"+ funcNode.type +"'!");
        // handle our expected functions only!
        switch(funcNode.value) {
            case 'calc':
                console.log("Now I'd calc!");
                break;
            case 'attr':
                console.log("Now I'd attr!");
                break;
            default:
                throw new Error("Unknown function <"+ funcNode.value +"> found in this input: "+
                                valueProcessor.input);
        }
    }

    var getValueFromStyleDeclarations = function(propPath, styleInfo) {
        /* Fetch the value found (if any) at the specified property name or
         * dot-delimited path. In the latter case, we expect to find nested
         * objects with our desired value at some arbitrary depth, so we'll
         * need to unpack each in turn. If no value is found, return null.
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
        var testObj = ko.utils.unwrapObservable(styleInfo),
            lastFoundValue = null;

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

            if (!$.isPlainObject(testObj)) {
                // TODO: Complain or bail out now, vs. try/catch below?
            }
            try {
                if (!(pn in testObj)) {
                    /*
                    console.warn("getValueFromStyleDeclarations(): member '"+ pn +"' not found for style '"+ propPath +"'");
                    console.warn(testObj);
                    */
                    return null;
                }
            } catch(e) {
                console.error("getValueFromStyleDeclarations(): invalid styleInfo object <"+ typeof(testObj) +"> found for style '"+ propPath +"'");
                console.error(testObj);
                return null;
            }
            lastFoundValue = ko.utils.unwrapObservable(testObj[pn]);

            /*
            console.log('  raw value: <'+ typeof(lastFoundValue)  +'>:');
            console.log(lastFoundValue);
            */

            if ( (i+1) < propNameSeries.length) {
                testObj = lastFoundValue;  // we're going deeper
                /*
                console.log('  LOOPING with the raw value as property-info holder...');
                */
            }
        });

        if (lastFoundValue === null) {
            // TODO: Reject other "meaningless" values as well? Empty strings? The word "null"?
            return null;  // no matching value found
        }

        // Now we can do the harder work of parsing any non-obvious value
        // Check for errors! If this goes blooey, return the raw value or null?
        try {
            var valueProcessor = valueparser( lastFoundValue );
            var ast = valueProcessor.parse();

            /*
            console.warn("VALUEPROCESSOR input <"+ typeof(valueProcessor.input) +">:");
            console.warn(valueProcessor.input);
            console.warn("VALUEPROCESSOR ast:");
            console.warn(ast);
            */

            /* Test its value (note subtle parsing error for non-string input!)
             * and return a single value, which might be a simple type or an
             * object with more details (e.g. amount and units)
             */
            var mainValueNode,
                valueNodeChild;
            if ((ast.nodes.length === 1) && (ast.nodes[0].type === 'value')) {
                // A single Value node was found (a common case)
                mainValueNode = ast.nodes[0];
                return evaluateValueNode(mainValueNode, valueProcessor);
            } else {
                // Something new is happening! Let's get a closer look...
                debugger;
            }

            var constrainedValue = stylist.ill.getConstrainedStyle(propPath, lastFoundValue);
            /*
            console.log('RETURNING constrainedValue <'+ typeof(constrainedValue) +'>:');
            console.log(constrainedValue);
            */
            return constrainedValue;  // TODO: Check for errors or null response here?

        } catch(e) {  // probably a ParserError, e.g. for unclosed parentheses
            console.warn("getValueFromStyleDeclarations(): unable to parse this style value!\n"
                        +"  Returning its raw value <"+ typeof(lastFoundValue)  +">:");
            console.warn(lastFoundValue);
            /*
            console.warn("  error details:");
            console.warn(e);
            */
            return lastFoundValue;
        }
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
