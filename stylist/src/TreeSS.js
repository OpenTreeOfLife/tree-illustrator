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
    var TODO = {};

    /*
     * Class methods 
     */

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

    function applyTreeSS(css, options) {
        css = css || testCss; //above
        options = options || {};
        options.illustration = stylist.ill;
        options.source = 'applyTreeSS';
        var output = treessProcessor.process(css, options).then(function(result) {
            console.log("=== modified AST ===");
            // show modified AST, rendered as CSS
            console.log(result);
            // any warnings to report?
            result.warnings().forEach(function (warn) {
                console.warn(warn.toString());
            });
            // show modified AST, rendered as CSS
            console.log(result.css);
        });
    }

    /* TODO: Capture piecemeal style decisions (from UI? or Vega spec?) as TreeSS
     *  - capture everything we can as TreeSS (no guarantees!)
     *  - build on existing TreeSS sheet/cascade, if found
     */

    /* expose class constructors (and static methods) for instantiation */
    return {
        // expose enumerations, classes, etc.
        TODOenums: TODOenums,
        applyTreeSS: applyTreeSS,
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
