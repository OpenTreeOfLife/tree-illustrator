/* 
 * Generally useful tools for modules in Tree Illustrator. They might be
 * concerned with display logic, geometry and transformation, text formatting;
 * anything that spans our normal lines of responsibility.
 */

function jiggle( range ) {
    // Return a number +- zero, within this range
    return Math.round(Math.random() * range * 2) - range; 
}


/* "Sniffers" to guess the format of user-entered tree data. 
 * N.B. these don't need to be fool-proof; they're just used to pre-select
 * the most likely format. 
 */
function isProbablyNewick(data) {
    if (typeof(data) !== 'string') {
        return false;
    }
    data = $.trim(data);
    // Look for expected start and end marks
    // N.B. this will reject a valid (but trivial) string like 'A;'
    if (data.startsWith('(') && data.endsWith(');')) {
        return true;
    }
    return false;
}

var matchesNEXUSBlockStarter = new RegExp('begin \\w+;', 'i');
function isProbablyNEXUS(data) {
    if (typeof(data) !== 'string') {
        return false;
    }
    // Look for required(?) first line
    if ($.trim(data).startsWith("#nexus") || $.trim(data).startsWith("#NEXUS")) {
        return true;
    }
    // ... or accept typical NEXUS block starter
    if (matchesNEXUSBlockStarter.test(data)) {
        return true;
    }
    return false;
}

function isProbablyNeXML(data) {
    /* NOTE that this is the most "expensive" sniffer, so it's probably
     * best to check the others first.
     */
    var testXML;
    if (data instanceof XMLDocument) {
        testXML = data;
    } else {
        try {
            testXML = $.parseXML(data);
            if (!testXML) {
                // if data is not a string, result is null 
                return false;
            }
        } catch (err) {
            // var failed to parse as XML
            ///console.error(err);
            return false;
        }
    }
    if ($(testXML).children().length === 0) {
        // XML is strangely empty
        return false;
    }
    var rootNodeName = $(testXML).children()[0].nodeName;
    switch( rootNodeName ) {
        case 'nex:nexml':
            break;
        case 'nexml':
            break;
        default:
            return false;
    }
    return true;
}

function isProbablyRPhylo(data) {
    // test for valid JSON/JS nested array, then examine its structure
    var testObj;
    if ($.isPlainObject(data)) {
        testObj = data;
    } else {
        try {
            testObj = eval(data);
            if (!testObj) {
                // if data is not a string, result is null 
                return false;
            }
        } catch (err) {
            // var failed to evaluate to a JS object
            console.error(err);
            return false;
        }
    }
    // check for basic phylo fields
    return ('edge' in testObj) && ('tip.label' in testObj) && ('Nnode' in testObj);
}

/* Copied from vg.data.phylogram.js, for wider use (but keeping the code in
 * both places, to minimize dependencies in the Vega transform).
 */
function radiansToDegrees(r) {
    return (r * 180 / Math.PI);
}
function degreesToRadians(d) {
    return (d * Math.PI / 180);
}
function normalizeDegrees(d) {
    // convert to positive integer, e.g. -90 ==> 270
    return (d + (360 * 3)) % 360;
}

// export some members as a simple API
var api = [
    'jiggle',
    'isProbablyNewick',
    'isProbablyNEXUS',
    'isProbablyNeXML',
    'isProbablyRPhylo',
    'radiansToDegrees',
    'degreesToRadians',
    'normalizeDegrees'
];
$.each(api, function(i, methodName) {
    // populate the default 'module.exports' object
    exports[ methodName ] = eval( methodName );
});

