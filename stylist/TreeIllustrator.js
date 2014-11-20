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

        if (!data || typeof(data) !== 'object') data = {};

        // safely refer to this instance
        var self = this;

        /* define PRIVATE members (variables and methods)functions and with 'var' */
        var secretSauce = function() {
            alert("TOP SECRET!");
        }
        //var name = data.name || 'TEST ILL';

        /* define PUBLIC variables (and privileged methods) with 'self' */
        //self.myVariable = ko.observable();
        //self.myComputed = ko.computed(function () { return "hello" + self.myVariable() });
        self.metadata = ko.observable();
        self.metadata = ko.observable();
        self.styles = ko.observable();
        self.sceneGraph = ko.observable();
        self.vegaSpec = ko.observable();

        // two initial test properties for tree placement
        self.treeX = ko.observable( 'treeX' in data ? data.treeX : physicalWidth / 2.0 );
        self.treeY = ko.observable( 'treeY' in data ? data.treeY : physicalHeight / 2.0 );

        self.name = ko.observable( 'name' in data ? data.name : 'TEST ILL' );
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
