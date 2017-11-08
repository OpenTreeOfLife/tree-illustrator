/*
 * Process and apply TreeSS styles to a specified illustration
 * 
 * N.B. Incoming `options` object should include these properties:
 *   - `illustration`: an instance of `Treeillustrator.Illustration` 
 * If we want persistent state (e.g. cached results, lists of matching elements
 * per selector) we should specify this in defaultOptions instead, and create a
 * new PostCSS processor for each new illustration.
 *
 * This is an unusual PostCSS plugin, in that it has side effects beyond its
 * output (processed) CSS. It also directly modifies the structure and markup
 * of the target Illustration, in order to express style concepts (such as
 * collapsed subclades) that can't be done using just SVG+CSS.
 *
 * TODO: Support "pre-layout" and "post-layout" processing of TreeSS?
 */
var postcss = require('postcss');
 
module.exports = postcss.plugin('treess', function myplugin(defaultOptions) {
    defaultOptions = defaultOptions || {};
    /* IF expecting a processor-specific illustration!
    if (!defaultOptions || !('illustration' in defaultOptions)) {
        console.error('postcss-treess plugin must specify an illustration!');
        return null;
    }
    */
    
    return function (css, options) {
        // Walk the stylesheet (AST) and apply styles to Illustration elements
        options = options || {};

        css.walkRules(function (rule) {
         
            // Handle comments in this rule
            rule.walkComments(function(comm, i) {
            });

            // Handle declarations in this rule
            rule.walkDecls(function (decl, i) {
                /*
                console.log("DECLARATION: "+ decl.toString());
                console.log("  prop? "+ decl.prop);
                console.log("  value? "+ decl.value);  // strips '!important'
                console.log("  important? "+ decl.important);  // true, or undefined
                */
                var val = decl.value;
                if (val.indexOf( 'fontstack(' ) !== -1) {
                    console.log("found fontstack");
                    decl.value = 'FONTSTACK BOOEY!';
                }
            });
         
        });
    }
    
    /* 
     * Test a TreeSS selector against Illustration + Tree elements.
     *
     * This is esp. useful in pre-layout scenarios, when we might need to prune
     * or hide collapsed clades, apply node order "laddering", etc.
     */
    function findMatchingIllustrationElements(selector, options) {
        options = options || {};
        return [ ];
    }

    /* 
     * Test a TreeSS selector against Illustration + Tree elements.
     *
     * This is esp. useful in post-layout scenarios, to decorate output with
     * marker classes (if this wasn't done in the tree-layout code).
     */
    function findMatchingSVGElements(selector, options) {
        options = options || {};
        return [ ];
    }
 
});
