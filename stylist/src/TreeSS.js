/*
 * A reader/writer for TreeCSS stylesheets, see
 * https://github.com/TreeViz/metastyle/wiki
 */

// Any dependencies to declare?
var utils = require('./ti-utils.js'),
    stylist = require('./stylist.js'),
    //postcss = require('postcss-js'),  // limited parsing of AST only
    postcss = require('postcss'),
    prefixer = require('autoprefixer')
    treess = require('./postcss-treess.js');

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
                        rule.selectMatchingElements = filterFromTreeSSSelector( rule.selector );  // TODO: parse/normalize this string?
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
        .use(treess);
        // list more plugins here?

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
        postcss: postcss  // TODO: REMOVE THIS
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
