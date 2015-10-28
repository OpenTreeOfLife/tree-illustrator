/* 
 * Generally useful tools for modules in Tree Illustrator. They might be
 * concerned with display logic, geometry and transformation, text formatting;
 * anything that spans our normal lines of responsibility.
 */

function jiggle( range ) {
    // Return a number +- zero, within this range
    return Math.round(Math.random() * range * 2) - range; 
}

// export some members as a simple API
var api = [
    'jiggle'
];
$.each(api, function(i, methodName) {
    // populate the default 'module.exports' object
    exports[ methodName ] = eval( methodName );
});
