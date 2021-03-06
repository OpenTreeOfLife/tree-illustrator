/*
 * In this editor, we generate a declarative Vega spec (and its downstream d3
 * visualization) from a more descriptive scene-graph model. This corresponds
 * closely with a web UI that's bound and enabled using KnockoutJS.
 */

var $ = require('jquery'),
    utils = require('./ti-utils'),
    jszip = require('jszip'),
    FileSaver = require('file-saver'),
    Blob = require('blob-polyfill'),
    md5 = require('spark-md5'),
    vg = require('vega'),
    TreeIllustrator = require('./TreeIllustrator.js'),
    stashTransform = require('./vg.data.stash.js');
    pluckTransform = require('./vg.data.pluck.js');
    nexsonTransform = require('./vg.data.nexson.js');
    phylogramTransform = require('./vg.data.phylogram.js');
    assert = require('assert');

// expose TreeIllustrator to JS in the main UI 
global.TreeIllustrator = TreeIllustrator;
global.$ = $;

// register custom transforms with the installed vega
vg.transforms['stash'] = stashTransform;
vg.transforms['pluck'] = pluckTransform;
vg.transforms['nexson'] = nexsonTransform;
vg.transforms['phylogram'] = phylogramTransform;

// patch missing JS console on some (very) old browsers
if (typeof console == 'undefined') console = {
    log: function(msg) {},
    warn: function(msg) {},
    error: window.alert
}

// Test query-string variables, from http://stackoverflow.com/a/5158301
function getParameterByName(name) {
    var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
}

/* Determine the current host application, so we can adapt to the advantages
 * and limitations of each:
 *  - storage options and requirements
 *      - slot- vs. URL-based storage
 *      - naming restrictions (uniqueness, etc)
 *  - data sources and formats, e.g.
 *      - values from a server-side kernel in Jupyter
 *      - user's resources in OpenTree repository
 *      - special adapters/validators for tree data
 *  - optional features and UI
 *  - adjustments to layout and style
 *
 * The host application should be specified on the query-string of
 * 'stylist.html', for example 
 *      .../stylist.html?hostApplication=JUPYTER_NOTEBOOK
 * The default value is a standalone page, which depends entirely on outside
 * web services for data and storage.
 */
var hostApplication = TreeIllustrator.hostApplications.STANDALONE;
// Validate received host-app string against enumerated values
$.each(TreeIllustrator.hostApplications, function(i, testValue) {
    if (getParameterByName('hostApplication') == testValue) {
        hostApplication = testValue;
    }
});
console.log("Tree Illustrator host application: "+ hostApplication);

// We'll attempt to dynamically load appropriate storage backends and other components
var LOCAL_FILESYSTEM = TreeIllustrator.storageBackends.LOCAL_FILESYSTEM,
    JUPYTER_NOTEBOOK = TreeIllustrator.storageBackends.JUPYTER_NOTEBOOK,
    GITHUB_REPO = TreeIllustrator.storageBackends.GITHUB_REPO;
var storage = {};
storage[ LOCAL_FILESYSTEM ] = require('./storage/local-filesystem.js');
storage[ JUPYTER_NOTEBOOK ] = require('./storage/ipython-notebook-bridge.js');
storage[ GITHUB_REPO ]      = require('./storage/namespaced-urls.js');

storage.lastSave = {
    backend: ko.observable(null),
    location: ko.observable(null)
};
/* Each time the user sucessfully saves the current illustration, stash the
 * storage backend and any location information. NOTE that location values
 * are different for each storage backend.
 *
 * LOCAL_FILESYSTEM only knows the proposed filename, *not* the one
 * actually applied or its location in the filesystem:
 *      backend: TreeIllustrator.storageBackends.LOCAL_FILESYSTEM,
 *      location: 'trees-about-bees-LATEST.zip'
 *     OR if that proposed name is moot, empty or unreliable:
 *      location: 'UNKNOWN'
 *
 * JUPYTER_NOTEBOOK is simply an integer pointing to the n-th storage slot:
 *      backend: TreeIllustrator.storageBackends.JUPYTER_NOTEBOOK,
 *      location: 4
 *
 * GITHUB_REPO knows the final assigned Illustration ID assigned by the
 * phylesystem API:
 *      backend: TreeIllustrator.storageBackends.GITHUB_REPO,
 *      location: '/jimallman/trees-about-bees'
 *
 * Both should reset to null if we abandon an illustration or open a new one
 * (or if an attempted save fails?):
 *      backend = null;
 *      location = null;
 */
function updateLastSavedInfo( backend, location ) {
    storage.lastSave.backend(backend);
    storage.lastSave.location(location);
    console.warn('UPDATED lastSave, backend: '+ storage.lastSave.backend() +', location: '+ storage.lastSave.location());
}
function clearLastSavedInfo() {
    storage.lastSave.backend(null);
    storage.lastSave.location(null);
    console.warn('CLEARED lastSave, backend: '+ storage.lastSave.backend() +', location: '+ storage.lastSave.location());
}

/* Offer all studies and trees from the Open Tree of Life repository,
 * plus other sources and tree formats. We'll make a tree of Knockout
 * observables, so we can update them (and the UI) on-the-fly.
 *
 * This should adapt to the current host application, for example:
 *  - "local" variables from an iPython notebook (incl. server-side kernel)
 *  - similar "local" data in an Arbor workflow
 *  - the current user's studies/trees/favorites in OpenTree
 *
 * N.B. The current display logic will hide any group that has no children.
 */
var availableTrees = ko.mapping.fromJS([
    {
        name: "Placeholder tree", 
        url: './placeholder-tree.json'
    },
    {
        name: "Data used in this illustration",
        children: [
            /* A list of "friendly" labels identifying existing source data
             * already found in this illustration. Filter by type/format, based
             * on the current context (e.g. trees vs. traits)?
             * Examples would look something like this:
            {
                name: "Trait data 1.2e",
                url: './inputs/Trait data 1.2e'
            },
            {
                name: "Second (sparse) parsimony trees",
                url: './inputs/Second (sparse) parsimony trees'
            }
             */
            {
                name: "Trait data 1.2e",
                url: './inputs/Trait data 1.2e'
            },
            {
                name: "Second (sparse) parsimony trees",
                url: './inputs/Second (sparse) parsimony trees'
            }
        ]
    },
    {
        name: "From notebook kernel",
        children: [
            /* A list of variables, each marked with its language/kernel */
        ]
    },
    {
        name: "Examples",
        children: [
            {
                name: "Tuovila, 2013", 
                url: buildStudyFetchURL( '2380' )
                /* NOTE that this one has two trees!
                treeID: 'tree4999',
                otusID: 'tree5000'
                */ 
            },
            {
                name: "Jansen, 2007", 
                url: buildStudyFetchURL( 'pg_10' )
            },
            {
                name: "Drew BT, 2014", 
                url: buildStudyFetchURL( 'pg_2821' )
            }
        ]
    },
    {
        name: "Enter or upload tree data",
        /*
        name: "Enter or upload tree data as...",
        */
        children: [
            {
                name: "Newick string"
            },
            {
                name: "Newick string with extra data"
            },
            {
                name: "NEXUS"
            }
        ]
    },
    {
        name: "On the web",
        children: [
            {
                name: "Enter OpenTree study and tree ids"
            },
            {
                name: "Enter URL to NexSON 1.0"
            },
            {
                name: "Enter URL to a GitHub gist"
            }
        ]
    }
]);

var availableDataSources = ko.mapping.fromJS([
    {
        name: "Placeholder dataset", 
        url: './placeholder-dataset.json'
    },
    {
        name: "Data used in this illustration",
        children: [
            /* A list of "friendly" labels identifying existing source data
             * already found in this illustration. Filter by type/format, based
             * on the current context (e.g. trees vs. traits)?
             */
            {
                name: "FOO"
            },
            {
                name: "BAR"
            }
        ]
    },
    {
        name: "From notebook kernel",
        children: [
            /* A list of variables, each marked with its language/kernel */
        ]
    },
    {
        name: "Enter or upload data"
        /*
        name: "Enter or upload data as...",
        children: [
            {
                name: "Comma-separated values"
            },
            {
                name: "Tab-separated values"
            }
            // etc.
        ]
        */
    },
    {
        name: "On the web",
        children: [
            {
                name: "Enter URL to data file"
            },
            {
                name: "Enter URL to a GitHub gist"
            }
        ]
    }
]);

function updateAvailableTrees() {
    /* Build an appropriate (nested) list of choices, based on the current host
     * application.
     *
     * N.B. this should be repeatable to update tree sources as they come and go.
     */
    switch(hostApplication) {
        case TreeIllustrator.hostApplications.JUPYTER_NOTEBOOK:
            /* Fetch notebook variables from the server-side kernel, via
             * Jupyter's JS API.
             * TODO: Can we deal with multiple kernels in the newest notebooks?
             * TODO: Can we distinguish R-via-Python from the Python kernel?
             */
            storage[ JUPYTER_NOTEBOOK ].getTreeSourceList(function(response) {
                var notebookSourceList = ko.utils.arrayFirst(availableTrees(), function(item) {
                    return item.name() === 'From notebook kernel';
                });
                notebookSourceList.children.removeAll();
                if ('data' in response) {
                    var data = response.data;
                    if (data.length === 0) {
                        // explain the empty list, suggest a remedy
                        notebookSourceList.children.push({
                            name: ko.observable("No variables found! Run code cells and try again."),
                            disabled: ko.observable(true)  // info-only (not clickable)
                        });
                    } else {
                        // show any variables returned and their source kernel/lang
                        $.each(data, function(i, nbVar) {
                            // nbVar is a two-item list like ['Hi mom', 'str']
                            var nbVarName = nbVar[0],
                                nbVarType = nbVar[1],
                                nbVarLanguage = nbVar[2];
                            notebookSourceList.children.push({
                                name: ko.observable(nbVarName +" ("+ nbVarLanguage +" "+ nbVarType +")"),
                                kernel: ko.observable(nbVarLanguage)  
                                  // TODO: refers to kernel-id vs. language? eg 'python2'
                            });
                        });
                    }
                } else {
                    console.error(response.error || "No data returned (unspecified error)!");
                    // show the error in the source-list, and suggest a remedy
                    notebookSourceList.children.push({
                        name: ko.observable("ERROR loading notebook values. Run code cells and try again."),
                        disabled: ko.observable(true)  // info-only (not clickable)
                    });
                }
            })
            
            break;

        case TreeIllustrator.hostApplications.STANDALONE:
            // nothing to do here
            break;
    }
}

/* Conversion utilities for physical units
 */
var cm_per_inch = 2.54;
function inchesToCentimeters( inches ) {
    return inches * cm_per_inch;
}
function centimetersToInches( cm ) {
    return cm / cm_per_inch;
}

var pt_per_inch = 72.0;
function inchesToPoints( inches, ppi ) {
    return inches * pt_per_inch;
}
function pointsToInches( pt, ppi ) {
    return pt / pt_per_inch;
}

var pt_per_cm = pt_per_inch / cm_per_inch;
function centimetersToPoints( cm, ppi ) {
    return cm * pt_per_cm;
}
function pointsToCentimeters( pt, ppi ) {
    return pt / pt_per_cm;
}

function pixelsToInches( px, ppi ) {
    return px / ppi;
}
function inchesToPixels( inches, ppi ) {
    return inches * ppi;
}
function pixelsToCentimeters( px, ppi ) {
    return inchesToCentimeters(px / ppi);
}
function centimetersToPixels( cm, ppi ) {
    return centimetersToInches( cm ) * ppi;
}

function pixelsToPhysicalUnits( px, ppi ) {
    if (ill.style.printSize.units() === TreeIllustrator.units.INCHES) {
        return pixelsToInches( px, ppi );
    } else {
        return pixelsToCentimeters( px, ppi );
    }
}
function physicalUnitsToPixels( units, ppi ) {
    if (ill.style.printSize.units() === TreeIllustrator.units.INCHES) {
        return inchesToPixels( units, ppi );
    } else {
        return centimetersToPixels( units, ppi );
    }
}

function getPhysicalUnitSuffix() {
    if (physicalUnits === 'INCHES') {
        return 'in';
    } else {
        return 'cm';
    }
}

// ruler metrics (adjust for legibility)
var rulerWidth = 25;  // px

/* Maintain a few independent scales (in pixels/inch) to support the
 * illustration editor. These will sometimes align, but it's vital that we can
 * discriminate between them as each is suited for a different purposes.
 */
var browser_ppi;  // SVG resolution in current browser (not reliable!)
var internal_ppi = 90;  // SVG default pixels per inch (can be modified to suit printing device)
var display_ppi = internal_ppi;  // pixels per inch at current magnification (zoom level)

/* Track the values used for our viewport (overall size, margins vs. illustration)
 * for easy re-use in rulers, etc. For background, see SVG's viewBox docs: 
 * http://www.w3.org/TR/SVG/coords.html#ViewBoxAttribute
 */
var viewbox = {
    'x': 0,
    'y': 0,
    'width': 0,
    'height': 0,
}
function updateViewportViewbox($viewport) {
    /* Adjust the main VG viewBox as needed to match the current illustration
     * size and chosen magnification. The result should be that scrollbars offer 
     * access to all SVG elements (in or out of the printed area), while the user
     * is free to choose arbitrary levels of magnification.
     */
    // TODO: maintain the current center point, but surrender empty territory
    if (!$viewport) {
        $viewport = $("#viz-outer-frame div.vega");
    }

    /* Make sure we have latest DIV size+proportions. (These can change if the
     * user toggles scrollbars or resizes the surrounding page.) This is the
     * new *minimum* size for our SVG element, to avoid gaps in the viewport!
     */
    var vpDiv = $viewport[0];
    var divWidth = vpDiv.clientWidth;
    var divHeight = vpDiv.clientHeight;
    var divProportions = divWidth / divHeight;

    /* What must be in the viewbox? All illustration elements (so we can scroll
     * to them), plus any padding needed (at current magnification) to fill the
     * viewport.
     */
    var ebox = getInclusiveIllustrationBoundingBox();
    // this is the area with all illustration elements
    var center = {
        x: ebox.x + (ebox.width / 2),
        y: ebox.y + (ebox.height / 2)
    };

    // copy to our persistent viewbox
    for (var prop in ebox) {
        viewbox[prop] = ebox[prop];
    }

    var proportionalWidth = Math.round(viewbox.width * viewportMagnification);
    var proportionalHeight = Math.round(viewbox.height * viewportMagnification);

    // compare its proportions to our *new* viewport; pad as needed to fill space
    var bbox = viewbox;
    if (proportionalWidth < divWidth) {
        // div is wider, pad viewbox width to match
        var adjustedWidth = divWidth / viewportMagnification;
        var extraWidth = adjustedWidth - viewbox.width;
        viewbox.width = adjustedWidth;
        viewbox.x -= (extraWidth / 2);
    } 
    if (proportionalHeight < divHeight) {
        // div is taller, pad viewbox height to match
        var adjustedHeight = divHeight / viewportMagnification;
        var extraHeight = adjustedHeight - viewbox.height;
        viewbox.height = adjustedHeight;
        viewbox.y -= (extraHeight / 2);
    }

    // move our background to the new viewport top-left corner
    d3.selectAll('#viewport-background, #viewport-bounds')
        .attr('x', viewbox.x)
        .attr('y', viewbox.y);

    // Update physical size of SVG element based on new viewbox and magnification
    proportionalWidth = Math.round(viewbox.width * viewportMagnification);
    proportionalHeight = Math.round(viewbox.height * viewportMagnification);
    var svgWidth = proportionalWidth;
    var svgHeight = proportionalHeight;

    // NOTE that we need to use el.setAttribute to keep mixed-case attribute names
    var svg = $viewport.find('svg')[0];

    // make sure we're at least filling the available viewport DIV
    svg.setAttribute('width', svgWidth);
    svg.setAttribute('height', svgHeight);

    // TODO: nudge scrollbars to hold a steady view?

    svg.setAttribute('viewBox', (viewbox.x +' '+ viewbox.y +' '+ viewbox.width +' '+viewbox.height));
    $('#viewbox-indicator').html(svg.getAttribute('viewBox'));
    $('#mag-indicator').html(viewportMagnification);
    $('#svg-width-indicator').html(svg.getAttribute('width'));
    $('#svg-height-indicator').html(svg.getAttribute('height'));

    /*
    console.log('OLD div w: '+ svg.getAttribute('width'));
    console.log('  viewbox.width: '+ viewbox.width);
    console.log('  * magnification: '+ viewportMagnification);
    console.log('  NEW div w: '+ viewbox.width * viewportMagnification);
    console.log('  INT div w: '+ Math.round(viewbox.width * viewportMagnification));
    console.log('OLD div h: '+ svg.getAttribute('height'));
    console.log('  viewbox.height: '+ viewbox.height);
    console.log('  * magnification: '+ viewportMagnification);
    console.log('  NEW div h: '+ viewbox.height * viewportMagnification);
    console.log('  INT div h: '+ Math.round(viewbox.height * viewportMagnification));
    */
}

/* TODO: Load available styles from an external source or store. These might be
 * shared or private. Styles should include name and description, defaults for
 * most visual properties, and constraints (soft or hard) that we can test
 * against.
 */
var availableStyleGuides = null;
function showStyleGuidePicker() {
    // for now, load from a static JSON file 
    var lookupURL = './style-guides.json';

    //showModalScreen("Gathering style guides...", {SHOW_BUSY_BAR:true});
    $.ajax({
        global: false,  // suppress web2py's aggressive error handling?
        type: 'GET',
        dataType: 'json',
        // crossdomain: true,
        // contentType: "application/json; charset=utf-8",
        url: lookupURL,
        complete: function( jqXHR, textStatus ) {
            //hideModalScreen();
            if ((textStatus !== 'success') && (textStatus !== 'parsererror')) {
                var errMsg = 'Sorry, there was an error looking up the available style guides. (See JS console for details.)';
                alert(errMsg); 
                console.warn(errMsg +'\n\ntextStatus='+ textStatus +'\n\n'+ jqXHR.responseText);
                //showErrorMessage(errMsg);
                return;
            }
            // convert raw response to JSON
            var resultsJSON = $.parseJSON(jqXHR.responseText);
            if (resultsJSON.length === 0) {
                alert('No style guides found!');
            } else {
                availableStyleGuides = resultsJSON;
                var $chooser = $('#styleguide-chooser');
                $chooser.find('.found-matches').empty();
                var $currentNameDisplay = $chooser.find('#current-styleguide-name');
                $currentNameDisplay.html( ill.styleGuide.name() );
                if (ill.styleGuide.version) {
                    // pivot based on version type
                    switch(ill.styleGuide.version.type()) {
                        case TreeIllustrator.versionTypes.CHECKSUM:
                            $currentNameDisplay.append('<em class="version">&nbsp; &lt;'+ ill.styleGuide.version.value() +'&gt;</em>');
                            break;
                        case TreeIllustrator.versionTypes.TIMESTAMP:
                            $currentNameDisplay.append('<em class="version">&nbsp;  as of '+ ill.styleGuide.version.value() +'</em>');
                            break;
                        case TreeIllustrator.versionTypes.SEMANTIC:
                            $currentNameDisplay.append('<em class="version">&nbsp; v'+ ill.styleGuide.version.value() +'</em>');
                            break;
                        default:
                            $currentNameDisplay.append('<em class="version">Unknown version type: '+ ill.styleGuide.version.value() +'</em>');
                    }
                }
                $chooser.find('#current-styleguide-source').html( ill.styleGuideSourceHTML() );
                $.each(availableStyleGuides, function(i, match) {
                    // is this the illlustration's current style guide? compare name, source, version
                    var isAssignedStyleGuide = false;
                    var isPreviousVersionOfAssignedStyleGuide = false;
                    if ((match.name === ill.styleGuide.name()) && (match.source.value === ill.styleGuide.source.value())) {
                        isAssignedStyleGuide = true;
                        if (match.version.value !== ill.styleGuide.version.value()) {
                            isPreviousVersionOfAssignedStyleGuide = true;
                        }
                    }
                    var $matchInfo = $('<div class="match"><img class="thumbnail"></img><div class="name"></div><div>Source: <span class="source"></span></div><div class="description"></div></div>');
                    var $thumb = $matchInfo.find('.thumbnail');
                    if (isAssignedStyleGuide) {
                        $matchInfo.addClass('assigned');
                        if (isPreviousVersionOfAssignedStyleGuide) {
                            $matchInfo.addClass('previous-version');
                            $thumb.after('<a class="btn btn-small" href="#" onclick="stylist.applyChosenStyleGuide(this); return false;">Update</a>');
                        } else {
                            $thumb.after('<a class="btn btn-small disabled" href="#" onclick="alert(\'This style guide is already applied to the current illustration.\'); return false;">Assigned</a>');
                        }
                    } else if (match.constraints) {
                        $thumb.after('<a class="btn btn-small" href="#" onclick="stylist.applyChosenStyleGuide(this); return false;">Apply</a>');
                    } else {
                        $thumb.after('<a class="btn btn-small disabled" href="#" onclick="alert(\'Sorry, this is just an empty example.\'); return false;">Example</a>');
                    }
                    $matchInfo.find('.thumbnail').attr('src', match.thumbnailSrc || './broken.png');
                    var $nameDisplay = $matchInfo.find('.name');
                    $nameDisplay.html(match.name || '<em>No name found</em>');
                    if (match.version) {
                        // pivot based on version type
                        switch(match.version.type) {
                            case TreeIllustrator.versionTypes.CHECKSUM:
                                $nameDisplay.append('<em class="version">&nbsp; &lt;'+ match.version.value +'&gt;</em>');
                                break;
                            case TreeIllustrator.versionTypes.TIMESTAMP:
                                $nameDisplay.append('<em class="version">&nbsp;  as of '+ match.version.value +'</em>');
                                break;
                            case TreeIllustrator.versionTypes.SEMANTIC:
                                $nameDisplay.append('<em class="version">&nbsp; v'+ match.version.value +'</em>');
                                break;
                            default:
                                $nameDisplay.append('<em class="version">Unknown version type: '+ match.source.type +'</em>');
                        }
                    }
                    var $sourceDisplay = $matchInfo.find('.source');
                    if (match.source) {
                        // pivot based on source type
                        switch(match.source.type) {
                            case TreeIllustrator.dataSourceTypes.BUILT_IN:
                                $sourceDisplay.html('<strong>Built-in</em>');
                                break;
                            case TreeIllustrator.dataSourceTypes.URL:
                                $sourceDisplay.html('<a target="_blank" href="'+ match.source.value +'">'+ match.source.value +'</a>');
                                break;
                            default:
                                $sourceDisplay.html('<em>Unknown source type: '+ match.source.type +'</em>');
                        }
                    } else {
                        $sourceDisplay.html('<em>No source found</em>');
                    }
                    $matchInfo.find('.description').html( match.description || '<em>No description found</em>');
                    // add a unique key to determine the chosen style guide later
                    var sgKey = match.name +'|'+ (match.version ? match.version.value : "") +'|'+ (match.source ? match.source.value : "");
                    $matchInfo.append('<input type="hidden" class="match-key" value="'+ sgKey +'" />');
                    $chooser.find('.found-matches').append($matchInfo);
                });
                $chooser.off('shown').on('shown', function() {
                    // size scrolling list to fit in the current DOI-lookup popup window
                    var $chooser = $('#styleguide-chooser');
                    var resultsListHeight = $chooser.find('.modal-body').height() - $chooser.find('.before-matches').height();
                    $chooser.find('.found-matches')
                        .outerHeight(resultsListHeight)
                        .css('visibility','visible');
                });
                $chooser.find('.found-matches').css('visibility','hidden');
                $chooser.modal('show');
            }
        }
    });
}

/* General support for direct-manipulation ops (esp. to track dragging with the mouse) */
var dragHandle = null,  // the handle (HTML/SVG element) being dragged, if any
    dragHandleName = null;
    dragStartHandleLoc = null,  // replace with {x:<Number>, y:<Number>}, in screen px; reset to null when done
    dragElement = null, // the Illustration element (eg, IllustratedTree) affected, if any
    dragStartElementProps = null, // related properties of the target element (XY coords, angles, etc.)
    dragCurrentHandleDelta = null;  // cumulative change in X/Y, in screen px; same format as dragStartHandleLoc above

function startDragging( event ) {
    /* Initiate sensible dragging behavior for the current handle and target
     * element.  See *which* hotspot this is to determine correct behavior with
     * the current tree. Key decisions will persist in the vars defined above.
     */
    var $hotspot = $(this).is('path') ? $(this) : $(this).find('path');
    dragHandle = $hotspot[0];
    dragHandleName = $(this).is('.tree-hotspot') ? 'hotspot' : d3.select(this).datum().name;
    // Fetch and examine the related illustration element
    var $elementGroup = $hotspot.closest('g.mark-group[class*=tree-], g.mark-group[class*=dataset-], g.mark-group[class*=ornament-]');
    var elementID = $elementGroup.attr('class').split(/\s+/)[1];
    showAccordionPanelForElement( elementID );
    dragElement = stylist.ill.getElementByID( elementID );
    // On the first mousemove, we'll stash the element's starting properties (in illustration units)
    ///console.log(">> START DRAGGING handle ["+ dragHandleName +"]...");
    // Track locations *relative* to the viewport, so we can drag *and* scroll as needed.
    var $scrollingViewport = $("#viz-outer-frame").find('div.vega');
    dragStartHandleLoc = getIllustrationMouseLoc(event, $scrollingViewport);

    /* TEST updating handles from stored generators
    if (dragHandle) {
        if (dragHandleName === 'hotspot') {
            // update the entire hotspot shape
            console.log("hotspot d BEFORE:"+ d3.select(dragHandle).attr('d'));
            d3.select(dragHandle).attr('d', phylogramTransform.hotspotGenerator());
            console.log("hotspot d AFTER:"+ d3.select(dragHandle).attr('d'));
        } else {
            // update just the positions of all 
        }
    } else {
        console.error("No dragHandle found! How can this be?");
        debugger;
    }
     */
}

function stopDragging( callback ) {
    if (typeof(callback) === 'function') {
        //callback(dragHandle, dragElement, ... );
        callback();
    }
    dragHandle = null;
    dragHandleName = null;
    dragElement = null;
    dragStartHandleLoc = null;
    dragStartElementProps = null;
    dragCurrentHandleDelta = null;
}

$(document).ready(function() {
    $('body').on("mouseup click mouseleave", function ( event ) {
        if (dragHandle) {
            stopDragging(refreshViz);
        }
    });
    $('body').on("mousemove", function ( event ) {
        if (dragHandle) {
            /* Check target element's type and sub-type (eg, a circular tree) and
             * the active handle name. These will dictate the dragging behavior
             * and initialize dragStartElementProps if it's null or empty.
             */
            var $handle = $(dragHandle);
            var $handlesGroup = $handle.closest('g.mark-group.handles');
            // Track locations *relative* to the viewport, so we can drag *and* scroll as needed.
            var $scrollingViewport = $("#viz-outer-frame").find('div.vega');
            var mouseLoc = getIllustrationMouseLoc(event, $scrollingViewport);
            dragCurrentHandleDelta = {
                x: (mouseLoc.x - dragStartHandleLoc.x),
                y: (mouseLoc.y - dragStartHandleLoc.y)
            }

            if (dragElement instanceof TreeIllustrator.IllustratedTree) {
                // determine behavior by specific handles and (perhaps) tree layouts
                switch(dragHandleName) {
                    case 'center':
                    case 'hotspot':
                        // drag to move (translate) the entire tree on the page
                        if (!dragStartElementProps) {
                            dragStartElementProps = { x: dragElement.rootX(), y: dragElement.rootY() };
                        }
                        /* Update the element's rootX and rootY properties.
                         * N.B. this will update the visible UI, but not the viewport!
                         *
                         * For now, this is a direct translation of handle motion to element motion.
                         * TODO: Use constraints to enforce min. sizes, etc. (by tweaking its physicalRootX/Y instead?)
                         */
                        var dragElementToX = dragStartElementProps.x + dragCurrentHandleDelta.x;
                        var dragElementToY = dragStartElementProps.y + dragCurrentHandleDelta.y;
                        //var physicalX = stylist.pixelsToPhysicalUnits(dragToX, stylist.display_ppi);
                        dragElement.rootX( dragElementToX );
                        dragElement.rootY( dragElementToY );
                        // Move *all* handles, not just the main hotspot (no need to redraw or further adjust these)
                        $handlesGroup.attr('transform', "translate("+ dragCurrentHandleDelta.x +","+ dragCurrentHandleDelta.y +")");
                        break;

                    default:
                        // other handles have different behavior based on tree layout
                        switch(dragElement.layout()) {
                            case TreeIllustrator.treeLayouts.TRIANGLE:
                            case TreeIllustrator.treeLayouts.RECTANGLE:
                                /* All vertex handles scale the tree (relative to the root node)
                                 * N.B. that we pay close attention to the *current* extents in the
                                 * viewport, since the rectangular layout has a bounding box that
                                 * depends on the structure and branching patterns of each tree
                                 */
                                if (!dragStartElementProps) {
                                    dragStartElementProps = { rootX: dragElement.rootX(), rootY: dragElement.rootY(),
                                                              width: dragElement.width(), height: dragElement.height() };
                                }
                                // Reckon new width and height as a ratio vs. the original.
                                var newPartialWidth,
                                    oldPartialWidth,
                                    xScale,
                                    newPartialHeight,
                                    oldPartialHeight,
                                    yscale,
                                    newTotalWidth,
                                    newTotalHeight;
                                newPartialWidth = Math.abs(mouseLoc.x - dragStartElementProps.rootX);
                                oldPartialWidth = Math.abs(dragStartHandleLoc.x - dragStartElementProps.rootX);
                                xScale = newPartialWidth / oldPartialWidth;
                                newTotalWidth = dragStartElementProps.width * xScale;

                                // reckon proportional share of width for this handle
                                newPartialHeight = Math.abs(mouseLoc.y - dragStartElementProps.rootY);
                                oldPartialHeight = Math.abs(dragStartHandleLoc.y - dragStartElementProps.rootY);
                                yScale = newPartialHeight / oldPartialHeight;
                                newTotalHeight = dragStartElementProps.height * yScale;

                                /* TODO: Restrict to min. dimensions, OR handle crossing the origin by
                                 *      - if they swap the two vertex handles, they should switch proportions
                                 *      - if they pass the root node, "flip" the tree's tipsAlignment
                                 *
                                console.warn(">>> tips on the "+ dragElement.tipsAlignment());
                                switch(dragElement.tipsAlignment) {
                                    case 'TOP':
                                        break;
                                    case 'RIGHT':
                                        break;
                                    case 'BOTTOM':
                                        break;
                                    case 'LEFT':
                                        break;
                                }
                                */

                                // Update the tree, subject to any constraints
                                dragElement.constrainedWidth( newTotalWidth );
                                dragElement.constrainedHeight( newTotalHeight );
                                // Were the new values accepted? (Allow for minor slippage here.)
                                var inBounds = (Math.abs(dragElement.width() - newTotalWidth) < 2) &&
                                               (Math.abs(dragElement.height() - newTotalHeight) < 2);

                                // Scales used for the hotspot should reflect any active constraints
                                var constrainedXScale = dragElement.width() / dragStartElementProps.width;
                                var constrainedYScale = dragElement.height() / dragStartElementProps.height;

                                /* Update hotspot and handle positions */
                                // Scale the main hotspot to match the ratios of old vs. new...
                                var $hotspot = $handlesGroup.find('.tree-hotspot path');
                                $hotspot.attr('transform', "scale("+ constrainedXScale +","+ constrainedYScale +")");
                                // ... hide its border (beause scaling stroke-width is ugly)
                                $hotspot.css('stroke-opacity', '0');
                                if (inBounds) {
                                    $hotspot.removeAttr('class');
                                } else {
                                    $hotspot.attr('class', 'out-of-bounds');
                                }

                                // ... and move the vertex handles to match ("push" from origin) by 
                                // modifying the datum for each, then *carefully* updating its transforms.
                                var $vertexHandles = $handlesGroup.find('.vertex-handle path');
                                if (inBounds) {
                                    $vertexHandles.removeAttr('class');
                                } else {
                                    $vertexHandles.attr('class', 'out-of-bounds');
                                }
                                $vertexHandles.each(function(i, path) {
                                    var d3el = d3.select(path);
                                    var itsDatum = d3el.datum().datum;
                                    if (!('old_x' in itsDatum)) {
                                        // stash original value (once only)
                                        itsDatum.old_x = itsDatum.x || 0;
                                        itsDatum.old_y = itsDatum.y || 0;
                                    }
                                    itsDatum.x = itsDatum.old_x * constrainedXScale;
                                    itsDatum.y = itsDatum.old_y * constrainedYScale;
                                });
                                resetActualSizeElements();

                                break;

                            case TreeIllustrator.treeLayouts.CIRCLE:
                                // Track the same properties for all remaining handles
                                if (!dragStartElementProps) {
                                    dragStartElementProps = { rootX: dragElement.rootX(), rootY: dragElement.rootY(), 
                                                              radius: dragElement.radius(),
                                                              startAngle: dragElement.startAngle(), endAngle: dragElement.endAngle() };
                                }
                                // Track original and new radius
                                /* Ignore dragCurrentHandleDelta; just reckon current mouseLoc in viewport
                                 * (illustration) coordinates and measure the distance from the root node.
                                 */
                                var xDistance = mouseLoc.x - dragStartElementProps.rootX;
                                var yDistance = mouseLoc.y - dragStartElementProps.rootY;
                                var hypotenuse = Math.sqrt( Math.pow(xDistance, 2) + Math.pow(yDistance, 2) );
                                dragElement.constrainedRadius( hypotenuse );

                                switch(dragHandleName) {
                                    case 'radius':
                                        /* Update hotspot and handle positions */
                                        // Scale the main hotspot to match the ratio of old vs. new...
                                        var oldRadius = dragStartElementProps.radius,
                                            pendingRadius = dragElement.radius(),  // reflect active constraints!
                                            sizeChangeRatio = pendingRadius / oldRadius;
                                        var $hotspot = $handlesGroup.find('.tree-hotspot path');
                                        var inBounds = (pendingRadius === hypotenuse);
                                        if (inBounds) {
                                            $hotspot.removeAttr('class');
                                        } else {
                                            $hotspot.attr('class', 'out-of-bounds');
                                        }
                                        $hotspot.attr('transform', "scale("+ sizeChangeRatio +")");
                                        // ... hide its border (beause scaling stroke-width is ugly)
                                        $hotspot.css('stroke-opacity', '0');
                                        // ... and move the vertex handles to match ("push" from origin) by 
                                        // modifying the datum for each, then *carefully* updating its transforms.
                                        var $vertexHandles = $handlesGroup.find('.vertex-handle path');
                                        if (inBounds) {
                                            $vertexHandles.removeAttr('class');
                                        } else {
                                            $vertexHandles.attr('class', 'out-of-bounds');
                                        }
                                        $vertexHandles.each(function(i, path) {
                                            var d3el = d3.select(path);
                                            var itsDatum = d3el.datum().datum;
                                            if (!('old_x' in itsDatum)) {
                                                // stash original value (once only)
                                                itsDatum.old_x = itsDatum.x || 0;
                                                itsDatum.old_y = itsDatum.y || 0;
                                            }
                                            itsDatum.x = itsDatum.old_x * sizeChangeRatio;
                                            itsDatum.y = itsDatum.old_y * sizeChangeRatio;
                                        });
                                        resetActualSizeElements();

                                        break;

                                    case 'start-angle':
                                    case 'end-angle':
                                        // These should change radius *and* arc angles
                                        var handleInfo = d3.select(dragHandle).datum().datum; // includes .angle, .theta, etc
                                        ///console.log(handleInfo);
                                        var newAngleInRadians = Math.atan2( yDistance, xDistance );
                                        // convert from radians to degrees and force to range from 0-360
                                        var newAngleInDegrees = utils.normalizeDegrees( utils.radiansToDegrees( newAngleInRadians ) );
                                        dragElement[ dragHandleName === 'start-angle' ? 'startAngle' : 'endAngle' ]( newAngleInDegrees );

                                        /* Update hotspot and handle positions */
                                        var isClockwise = (dragElement.radialSweep() === TreeIllustrator.sweepDirections.CLOCKWISE),
                                            pendingRadius = dragElement.radius(),  // reflect active constraints!
                                            pendingStartAngle = dragElement.startAngle(),
                                            pendingEndAngle = dragElement.endAngle(),
                                            totalArcDegrees = isClockwise ?
                                                utils.normalizeDegrees(pendingEndAngle - pendingStartAngle) :
                                                utils.normalizeDegrees(pendingStartAngle - pendingEndAngle),
                                            usingLargeArc = (totalArcDegrees >= 180),
                                            pendingStartAngleVertex = {
                                                // Reckon this from the angle and radius (hypotenuse)
                                                x: pendingRadius * Math.cos( utils.degreesToRadians(pendingStartAngle) ), // Fx = F cos(a)
                                                y: pendingRadius * Math.sin( utils.degreesToRadians(pendingStartAngle) )  // Fy = F sin(a)
                                            },
                                            pendingEndAngleVertex = {
                                                x: pendingRadius * Math.cos( utils.degreesToRadians(pendingEndAngle) ),
                                                y: pendingRadius * Math.sin( utils.degreesToRadians(pendingEndAngle) )
                                            },
                                            midArcAngle = isClockwise ?
                                                utils.normalizeDegrees(pendingStartAngle + (totalArcDegrees/2)) :
                                                utils.normalizeDegrees(pendingStartAngle - (totalArcDegrees/2)),
                                            pendingRadiusControlVertex = {
                                                x: pendingRadius * Math.cos( utils.degreesToRadians(midArcAngle) ),
                                                y: pendingRadius * Math.sin( utils.degreesToRadians(midArcAngle) )
                                            };
                                        var $hotspot = $handlesGroup.find('.tree-hotspot path');
                                        var newAngle = dragElement[ dragHandleName === 'start-angle' ? 'startAngle' : 'endAngle' ]();
                                        var inBounds = (pendingRadius === hypotenuse) &&
                                                       (newAngle === newAngleInDegrees);
                                        if (inBounds) {
                                            $hotspot.removeAttr('class');
                                        } else {
                                            $hotspot.attr('class', 'out-of-bounds');
                                        }

                                        $hotspot.attr('d', generateRadialHotspotPath(
                                            usingLargeArc,
                                            isClockwise,
                                            pendingRadius,
                                            pendingStartAngleVertex,
                                            pendingEndAngleVertex
                                        ));
                                        // ... hide its border (beause scaling stroke-width is ugly)
                                        $hotspot.css('stroke-opacity', '0');
                                        // ... and move the vertex handles to match ("push" from origin) by
                                        // modifying the datum for each, then *carefully* updating its transforms.
                                        var $vertexHandles = $handlesGroup.find('.vertex-handle path');
                                        if (inBounds) {
                                            $vertexHandles.removeAttr('class');
                                        } else {
                                            $vertexHandles.attr('class', 'out-of-bounds');
                                        }
                                        $vertexHandles.each(function(i, path) {
                                            var d3el = d3.select(path);
                                            var itsDatum = d3el.datum().datum;
                                            switch( itsDatum.name ) {
                                                case 'center':
                                                    // this never moves
                                                    break;
                                                case 'start-angle':
                                                    itsDatum.x = pendingStartAngleVertex.x;
                                                    itsDatum.y = pendingStartAngleVertex.y;
                                                    break;
                                                case 'end-angle':
                                                    itsDatum.x = pendingEndAngleVertex.x;
                                                    itsDatum.y = pendingEndAngleVertex.y;
                                                    break;
                                                case 'radius':
                                                    itsDatum.x = pendingRadiusControlVertex.x;
                                                    itsDatum.y = pendingRadiusControlVertex.y;
                                                    break;
                                            }
                                        });
                                        resetActualSizeElements();
                                        break;

                                    default:
                                        console.error('Unknown drag handle ['+ dragHandleName +']');
                                        return;
                                }
                                break;
                        }
                }
            /*
            ... else if (dragElement instanceof TreeIllustrator.SupportingDataset) {
                // TODO
            } else if (dragElement instanceof TreeIllustrator.Ornament) {
                // TODO
            */
            } else {
                console.error("drag logic: unexpected element type: '"+ dragElement.metadata.type() +"'!");
                return;
            }

        }
    });
});

function generateRadialHotspotPath( largeArc, sweepValue, radius, startPoint, endPoint ) {
    /* Return a path that sweeps an arc around origin 0,0
     *  EXAMPLE: "M0,0 L36.79,231.24 A234.14,234.14 0 0,1 -209.42,104.73 Z"
     * ASSUMES that angles are in radians!
     * Adapted from `vg.data.phylogram.js`, see also:
     *  https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths#Arcs
     *  http://www.w3.org/TR/SVG/paths.html#PathDataEllipticalArcCommands
     */
    var rotation = 0,  // this is moot for a circle
        //clockwise = Math.abs(midAngle - srcAngle) > Math.PI ? midAngle <= srcAngle : midAngle > srcAngle,
        largeArc = Number(largeArc),
        sweepValue = Number(sweepValue);
    var path = "M0,0" +
      " L"+ [startPoint.x,startPoint.y] +
      " A" + [radius,radius] +' '+ rotation +' '+ largeArc +','+ sweepValue +' '+ [endPoint.x,endPoint.y] +
      " Z";
    return path;
}

function getViewportMouseLoc(event, $scrollingViewport) {
    // Reckon mouse position as display px, relative to the SVG viewport
    var vpOffset = $scrollingViewport.offset();
    return {
        x: (event.pageX - vpOffset.left + $scrollingViewport.scrollLeft()),
        y: (event.pageY - vpOffset.top + $scrollingViewport.scrollTop())
    };
}
function getIllustrationMouseLoc(event, $scrollingViewport) {
    /* Reckon mouse position in the illustration's SVG coordinates.
     * N.B. that d3 provides an easy method for this, but it can't be called
     * except within a (d3) event handler on the SVG element itself.
     *   https://github.com/mbostock/d3/blob/master/src/event/mouse.js
     *   http://stackoverflow.com/a/27434285
     * FAILS HERE: console.error( d3.mouse(d3.select('div.vega > svg')) );
     */
    /* This code invokes the d3 location test, but can't return a value directly.
       To see it in action, uncomment both blocks marked D3_MOUSE_SENSING
    var evt = document.createEvent ("MouseEvent");
    evt.initMouseEvent("mousetest", true, true, window, 0,
                       event.screenX, event.screenY, event.clientX, event.clientY,
                       event.ctrlKey, event.altKey, event.shiftKey, event.metaKey,
                       0, null);
    $('div.vega > svg')[0].dispatchEvent(evt);
    */

    var viewportLoc = getViewportMouseLoc(event, $scrollingViewport);
    // Reverse the current magnification and allow for padded viewport
    return {
        x: (viewportLoc.x / viewportMagnification) + viewbox.x,
        y: (viewportLoc.y / viewportMagnification) + viewbox.y
    };
}

/* The current Vega spec is generated using the chosen style (above) and 
 * the illustration source and decisions made in the web UI. When the
 * illustration is saved, the latest can also be embedded. Or perhaps we should
 * always generate it fresh from the source data and scene graph whenn
 * (re)loading the illustration?
 */
var vegaSpec;
var view; // a Vega ViewComponent (use to set signals, updates, etc.)
function refreshViz(options) {
    var startTime = new Date();
    console.warn('refreshViz() STARTING');
    if (!options) options = {}; 

    ill.updateVegaSpec();  // TODO: trigger updates on a more sensible basis

    vg.parse.spec(ill.vegaSpec, function(chart) {
        view = chart({el:"#viz-outer-frame", renderer:"svg"});
        // export the new view
        exports.view = view;
        view.update();

        if (options.SHOW_ALL) {
            resizeViewportToShowAll();
        } else {
            initTreeIllustratorWindow();
        }

        /* (Re)bind event handlers for element hotspots */
        // N.B. jQuery event delegation doesn't seem to work with SVG elements!
        var $scrollingViewport = $("#viz-outer-frame").find('div.vega');
        //$scrollingViewport.delegate(".tree-hotspot", "click hover mouseover mouseout mouseenter mouseleave", function ...
        $scrollingViewport.find('g.handles')
            .off('.hotspot')  // remove any prior bindings
            .on("mouseenter.hotspot", function ( event ) {
                if (!dragElement) {
                    var el = getIllustrationElementFromHandle(this);
                    showElementHandles(el);
                }
            })
            .on("mouseleave.hotspot", function ( event ) {
                var el = getIllustrationElementFromHandle(this);
                if (dragElement !== el) {
                    hideElementHandles(el);
                }
            });

        // We can't add proper IDs for vertex handles, but startDragging will adapt
        var allHandles = $scrollingViewport.find('.tree-hotspot, .handles .vertex-handle path')
            .css('cursor','move')
            .off('.hotspot')  // remove any prior bindings
            //.on("mouseenter.hotspot mouseleave.hotspot mousedown.hotspot mouseup.hotspot click.hotspot mousemove.hotspot", function ( event ) {
            .on("mousedown.hotspot", startDragging);

        // Add SVG 'title' elements to provide tool-tips for all hotspots
        $.each(allHandles, function(i, h) {
            // extract and display its description as a tooltip
            var $handle = $(this);
            var d3handle = d3.select(this);
            var tooltip = "TODO: Add a tooltip for this handle!";
            if (d3handle.datum()) {
                tooltip = d3handle.datum().tooltip;
            } else {
                // Some handles (esp. hotspots) don't have data
                if ($handle.is('.tree-hotspot')) {
                    tooltip = "Drag to move this tree on the page.";
                }
            }
            d3handle.append("svg:title")
                    .text(tooltip);
        });

    /* This code activates a d3 location test in response to a custom event,
     * but it can't return a value directly. To see this in action, uncomment
     * both blocks marked D3_MOUSE_SENSING
        d3.select('div.vega > svg').on('mousetest', function () {
            console.warn( d3.mouse(this) );
        });
     */

    });
    console.warn("refreshViz() took "+ (new Date() - startTime) +" ms to complete");
}
function getIllustrationElementFromHandle( handle ) {
    // Should this use assigned datum instead?
    var $elementGroup = $(handle).closest('g.mark-group[class*=tree-], g.mark-group[class*=dataset-], g.mark-group[class*=ornament-]');
    var elementID = $elementGroup.attr('class').split(/\s+/)[1];
    // ASSUMES a predictable class attribute, e.g. 'group-marks tree-3'
    return stylist.ill.getElementByID( elementID );
}
function getElementHandlesGroup( illElement ) {
    // Find the SVG group holding all handles for a given IllustratedTree/etc.
    var $elementGroup = $('div.vega svg g.illustration-elements g.mark-group[class*='+ illElement.id() +']');
    var $handlesGroup = $elementGroup.find('g.mark-group.handles');
    return $handlesGroup;
}
function showElementHandles( illElement ) {
    // Show all handles for a given IllustratedTree/etc.
    var $handlesGroup = getElementHandlesGroup( illElement );
    var $hotspot = $handlesGroup.find('.tree-hotspot path');
    $hotspot.css({
        'fillOpacity': "0.2",
        'strokeOpacity': "0.6"
    });
    var $handles = $handlesGroup.find('.vertex-handle path');
    $handles.css({
        'fillOpacity': "1.0",
    });
}
function hideElementHandles( illElement ) {
    // Hide all handles for a given IllustratedTree/etc.
    var $handlesGroup = getElementHandlesGroup( illElement );
    var $hotspot = $handlesGroup.find('.tree-hotspot path');
    $hotspot.css({
        'fillOpacity': "0",
        'strokeOpacity': "0"
    });
    var $handles = $handlesGroup.find('.vertex-handle path');
    $handles.css({
        'fillOpacity': "0",
    });
}


var ill;  

// Keep safe copy of list-containing markup for re-use as a Knockout template (see below)
var $stashedEditArea = null;

// Load an illustration from JS/JSON data (usu. called by convenience functions below)
function loadIllustrationData( data, initialCache, newOrExisting ) {
    // Use an Illustration object as our primary view model for KnockoutJS
    // (by convention, it's usually named 'viewModel')
    ill = new TreeIllustrator.Illustration( data );
    // export the new illustration
    exports.ill = ill;

    // Clear any existing cached data from the illustration rendering pipeline;
    // use initial data if provided by the caller.
    if (typeof initialCache === 'object') {
        TreeIllustrator.flushCache( initialCache );
    } else {
        TreeIllustrator.flushCache( );
    }

    /* TODO: handle the newOrExisting storage info? or maybe this is
     * handled by the storage backend...
     */

    // add a single placeholder tree
    if (!data) {
        ill.addIllustratedTree();
    }

    if ($stashedEditArea === null) {
        // Stash the pristine markup before binding this popup for the first time
        $stashedEditArea = $('#ti-main-accordion').clone();
        /*
        $stashedCollectionDecisionElement = $('#tree-collection-viewer')
            .find('#tree-collection-decisions > tr.single-tree-row').eq(0).clone();
        */
    } else {
        // Replace with pristine markup to avoid weird results when loading a new illustration
        $('#ti-main-accordion').contents().replaceWith(
            $stashedEditArea.clone().contents()
        );
    }

    // (re)bind to editor UI with Knockout
    var $boundElements = $('#editor'); // add other elements?
    $.each($boundElements, function(i, el) {
        ko.cleanNode(el);
        ko.applyBindings(ill,el);
    });

    refreshViz( {SHOW_ALL: true} );
}
function loadEmptyIllustration() {
    /* Load an empty illustration with a placeholder tree, with
     * no ID or slot assigned (i.e., treat this as a new illustration).
     *
     * TODO: Replace this with a simple template?
     */
    loadIllustrationData( null, {}, 'NEW' );
    clearLastSavedInfo();
}
// N.B. There should be additional convenience functions in the storage backend
//  - fetchAndLoadExistingIllustration( docID )
//  - fetchAndLoadIllustrationTemplate( templateID )

function fetchAndLoadExistingIllustration( backend, docID ) {
    /* Load the JS (or JSON?) data provided, and keep track of its original ID/slot.
     */
    storage[ backend ].loadIllustration(docID, function(response) {
        if ('data' in response) {
            var data = response.data;
            loadIllustrationData( data, {}, 'EXISTING' );
            // update last-saved info
            updateLastSavedInfo(backend, docID);
        } else {
            console.error(response.error || "No data returned (unspecified error)!");
        }
    });
}
function fetchAndLoadIllustrationTemplate( backend, templateID ) {
    /* Load the JS (or JSON) data provided, but treat this as a new illustration.
     *
     * N.B. A template is basically an existing illustration document, with
     * internal prompts and placeholder trees/data, but we'll treat it as new.
     */
    // TODO: fetch using storage backend
    storage[ backend ].loadIllustration(docID, function(response) {
        if ('data' in response) {
            var template = response.data;
            loadIllustrationData( template, {}, 'NEW' );
            clearLastSavedInfo();  // so we don't overwrite the template!
        } else {
            console.error(response.error || "No data returned (unspecified error)!");
        }
    });
}

$(document).ready(function() {
    // test for the preset ppi (pixels / inch) in this browser
    browser_ppi = $('#svg-toolbox').width() / 10.0;
    // NOTE that this is still unlikely to match the physical size of any particular monitor!
    // If that's important, we might want to let the user tweak this value.
    $('#browser-ppi-indicator').text(browser_ppi);
    $('#display-ppi-indicator').text(display_ppi);

    // show or disable the full-screen widgets
    var $fullScreenToggle = $('button#enter-full-screen');
    if ($.fullscreen.isNativelySupported()) {
        // ie, the current browser supports full-screen APIs
        $fullScreenToggle.show();
        $(document).bind('fscreenchange', function(e, state, elem) {
            // if we currently in fullscreen mode
            if ($.fullscreen.isFullScreen()) {
                $('#enter-full-screen').hide();
                $('#exit-full-screen').show();
            } else {
                $('#enter-full-screen').show();
                $('#exit-full-screen').hide();
            }
        });
    } else {
        // dim and disable the full-screen toggle
        $fullScreenToggle.css("opacity", "0.5")
                         .click(function() {
                            alert("This browser does not support full-screen display.");
                            return false;
                         })
                         .show();
    }

    // TODO: Add "safety net" if there are unsaved changes
    // TODO: Add JSON support for older IE?

    // Update the list with initial values
    updateAvailableTrees();

    // Has my opener provided an initial illustration or template? If so, load it now
    var startingID = getParameterByName('startingID');
    console.log(">> startingID: "+ startingID +" <"+ typeof(startingID) +">");
    var startingType = getParameterByName('startingType');
    console.log(">> startingType: "+ startingType +" <"+ typeof(startingType) +">");
    // N.B. This should be a string, so '0' is a valid slot identifier!
    if (startingID) {
        // Which storage backend should we use? Depends on the host app
        var backend;
        switch (hostApplication) {
            case (TreeIllustrator.hostApplications.JUPYTER_NOTEBOOK):
                // ASSUME we're being passed a storage slot number
                backend = TreeIllustrator.storageBackends.JUPYTER_NOTEBOOK;
                break;
            case (TreeIllustrator.hostApplications.STANDALONE):
                // ASSUME we're being passed a phylesystem id (stored on GitHub)
                backend = TreeIllustrator.storageBackends.GITHUB_REPO;
                break;
            default:
                console.error("Unexpected hostApplication found ('"+ hostApplication +"')!");
                return;
        }

        switch (startingType) {
            case 'ILLUSTRATION':
                fetchAndLoadExistingIllustration( backend, startingID );
                break;
            case 'TEMPLATE':
                fetchAndLoadIllustrationTemplate( backend, startingID );
                break;
            default:
                console.error("No startingType provided (expected 'ILLUSTRATION' or 'TEMPLATE')!");
                return;
        }
    } else {
        loadEmptyIllustration();
    }

    matchViewportToWindowSize();

    // enable hiding/showing the "sidecar" UI
    $('.sidecar-toggle')  // ie, the splitter and all pull tabs
        // change color (of *all* toggling elements) on mouseover
        .unbind('hover').hover(function() {
            $('.sidecar-toggle').addClass('hovering');
        }, function() {
            $('.sidecar-toggle').removeClass('hovering');
        })
        // hide/show (based on current position)
        .unbind('click').click(function(e) {
            e.stopPropagation();  // don't trigger my parent elements!
            var currentlyVisible = $('#sidecar').css('right') === '0px';
            var hiddenX = -( $('#sidecar').width() );
            var visibleX = 0;
            if (currentlyVisible) {
                $('#sidecar').css('right', hiddenX);
                $('#sidecar-pulltab a').removeClass('icon-chevron-right')
                                       .addClass('icon-chevron-left');
            } else {
                $('#sidecar').css('right', visibleX);
                $('#sidecar-pulltab a').removeClass('icon-chevron-left')
                                       .addClass('icon-chevron-right');
            }
            matchViewportToWindowSize();
            zoomViewport('REFRESH');
        });

    // resizing the window should refresh/resize the viewport
    $(window).resize(function() {
        try {
            matchViewportToWindowSize();
            zoomViewport('REFRESH');
        } catch(e) {
            console.warn("Unable to complete resize:");
            console.warn(e);
        }
    });
});

function buildStudyFetchURL( studyID ) {
    // ASSUMES we're using the phylesystem API to load studies from the OpenTree dev site
    var template = "https://api.opentreeoflife.org/phylesystem/v1/study/{STUDY_ID}?output_nexml2json=1.0.0&auth_token=ANONYMOUS"
    return template.replace('{STUDY_ID}', studyID);
}

/*
function useChosenStyle() {
    viewModel.style = getChosenStyle();
    refreshViz();
}
function getChosenStyle() {
    var styleName = $('#style-chooser').val();
    return getStyleByName( styleName );
}
function getStyleByName( styleName ) {
    var selectedStyles = $.grep(availableStyles, function(o) {return o.name === styleName;});
    var styleInfo = null;
    if (selectedStyles.length > 0) {
        styleInfo = selectedStyles[0];
    }
    if (!styleName || !styleInfo) {
        console.warn("No style found under '"+ styleName +"'!");
        return null;
    }
    return styleInfo.style;
}
*/

function toggleFixedRulers(toggle) {
    var rulersAreHidden = $('#viz-outer-frame').hasClass('hide-rulers');
    var $toggleBtn = $(toggle);
    if (rulersAreHidden) {
        // show them now
        $('#viz-outer-frame').removeClass('hide-rulers');
        $toggleBtn.text('Hide rulers');
    } else {
        // hide them now
        $('#viz-outer-frame').addClass('hide-rulers');
        $toggleBtn.text('Show rulers');
    }
    updateViewportViewbox();
    zoomViewport('REFRESH');
}

function initTreeIllustratorWindow() {
    var $outerFrame = $("#viz-outer-frame");
    var $scrollingViewport = $outerFrame.find('div.vega');
    var $rulerUnitsDisplay = $outerFrame.find('#fixed-ruler-units');
    var $topRuler = $outerFrame.find('#fixed-ruler-top');
    var $leftRuler = $outerFrame.find('#fixed-ruler-left');
    var viewportElement = $scrollingViewport[0];
    //var scrollbarWidth = .offsetWidth - viewportElement.clientWidth;
    var topRulerAdjustedWidth = viewportElement ? viewportElement.clientWidth : $topRuler.width();
    var leftRulerAdjustedHeight = viewportElement ? viewportElement.clientHeight : $topRuler.height();

    $rulerUnitsDisplay.css({
        'width': rulerWidth +"px",
        'height': rulerWidth +"px",
        'line-height': rulerWidth +"px",
        'font-size': Math.floor(rulerWidth / 2.5) +"px"
    });
    $topRuler.css({
        'height': rulerWidth+"px",
        // adjust width since there's no scrollbar here
        'width': topRulerAdjustedWidth +'px',
        'margin-right': -rulerWidth+"px"
    });
    $leftRuler.css({
        'width': rulerWidth+"px",
        // adjust height since there's no scrollbar here
        'height': leftRulerAdjustedHeight +'px',
        'margin-bottom': -rulerWidth+"px"
    });
    $scrollingViewport.css('margin-right', -(rulerWidth+1)+"px");

    // reset units display; clear old rulers
    $rulerUnitsDisplay.text( ill.style.printSize.units() === TreeIllustrator.units.INCHES ? "in" : "cm" );

    // adjust viewport/viewbox to reflect current magnification (display_ppi)
    updateViewportViewbox( $scrollingViewport );

    resetActualSizeElements();

    // sync scrolling of rulers to viewport
    //TODO: delegate these for one-time call!
    $scrollingViewport.off('scroll').on('scroll', function() {
        $topRuler.scrollLeft($scrollingViewport.scrollLeft());
        $leftRuler.scrollTop($scrollingViewport.scrollTop());
    });

    // sync resizing of rulers to viewport
    // (no event for this except on the window, it's an on-demand thing)
    var viewportWidth = $scrollingViewport[0].scrollWidth;
    var viewportHeight = $scrollingViewport[0].scrollHeight;
    var topRulerScale = d3.scale.linear()
        .domain([
            pixelsToPhysicalUnits(viewbox.x, internal_ppi),
            pixelsToPhysicalUnits(viewbox.x + viewbox.width, internal_ppi)
        ])
        .range([
            0,
            viewportWidth
        ]);
    var topRuler = d3.select("#fixed-ruler-top svg")
        .attr("width", viewportWidth+"px")
        .attr("height", rulerWidth+"px");
    drawRuler(topRuler, 'HORIZONTAL', ill.style.printSize.units(), topRulerScale);

    var leftRulerScale = d3.scale.linear()
        .domain([
            pixelsToPhysicalUnits(viewbox.y, internal_ppi),
            pixelsToPhysicalUnits(viewbox.y + viewbox.height, internal_ppi)
        ])
        .range([
            0,
            viewportHeight
        ]);
    var leftRuler = d3.select("#fixed-ruler-left svg")
        .attr("width", rulerWidth+"px")
        .attr("height", viewportHeight+"px");
    drawRuler(leftRuler, 'VERTICAL', ill.style.printSize.units(), leftRulerScale);

    enableViewportMask();
}

function resetActualSizeElements() {
    /* Resize any actual-sizes elements (e.g. manipulation handles) in the viewport.
     * N.B. We do this by inverting the current viewport magnification. Sneaky!
     */
    var actualSizeElements = d3.selectAll('#viz-outer-frame .actual-size path');
    actualSizeElements.attr("transform", function(d) {
        // We use the datum from phylogram model, e.g. vertexHandles[0]
        return "translate("+ (d.datum.x || 0) +","+ (d.datum.y || 0) +") scale("+ (1 / viewportMagnification) +")";
    });
}

function roundToNearest( interval, input ) {
    // round to something more interesting than "any integer"
    // EXAMPLE: roundToNearest( 0.125, -0.52 ) ==>  -0.5
    // EXAMPLE: roundToNearest( 7, 46 ) ==>  49
    return Math.round(input / interval) * interval;
}

function drawRuler( svgParent, orientation, units, scale ) {
    /* Draw a ruler in the chosen context (assumes SVG or child of an SVG), with
        - appropriate units
        - sensible/legible subticks (eg, millimeters or sixteenths of an inch) 
        - size and adjust based on orientation (HORIZONTAL | VERTICAL)
     */
    // clear any prior ruler group
    svgParent.selectAll('*').remove();
    var nudgeTop = orientation === 'VERTICAL' ? 0 : rulerWidth - 1;
    var nudgeLeft = orientation === 'VERTICAL' ? rulerWidth - 1 : 0;

    var rulerAxis = d3.svg.axis()
        .scale(scale)
        .tickValues(d3.range(
            roundToNearest(1.0, scale.domain()[0]), 
            roundToNearest(1.0, scale.domain()[1] + 1), 
            1))
        .tickFormat(d3.format('d'))  // whole numbers
        .orient( orientation === 'VERTICAL' ? 'left' : 'top' );

    svgParent
        .append("g")
        .attr("class",'outer-axis')
        .attr("transform", "translate("+ nudgeLeft +", "+ nudgeTop +")")
        .call(rulerAxis);

    if (units === 'INCHES') {
        // trying subticks, using additional axes on the same scale
        var inchWidth = inchesToPixels(1, display_ppi);
        subticksAxis = d3.svg.axis()
            .scale(scale)
            .tickValues(d3.range(
                roundToNearest(0.5, scale.domain()[0]), 
                roundToNearest(0.5, scale.domain()[1]), 
                0.5))
            .tickFormat('') // unlabeled
            .tickSize(6)
            .orient( orientation === 'VERTICAL' ? 'left' : 'top' );
        svgParent
            .append("g")
            .attr("class",'outer-axis')
            .attr("transform", "translate("+ nudgeLeft +", "+ nudgeTop +")")
            .call(subticksAxis);

        subticksAxis = d3.svg.axis()
            .scale(scale)
            .tickValues(d3.range(
                roundToNearest(0.25, scale.domain()[0]), 
                roundToNearest(0.25, scale.domain()[1]), 
                0.25))
            .tickFormat('') // unlabeled
            .tickSize(4)
            .orient( orientation === 'VERTICAL' ? 'left' : 'top' );
        svgParent
            .append("g")
            .attr("class",'outer-axis subticks')
            .attr("transform", "translate("+ nudgeLeft +", "+ nudgeTop +")")
            .call(subticksAxis);

        if (inchWidth > 20) {
            subticksAxis = d3.svg.axis()
                .scale(scale)
                .tickValues(d3.range(
                    roundToNearest(0.125, scale.domain()[0]), 
                    roundToNearest(0.125, scale.domain()[1]), 
                    0.125))
                .tickFormat('') // unlabeled
                .tickSize(2)
                .orient( orientation === 'VERTICAL' ? 'left' : 'top' );
            svgParent
                .append("g")
                .attr("class",'outer-axis subticks')
                .attr("transform", "translate("+ nudgeLeft +", "+ nudgeTop +")")
                .call(subticksAxis);
        }
    } else {
        // draw ticks for millimeters
        var cmWidth = centimetersToPixels(1, display_ppi);
        if (cmWidth > 30) {
            subticksAxis = d3.svg.axis()
                .scale(scale)
                .tickValues(d3.range(
                    roundToNearest(0.1, scale.domain()[0]), 
                    roundToNearest(0.1, scale.domain()[1]), 
                    0.1))
                .tickFormat('') // unlabeled
                .tickSize(3)
                .orient( orientation === 'VERTICAL' ? 'left' : 'top' );
            svgParent
                .append("g")
                .attr("class",'outer-axis subticks')
                .attr("transform", "translate("+ nudgeLeft +", "+ nudgeTop +")")
                .call(subticksAxis);
        }
    }
}

var topBarHeight;
function matchViewportToWindowSize() {
    if (!topBarHeight) {
        topBarHeight = $('#top-bar').height();
        // freeze the control bar at its current height        
        $('#top-bar').height(topBarHeight);
    }
    var columnHeight = $('#sticky-viewer-frame').height();
    var availableHeight = columnHeight - topBarHeight;
    var $outerFrame = $("#viz-outer-frame");
    var nudge = -36;  // allow for scrollbars, etc.
    $outerFrame.height(availableHeight + nudge);

    // adjust width based on position of sidecar
    var availableWidth = $('#sidecar').offset().left;
    nudge = -28;  // allow for scrollbars, etc.
    $outerFrame.width(availableWidth + nudge);
}

var viewportMagnification = 1.0;
function zoomViewport( directionOrZoomLevel ) {
    // let's use simple, proportional steps up and down
    var stepUp = 1.25;
    var stepDown = 0.8;  // should be inverse of stepUp
    var previousMagnification = viewportMagnification;

    switch(directionOrZoomLevel) {
        case 'REFRESH':
            // just update at the current magnification (e.g. when window is resized)
            break;
        case 'IN':
            viewportMagnification *= stepUp;
            break;
        case 'OUT':
            viewportMagnification *= stepDown;
            break;
        default: 
            // assume it's an explicit zoom level, where 1.0 means "actual size"
            viewportMagnification = directionOrZoomLevel;
            break;
    }
    display_ppi = internal_ppi * viewportMagnification;
    $('#display-ppi-indicator').text(display_ppi);

    // TODO: reset center point of viewbox? based on click XY, or current center?
    // TODO: update scrollTop, scrollLeft to stay in place?

    initTreeIllustratorWindow();
}

/* Manage handles (embed/remove SVG) for direct manipulation of trees, etc.
 * CURRENTLY UNUSED! in favor of "inline" handles for each element.
 */
function addElementHandles() {
    // CURRENTLY UNUSED
    var viewportSVG = d3.selectAll("#viz-outer-frame div.vega svg");
    if (viewportSVG.empty()) {
        console.warn("addElementHandles(): viewport SVG not found!");
        return null;
    }
    if (viewportSVG.selectAll("#handles").empty()) {
        // create a linked instance of handles
        viewportSVG.insert('use', 'svg > g')
                .attr('id', 'handles')
                .attr('xlink:href', '#manipulation-handles');
    }
    // TODO: clear and (re)build handles for all active elements?
}
function removeElementHandles() {
    // CURRENTLY UNUSED
    var viewportSVG = d3.selectAll("#viz-outer-frame div.vega svg");
    viewportSVG.selectAll("#handles").remove();
}

/* Convert between internal viewport coordinates and handle overlay (a second
 * SVG with UI for direct manipulation of trees, etc.)
 */
function internalUnitsToOverlayPixels( coords ) {
    console.log("display_ppi: "+ display_ppi);
    assert((('x' in coords) && ('y' in coords)),
           "Incoming object should include 'x' and 'y' properties.");
    return {
        x: coords.x * display_ppi,
        y: coords.y * display_ppi 
    };
}
function overlayPixelsToInternalUnits(coords) {
    console.log("display_ppi: "+ display_ppi);
    assert((('x' in coords) && ('y' in coords)),
           "Incoming object should include 'x' and 'y' properties.");
    return {
        x: coords.x / display_ppi,
        y: coords.y / display_ppi 
    };
}

function resizeViewportToShowAll() {
    // show full illustration bounds (and all SVG elements!) in the viewport
    var bbox = getInclusiveIllustrationBoundingBox();

    // match the viewport's proportions (width/height)
    var $viewport = $("#viz-outer-frame div.vega");
    // NOTE that we want to match its *inner* size, not incl. scrollbars!
    var divWidth = $viewport[0].clientWidth;
    var divHeight = $viewport[0].clientHeight;
    // compare its proportions to our bounding box; pad as needed to match
    // TODO: this is duplicate code! refactor to DRY
    var divProportions = divWidth / divHeight;
    var bboxProportions = bbox.width / bbox.height;
    if (divProportions > bboxProportions) {
        // div is wider, pad bbox width to match
        var adjustedWidth = divProportions * bbox.height;
        var extraWidth = adjustedWidth - bbox.width;
        bbox.width = adjustedWidth;
        bbox.x -= (extraWidth / 2);
    } else {
        // div is taller (or equal), pad bbox height to match
        var flippedDivProportions = divHeight / divWidth;
        var adjustedHeight = flippedDivProportions * bbox.width;
        var extraHeight = adjustedHeight - bbox.height;
        bbox.height = adjustedHeight;
        bbox.x -= (extraHeight / 2);
    }

    // copy to our persistent viewbox
    for (var prop in bbox) {
        viewbox[prop] = bbox[prop];
    }

    // TODO: match the viewport's final size (disabled scrollbars)?
    
    /* Scale the proportional SVG to fit the viewport DIV. To do this, we
     * determine how big the new viewbox would be in pixels (using default_ppi)
     * and magnify this to fit the viewportDIV.
     */
    var newMagnification = divWidth / viewbox.width;
    // update the display
    zoomViewport( newMagnification );  // calls initTreeIllustratorWindow();
}
function getMinimalIllustrationBoundingBox() {
    // Return just the region defined for printing (copying its properties
    // to a simple Object, to prevent NoModificationAllowedError in IE)
    var bbox = $('#illustration-background')[0].getBBox();
    return $.extend({}, bbox);
}
function getInclusiveIllustrationBoundingBox() {
    // Fetch the region defined for printing, PLUS any "out of bounds" SVG
    // elements. Again, we'll copying its properties to a simple Object, to
    // prevent NoModificationAllowedError in IE.
    var bbox = d3.select('g.illustration-elements').node().getBBox();
    /* REMINDER: This designated group should contain all illustration elements
       and an invisible box matching the printed area. */
    return $.extend({}, bbox);
}
function getDiagnosticBoundingBox() {
    // gather outermost bounds based on diagnostic elements found
    var bbox = getMinimalIllustrationBoundingBox();
    var viewportSVG = d3.select("#viz-outer-frame div.vega svg");
    var rulers = viewportSVG.select("#rulers").node();
    if (rulers) {
        bbox = getCombinedBoundingBox( bbox, rulers.getBBox() );
    }
    var cropmarks = viewportSVG.select("#crop-marks").node();
    if (cropmarks) {
        bbox = getCombinedBoundingBox( bbox, cropmarks.getBBox() );
    }
    var description = viewportSVG.select("#description").node();
    if (description) {
        bbox = getCombinedBoundingBox( bbox, description.getBBox() );
    }
    return $.extend({}, bbox);
}
function getCombinedBoundingBox( box1, box2 ) {
    // reckon the "union" of two bounding boxes
    var bbox = $.extend({}, box1);
    // compare (obvious) left and top extents
    var bboxLeft = bbox.x;
    var box2Left = box2.x;
    if (box2Left < bboxLeft) {
        // increase width, then reset left edge
        bbox.width = bbox.width + (bboxLeft - box2Left);
        bbox.x = box2Left;
    }
    var bboxTop = bbox.y;
    var box2Top = box2.y;
    if (box2Top < bboxTop) {
        // increase height, then reset top edge
        bbox.height = bbox.height + (bboxTop - box2Top);
        bbox.y = box2Top;
    }
    // compare (implicit) right and bottom extents
    var bboxRight = bbox.x + bbox.width;
    var box2Right = box2.x + box2.width;
    if (box2Right > bboxRight) {
        bbox.width = box2Right - bbox.x;
    }
    var bboxBottom = bbox.y + bbox.height;
    var box2Bottom = box2.y + box2.height;
    if (box2Bottom > bboxBottom) {
        bbox.height = box2Bottom - bbox.y;
    }
    return bbox;
}

/* Annoying browser quirk! Firefox/Mac (and possibly others?) have different SVG
 * masking behavior, where the mask itself must transform along with the SVG it is
 * masking. In these cases, we need to match scale and "invert" X and Y
 * position of the mask.
 */
var svgMaskRequiresTransform = $.browser.mozilla;  //  && $.browser.version < "35";
/* NOTE that test this will fail when we upgrade to jQuery 1.9+! In that case, consider:
    * the jQuery Migrate plugin or this snippet:
      https://github.com/jquery/jquery-migrate/blob/e6bda6a84c294eb1319fceb48c09f51042c80892/src/core.js#L50
    * Modernizr (though it doesn't seem to detect this particular quirk)
    * sniffing the JS 'navigator' object for more information  
 */

/* Manage re-usable SVG elements in the viewport. These are typically defined
   in a persistent SVG defs element, where they can be modified and re-used
   (including multiple instances) for masking, clipping, and optional printed
   output like crop marks and diagnostic rulers.

   NOTE that we need to use d3 to create SVG elements. jQuery flubs the
   namespaces!
*/
function enableViewportMask() {
    //var toolboxSVG = d3.selectAll("#svg-toolbox");
    var viewportSVG = d3.selectAll("#viz-outer-frame div.vega svg");
    if (viewportSVG.empty()) {
        console.warn("enableViewportMask(): viewport SVG not found!");
        return null;
    }
    var mask = d3.select('#viewport-mask');

    if (svgMaskRequiresTransform) {
        // set explicit size and scale for the viewport mask itself
        d3.select("#viewport-mask")
            .attr('maskUnits', 'userSpaceOnUse')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', viewbox.width * viewportMagnification)
            .attr('height', viewbox.height * viewportMagnification);
        // scale the mask !? seems to be required for FF/Mac, at least
        var maskGroupTransform = 'translate('+ -(viewbox.x * viewportMagnification) +','+ -(viewbox.y * viewportMagnification) +') scale('+ viewportMagnification +')';
        //console.log(maskGroupTransform);
        d3.select("#mask-shapes")
            .attr('transform', maskGroupTransform);
    }

    // match the mask's viewport-bounds to the current viewport size
    d3.select("#viewport-bounds")
        .attr('x', viewbox.x)
        .attr('y', viewbox.y)
        .attr('width', viewbox.width)
        .attr('height', viewbox.height);
    // match the mask's illustration-bounds to the current illustration size
    d3.select("#illustration-bounds")
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', physicalUnitsToPixels(ill.style.printSize.width(), internal_ppi))
        .attr('height', physicalUnitsToPixels(ill.style.printSize.height(), internal_ppi));

    // assign the mask to the main viewport (fades stuff outside the print area)
    viewportSVG.attr('mask', 'url(#viewport-mask)');

    if (viewportSVG.selectAll("#viewport-background").empty()) {
        // add milder backdrop for work area (outside the print area)
        viewportSVG.insert('rect', 'svg > g')
                .attr('id', 'viewport-background')
                .attr('width', '100%')
                .attr('height', '100%')
                .style('fill', '#ccc');
        // add a white background for the print area
        viewportSVG.insert('use', 'svg > g')
                .attr('id', 'illustration-background')
                .attr('xlink:href', '#illustration-bounds')
                .style('stroke','#bbb');
    }
    d3.select('#viewport-background')
        .attr('x', viewbox.x)
        .attr('y', viewbox.y);
    viewportSVG.selectAll("#viewport-background, #illustration-background")
        .style("visibility", "visible");
}
function disableViewportMask() {
    // remove and clean up masking stuff (prior to printing?)
    var viewportSVG = d3.selectAll("#viz-outer-frame div.vega svg");
    viewportSVG.attr('mask', null);
/*
    viewportSVG.selectAll("#viewport-background").remove();
    viewportSVG.selectAll("#illustration-background").remove();
*/
    viewportSVG.selectAll("#viewport-background, #illustration-background")
        .style("visibility", "hidden");
}

function enablePrintingCropArea() {
    d3.select('div.vega svg g.illustration-elements')
        .style('clip-path','url(#printing-clip-path)');
}
function disablePrintingCropArea() {
    d3.select('div.vega svg g.illustration-elements')
        .style('clip-path','none');
}

/* Manage diagnostic markings (crop marks, description, rulers) for printed output */
function showPrintingDiagnostics() {
    showPrintingCropMarks();
    showPrintingDescription();
    showPrintingRulers();
}
function hidePrintingDiagnostics() {
    hidePrintingCropMarks();
    hidePrintingDescription();
    hidePrintingRulers();
}
function showPrintingCropMarks() {
    var viewportSVG = d3.selectAll("#viz-outer-frame div.vega svg");
    if (viewportSVG.empty()) {
        console.warn("showPrintingCropMarks(): viewport SVG not found!");
        return null;
    }
    if (viewportSVG.selectAll("#crop-marks").empty()) {
        // create instance of crop marks and 
        viewportSVG.insert('use', 'svg > g')
                .attr('id', 'crop-marks')
                .attr('xlink:href', '#printing-crop-marks');
    }
    // adjust placement of marks to match for illustration size
    var printTopEdge = 0;  // no need to set these
    var printLeftEdge = 0;
    var printBottomEdge = physicalUnitsToPixels(ill.style.printSize.height(), internal_ppi);
    var printRightEdge = physicalUnitsToPixels(ill.style.printSize.width(), internal_ppi);
    d3.select('#crop-mark-top-right')
        .attr('transform', "translate("+ printRightEdge +", 0)");
    d3.select('#crop-mark-bottom-left')
        .attr('transform', "translate(0, "+ printBottomEdge +")");
    d3.select('#crop-mark-bottom-right')
        .attr('transform', "translate("+ printRightEdge +", "+ printBottomEdge +")");
}
function hidePrintingCropMarks() {
    // remove all crop-mark instances
    var viewportSVG = d3.selectAll("#viz-outer-frame div.vega svg");
    viewportSVG.selectAll("#crop-marks").remove();
}
function showPrintingDescription() {
    var viewportSVG = d3.selectAll("#viz-outer-frame div.vega svg");
    if (viewportSVG.empty()) {
        console.warn("showPrintingDescription(): viewport SVG not found!");
        return null;
    }
    if (viewportSVG.selectAll("#description").empty()) {
        // create instance of crop marks and 
        viewportSVG.insert('use', 'svg > g')
                .attr('id', 'description')
                .attr('xlink:href', '#printing-description');
    }
    // NOTE that we need to move the *original* text element to get its proper bounding box!
    d3.select('#printing-description-name')
        .attr('x', -50)
        .attr('y', -110)
        .text("TODO: Add the actual illustration name, or 'Untitled'");
    var rightNow = new Date();
    var displayDateTime = "Generated "+ rightNow.toLocaleDateString() +" - "+ rightNow.toLocaleTimeString();
    d3.select('#printing-description-datetime')
        .attr('x', -50)
        .attr('y', -94)
        .text(displayDateTime);
}
function hidePrintingDescription() {
    // remove description instance
    var viewportSVG = d3.selectAll("#viz-outer-frame div.vega svg");
    viewportSVG.selectAll("#description").remove();
}
function showPrintingRulers() {
    var viewportSVG = d3.selectAll("#viz-outer-frame div.vega svg");
    if (viewportSVG.empty()) {
        console.warn("showPrintingDescription(): viewport SVG not found!");
        return null;
    }
    if (viewportSVG.selectAll("#rulers").empty()) {
        // create instance of crop marks and 
        viewportSVG.insert('use', 'svg > g')
                .attr('id', 'rulers')
                .attr('xlink:href', '#printing-rulers')
                .attr('x', 0)
                .attr('y', -60);
    }
    // set scale for inch ruler
    var unitWidth = inchesToPixels(1.0, internal_ppi);
    d3.select('#ruler-inches line')
        .attr('x2', 6 * unitWidth);
    d3.selectAll('#ruler-inches rect')
        .each(function(d,i) {
            d3.select(this)
                .attr('width', unitWidth)
                .attr('x', (i * 2 * unitWidth) + unitWidth)
        });
    // set scale for cm ruler
    unitWidth = centimetersToPixels(1.0, internal_ppi);
    d3.select('#ruler-cm line')
        .attr('x2', 16 * unitWidth);
    d3.selectAll('#ruler-cm rect')
        .each(function(d,i) {
            d3.select(this)
                .attr('width', unitWidth)
                .attr('x', (i * 2 * unitWidth) + unitWidth)
        });
}
function hidePrintingRulers() {
    // remove description instance
    var viewportSVG = d3.selectAll("#viz-outer-frame div.vega svg");
    viewportSVG.selectAll("#rulers").remove();
}

function getPrintableSVG( options ) {
    // TODO: Add an option to generate standalone SVG, vs. inline for HTML5
    if (!options) options = {};

    // shift SVG from editing to printing
    disableViewportMask();
    enablePrintingCropArea();
    if (options.INCLUDE_DIAGNOSTICS) {
        showPrintingDiagnostics();
    }

    // capture the viewbox and pixel dimensions of the current working view
    var illustration = d3.select('#viz-outer-frame div.vega svg');
    var workingView = {
        'width': illustration.attr("width"),
        'height': illustration.attr("height"),
        'viewBox': illustration.attr("viewBox")
    }

    // modify the viewbox to capture just the illustration elements (and possibly diagnostic stuff)
    var printViewBox = (options.INCLUDE_DIAGNOSTICS) ?
        getDiagnosticBoundingBox() : 
        getMinimalIllustrationBoundingBox();

    /*
    console.log("printViewBox: ");
    console.log(printViewBox);
    */

    // shift the main SVG dimensions to physical units (for more accurate print size)
    var unitSuffix = ill.unitsCssSuffix();
    // reckon physical size in default (print-ready) ppi to "freeze" the pixel size of the top-level SVG
    illustration
        /* N.B. Relying on "natural" SVG res (90 ppi) prints not-quite to scale!
        .attr("width", printViewBox.width)   // rely on built-in ?
        .attr("height", printViewBox.height)
        */
        // Explicitly state WRONG physical size, using browser PPI; prints correctly, but gives me a migraine
        .attr("width", pixelsToPhysicalUnits(printViewBox.width, browser_ppi) + unitSuffix)
        .attr("height", pixelsToPhysicalUnits(printViewBox.height, browser_ppi) + unitSuffix)
        .attr("viewBox", (printViewBox.x +' '+ printViewBox.y +' '+ printViewBox.width +' '+printViewBox.height));

    /*
    console.log( "w: "+ illustration.attr('width') );
    console.log( "h: "+ illustration.attr('height') );
    console.log( "v: "+ illustration.attr('viewBox') );
    console.log("display_ppi: "+ display_ppi);
    console.log("internal_ppi: "+ internal_ppi);
    console.log("browser_ppi: "+ internal_ppi);
    console.log("viewportMagnification: "+ viewportMagnification);
    */

    // momentarily "splice" persistent defs into the illustration, capture the result
    var toolbox = d3.select('#svg-toolbox');
    var defs = toolbox.select('defs');
    $(illustration.node()).prepend(defs);

    /*
     * Capture the resulting SVG (ie, The Moment of Truth)... 
     */
    var combinedSVG = $('#viz-outer-frame div.vega').html();

    // Replace Safari's weird namespace prefixes (NS1:, NS2:, etc) with the real deal
    combinedSVG = combinedSVG.replace(/NS\d+:/gi, 'xlink:');

    /*
     * ... then unwind all these changes to restore our normal working view. 
     */

    // replace the persistent defs
    $(toolbox.node()).prepend(defs);

    // restore pixel dimensions (in deference to Vega)
    illustration
        .attr("width", workingView.width)
        .attr("height", workingView.height)
        .attr("viewBox", workingView.viewBox);

    // reverse all the previous steps
    if (options.INCLUDE_DIAGNOSTICS) {
        hidePrintingDiagnostics();
    }
    disablePrintingCropArea();
    enableViewportMask();

    return combinedSVG;
}

function printIllustration(options) {
    /* Print standalone SVG as a simple document, or display its current output SVG.
     *   EXAMPLE: printIllustration();
     *   EXAMPLE: printIllustration({INCLUDE_DIAGNOSTICS: true});
     *   EXAMPLE: printIllustration({INCLUDE_DIAGNOSTICS: true, SHOW_SVG: true});
     */
    if (!options) options = {};
    var showDiagnostics = options.INCLUDE_DIAGNOSTICS || false;
    var leaveWindowOpen = options.SHOW_SVG || false;

    var w=window.open();
    if (!w) {
        alert("Please allow popups for this domain.");
        return;
    }

    // generate a simple HTML5 page with inline SVG
    // TODO: generate standalone SVG document (to save or share) instead?
    var doc = w.document;
    doc.open("text/html", "replace");
    doc.write('<!DOCTYPE html><HTML><HEAD><TITLE>Tree Illustrator - SVG for printing</TITLE></HEAD><BODY></BODY></HTML>');
    doc.close();
    var outputSVG = getPrintableSVG( {INCLUDE_DIAGNOSTICS: showDiagnostics} );
    // let the browser render the new window so we can use its height
    setTimeout(function() {
        if (leaveWindowOpen) {
            // write just the SVG to the new window, to be copied to clipboard
            var itsClientHeight = $('html', doc)[0].clientHeight - 50;
            doc.body.innerHTML = '<textarea style="width: 95%; height: '+ itsClientHeight +'px;">'+ outputSVG +'</textarea>';
        } else {
            // normal print+close behavior
            doc.body.innerHTML = outputSVG;
            w.print();
            w.close();
        }
    }, 500);
}

/* Accordion UI helpers */
function accordionPanelShown(e) {
    var $heading = $(e.target).prev('.panel-heading');
    $heading.find("i.help-rollover")
        .text('Click to close this panel');
}
function accordionPanelHidden(e) {
    var $heading = $(e.target).prev('.panel-heading');
    $heading.find("i.help-rollover")
        .text('Click to open this panel');
}
function showAccordionHint(e) {
    $(e.target)
        .find("i.help-rollover")
        .show();
}
function hideAccordionHint(e) {
    $(e.target)
        .find("i.help-rollover")
        .hide();
}
function showAccordionPanel( panelID ) {
    /* Drive the sidebar UI to show a particular section on demand, 
     * e.g. show a tree's properties when user clicks on it in viz.
     */
    var $chosenPanel = $(panelID);
    if ($chosenPanel.length === 0) {
        console.error('showAccordionPanel(): No such panel as '+ panelID);
        return;
    }
    if ($chosenPanel.hasClass('in')) {
        // It's already open; don't toggle it shut!
    } else {
        // Toggle to show this panel; use API vs. a simulated click, which can stop dragging!
        // Close other panels (these are "sticky" for some reason)
        $chosenPanel.closest('.accordion').find('.collapse.in')
            .collapse('hide');
        $chosenPanel.collapse('show');
    }
    // TODO: show sidecar in all cases?
}
function showAccordionPanelForElement( elementID ) {
    var panelID = '#ti-panel-'+ elementID;
    showAccordionPanel( panelID );
}
function getAccordionPanelForElement( illElement ) {
    var panelID = '#ti-panel-'+ illElement.id();
    return $(panelID);
}

$(document).ready(function() {
    $('#ti-main-accordion .panel-body').on('shown', accordionPanelShown);
    $('#ti-main-accordion .panel-body').on('hidden', accordionPanelHidden);

    $('#ti-main-accordion .panel-heading').on('mouseenter', showAccordionHint);
    $('#ti-main-accordion .panel-heading').on('mouseleave', hideAccordionHint);
});

function doNothing() {
    // occasionally useful in Knockout.js click bindings
    return;
}

function getPrintAreaLandmarks() {
    // gather interesting coordinates in internal pixels
    if (ill) {
        return {
            width: physicalUnitsToPixels(ill.style.printSize.width(), internal_ppi),
            height: physicalUnitsToPixels(ill.style.printSize.height(), internal_ppi),
            leftX: 0,
            centerX: physicalUnitsToPixels(ill.style.printSize.width() / 2.0, internal_ppi),
            rightX: physicalUnitsToPixels(ill.style.printSize.width(), internal_ppi),
            topY: 0,
            centerY: physicalUnitsToPixels(ill.style.printSize.height() / 2.0, internal_ppi),
            bottomY: physicalUnitsToPixels(ill.style.printSize.height(), internal_ppi)
        };
    }
    // return placeholder values
    return {
        width:   1.0,
        height:  1.0,
        leftX:   0.0,
        centerX: 0.5,
        rightX:  1.0,
        topY:    0.0,
        centerY: 0.5,
        bottomY: 1.0
    };
}
 
function enterFullScreen() {
    var test = $('#full-screen-area').fullscreen();
    return false;
}
function exitFullScreen() {
    $.fullscreen.exit();
    return false;
}

/* Test regexps for MIME-type (content-type) of a File or Blob */
var allTypes = /.*/;
var textTypes = /text.*/; // TODO: add 'application/json', etc?
var imageTypes = /image.*/;

// What do we expect (or forbid) for different illustration elements?
var expectedMIMETypes = {
    'IllustratedTree': textTypes,
    'SupportingDataset': textTypes,
    'Ornament': imageTypes
};
var disallowedMIMETypes = {
    'IllustratedTree': imageTypes,
    'SupportingDataset': imageTypes,
    'Ornament': allTypes
};

function handleChosenLocalFile( illElement, event ) {
    console.log('handleChosenLocalFile STARTING...');
    var fileList = event.target.files;      // a FileList
    // For now, we expect just one file!
    var chosenFile = fileList[0];           // a File

    // Warn/reject if not an appropriate MIME-type for this element?
    var expectedTypes = expectedMIMETypes[ illElement.metadata.type() ];
    var disallowedTypes = disallowedMIMETypes[ illElement.metadata.type() ];
    if (chosenFile.type.match(expectedTypes)) {
        // This is an expected content type, carry on...
    } else if (chosenFile.type.match(disallowedTypes)) {
        alert("Files of MIME-type '"+ chosenFile.type +"' are not allowed for "+ illElement.metadata.type() +" elements.");
        return;
    } else {
        // This content type is not in either list. Accept for now?
        console.warn("Tentatively allowing MIME-type '"+ chosenFile.type +"' for this "+ illElement.metadata.type());
    }

    // Show file information in its accordion element
    var $panel = getAccordionPanelForElement( illElement );
    $panel.find('.chosen-file-name').text(chosenFile.name);
    $panel.find('.chosen-file-type').html(chosenFile.type || '<em>Unknown</em>');
    $panel.find('.chosen-file-size').text(chosenFile.size);
    $panel.find('.chosen-file-last-mod-date').text(chosenFile.lastModifiedDate.toLocaleString());

    // create a URL to this File
    var reader = new FileReader();
    // closure to capture the file information.
    reader.onload = (function(theFile) {
        return function(e) {
            var r = e.target;  // i.e., this FileReader
            console.log("FileReadr result for '"+ escape(theFile.name) +"':\n"+ r.result);
            //debugger;
        };
    })(chosenFile);
    //reader.readAsDataURL(chosenFile);       // result is 'data:;base64,KEEsKEIsKEMsRCkpKTs='
    //reader.readAsBinaryString(chosenFile);  // result is '(A,(B,(C,D)));'
    //reader.readAsText(chosenFile);          // result is '(A,(B,(C,D)));'
    reader.readAsArrayBuffer(chosenFile);     // result is '[object ArrayBuffer]', more to do here obviously
}

function applyChosenStyleGuide(clicked) {
    var $clicked = $(clicked);
    var $sgBlock = $clicked.closest('.match');
    // TODO: replace this dumb matching with KO binding to actual data
    var matchKey = $sgBlock.find('.match-key').val();
    console.log("> Looking for matchKey: "+ matchKey);
    var chosenStyleGuide = null;
    $.each(availableStyleGuides, function(i, sg) {
        // is this the illlustration's current style guide? compare name, source, version
        var testKey  = sg.name +'|'+ sg.version.value +'|'+ sg.source.value;
        console.log(">> comparing testKey: "+ testKey);
        if (testKey === matchKey) {
            chosenStyleGuide = sg;
            return false;
        }
    });
    if (!chosenStyleGuide) {
        alert('Unable to match the chosen style guide!');
        return;
    }
    // TODO: apply / merge this style guide into the current illustration
    ill.applyStyleGuide(chosenStyleGuide);
    // close the modal chooser
    $sgBlock.closest('.modal-styleguide-chooser').find('.modal-header .close').click();
}

// reflect the current user's identity, or null for an anonymous user
function userLogin() {
    return storage.userLogin();
}
function userDisplayName() {
    return storage.userDisplayName();
}
function userEmail() {
    return storage.getUserEmail();
}
function userHasStorageAccess() {
    //return userLogin() && (userLogin() !== 'LOGIN_NOT_FOUND');
    return storage.userHasStorageAccess();
}
function userIsLoggedIn(callback) {
    if (storage.userAuthToken) {
        // asynchronous, since it may require an AJAX roundtrip...
        if (typeof(callback) !== 'function') {
            alert('stylist.userIsLoggedIn() - requires a callback function!')
            return;
        }
        // return true if OAuth still recognizes this token
        callback(storage.userIsLoggedIn());
        return;
    }
    // no callback required!
    return true;  // treat as "true" by default, e.g. Jupyter notebook
}

// manage illustrations (using an adapter with API methods, already loaded)
var currentIllustrationList = null;
    // keep the latest ordered array (with positions, names, descriptions)
function loadIllustrationList(backend, callback) {
    console.log("loadIllustrationList() STARTING...");
    storage[ backend ].getIllustrationList(function(response) {
        // show the returned list (or report any error) from the upstream response
        if ('data' in response) {
            // expect an ordered array with names and descriptions
            currentIllustrationList = response.data;
            if (callback) {
                callback(backend);
            }
        } else {
            console.error(response.error || "No data returned (unspecified error)!");
        }
    });
}
function showIllustrationList( backend, currentOperation, options ) {
    options = options || {FLUSH_CACHE: false};
    if (options.FLUSH_CACHE) {
        currentIllustrationList = null;
    }
    if (currentIllustrationList) {
        // Show names and descriptions in a simple, general chooser
        var $chooser = $('#simple-chooser');
        // Show appropriate UI and behavior for the desired operation (eg, SAVING_ILLUSTRATION)
        $chooser.find('[class^=if-]').hide();
        $chooser.find('.if-'+ currentOperation).show();  // eg, '.if-SAVING_ILLUSTRATION'
        $chooser.find('.if-'+ backend).show();  // eg, '.if-GITHUB_REPO'
        switch (currentOperation) {
            case ('LOADING_ILLUSTRATION'):
            //case ('LOADING_TEMPLATE'):
                $chooser.find('.dialog-heading').html('Load an existing illustration');
                break;
            case ('SAVING_ILLUSTRATION'):
                // adjust display and behavior in the shared popup
                /* Check for a prior storage location (lastSave); if found,
                 * explain what happens next and offer alternative save-as
                 * behavior, i.e. make a copy instead.
                 */
                $chooser.find('.dialog-heading').html('Save (or update) your illustration');
                if ((storage.lastSave.backend() === 'GITHUB_REPO') && storage.lastSave.location()) {
                    // a simple update is the path of least resistance, but offer other options
                    $('#not-replacing-on-github').hide();
                    $('#if-replacing-on-github').show();
                } else {
                    // recognize an implicit match, based on name=>slug conversion?
                    $('#not-replacing-on-github').show();
                    $('#if-replacing-on-github').hide();
                }
                /*
                $('#suggested-storage-name').val( ill.metadata.name() );
                $('#suggested-storage-name').unbind('change')
                                            .bind('propertychange change click keyup input paste', function() {
                                                // N.B. lots of bound events, to catch any change in modern browsers
                                                console.log("...checking for potential save conflicts...");
                                                switch(backend) {
                                                    case 'GITHUB_REPO':
                                                        // test new slug/id (or stored prior id) against our illustration list, warn if it's a duplicate!
                                                        var proposedID = storage.GITHUB_REPO.getDefaultGitHubIllustrationID();
                                                        // TODO: compare all ids/urls with this!
                                                        $.each(currentIllustrationList, function(i, match) {
                                                            console.log(proposedID);
                                                            console.warn(match.source);
                                                            if (match.source === proposedID) {
                                                                console.warn("THIS WILL OVERWRITE AN EXISTING ILLUSTRATION!");
                                                                $('#github-storage-dupe-warning').show();
                                                                return false;
                                                            }
                                                        });
                                                        console.log(currentIllustrationList);
                                                        break;
                                                    case 'JUPYTER_NOTEBOOK':
                                                    default:
                                                        console.error("#suggested-storage-name should not be changing!");
                                                        return;
                                                }
                                            })
                                            .change();
                */
                break;
            default:
                console.error("MISSING/UNKNOWN storage operation: '"+ 
                    currentOperation +"' <"+ typeof(currentOperation) +">");
                return;
        }

        $chooser.find('.found-matches').empty();
        if (currentIllustrationList.length === 0) {
            $chooser.find('.found-matches').append('<div>'+
              '<em>No illustrations found in storage.</em>'+
            '</div>');
        } else {
            $.each(currentIllustrationList, function(i, match) {
                /* List item should include these properties
                 *  - name
                 *  - description
                 *  - source
                 * N.B. In slot-based storage, `i` is the only source information
                 */
                var storageLocation = match.source || i;
                var $matchInfo = $('<div class="match"><div><span class="name"></span><span class="storage-location"></span></div><div class="description"></div></div>');
                $matchInfo.find('.name').html(match.name || '<em>No name found</em>')
                $matchInfo.find('.storage-location').html(' ('+ storageLocation +')');
                $matchInfo.find('.description').html(match.description || '');
                var $loadButton, $deleteButton, $replaceButton;
                switch (currentOperation) {
                    case 'LOADING_ILLUSTRATION':
                    //case 'LOADING_TEMPLATE':
                        $loadButton = $('<button class="btn btn-primary btn-mini pull-right"'
                                       +' style="margin-top: 6px; margin-left: 8px;"'
                                       +'>Load</button>');
                        $loadButton.click(function() {
                            fetchAndLoadExistingIllustration( backend, storageLocation);
                            // close the modal chooser
                            $(this).closest('.modal-simple-chooser').find('.modal-header .close').click();
                        });
                        $matchInfo.prepend($loadButton);
                        $deleteButton = $('<button class="btn btn-danger btn-mini pull-right"'
                                         +' style="margin-top: 6px; margin-left: 8px;"'
                                         +'><i class="icon-white icon-remove"></i</button>');
                        $deleteButton.click(function() {
                            if (confirm("This will delete ALL information about this illustration. Are you sure?")) {
                                deleteIllustration( backend, storageLocation, function() {
                                    showIllustrationList( backend, currentOperation, {FLUSH_CACHE: true} );
                                });
                            }
                        });
                        $matchInfo.prepend($deleteButton);
                        break;
                    case 'SAVING_ILLUSTRATION':
                    //case 'SAVING_TEMPLATE':
                        $replaceButton = $('<button class="btn btn-primary btn-mini pull-right"'
                                          +' style="margin-top: 6px; margin-left: 8px;"'
                                          +'>Replace</button>');
                        $replaceButton.click(function() {
                            saveCurrentIllustration( backend, storageLocation, {REFRESH_LIST: true} );
                        });
                        $matchInfo.prepend($replaceButton);
                        $deleteButton = $('<button class="btn btn-danger btn-mini pull-right"'
                                         +' style="margin-top: 6px; margin-left: 8px;"'
                                         +'><i class="icon-white icon-remove"></i</button>');
                        $deleteButton.click(function() {
                            if (confirm("This will delete ALL information about this illustration. Are you sure?")) {
                                deleteIllustration( backend, storageLocation, function() {
                                    showIllustrationList( backend, currentOperation, {FLUSH_CACHE: true} );
                                });
                            }
                        });
                        $matchInfo.prepend($deleteButton);
                        break;
                }
                $chooser.find('.found-matches').append($matchInfo);
            });
        }
        $chooser.off('shown').on('shown', resizeIllustrationList);
        ///USEFUL? $chooser.find('.found-matches').css('visibility','visible');
        //$chooser.find('.found-matches').css('visibility','hidden');
        // (re)bind UI with Knockout
        var $boundElements = $chooser.find('.modal-body'); // add other elements?
        $.each($boundElements, function(i, el) {
            ko.cleanNode(el);
            ko.applyBindings({},el);
        });
        $chooser.modal('show');
        resizeIllustrationList();
    } else {
        // load the initial list, then return here
        loadIllustrationList(backend, function() {
            showIllustrationList( backend, currentOperation );
        });
    }
}
function resizeIllustrationList() {
/* N.B. this doesn't really apply unless we've locked the popup's height!
    // size scrolling list to fit in the current DOI-lookup popup window
    var $chooser = $('#simple-chooser');
    var $matchListHolder = $chooser.find('.found-matches');
    $matchListHolder
        .css('visibility','hidden');
    var resultsListHeight = $chooser.find('.modal-body').height() - $chooser.find('.before-matches').height();
    $matchListHolder
        .outerHeight(resultsListHeight);
        .css('visibility','visible');
*/
}
function saveCurrentIllustration(backend, saveToLocation, options) {
    options = options || {FORCE_NEW_DOC: false, REFRESH_LIST: false};
    console.log("saveCurrentIllustration() CHECKING FOR SPECIFIED BACKEND+LOCATION...");
    if (!backend || (saveToLocation === null)) {
        // not specified (e.g., we haven't saved the current illustration in this session)
        showStorageOptions('SAVING_ILLUSTRATION');  // defer to the Save As... behavior
        return;
    }
    if ((backend === 'LOCAL_FILESYSTEM') && (saveToLocation === 'UNKNOWN')) {
        // propose an appropriate filename based on its internal name
        saveToLocation = getDefaultArchiveFileName();
    }

    if (options.FORCE_NEW_DOC) {
        switch (backend) {
            case 'GITHUB_REPO':
                if (('sha' in ill.metadata) && (typeof(ill.metadata.sha) === 'function')) {
                    ill.metadata.sha('');  // this forces new doc on GitHub
                }
                break;
        }
    }

    console.log("saveCurrentIllustration() STARTING simple (re)save...");
    // TODO: How should this ID be determined?
    //  - unique/serialized slug, ala tree collections?
    //  - if provided as incoming arg, use to Save As
    //  - add an explicit arg for SAVE, SAVE_AS, DUPLICATE
    //  - should these details be delegated to the storage adapter?
    //  - OR should we rely entirely on (and possibly modify) its internal metadata?
    // Current behavior (in IPython notebook) is to assume the current (nth)
    // storage slot, unless 'NEW' or another integer is asserted here.
    storage[ backend ].saveIllustration(saveToLocation, function(response) {
        // (re)load the saved illustration (or report any error)
        if (response.error) {
            console.error( response.error );
        } else {
            //currentIllustrationList = response.data;
            // update last-saved info
            /* Confirm that the saveToLocation wasn't changed by the storage backend!
             * This probably means checking the illustration's returned metadata (if any).
             */
            switch (backend) {
                case 'GITHUB_REPO':
                    // check for new id assigned by backend (already changed in the illustration)
                    var newMetadataLocation = ill.metadata.url();
                    var assignedID = storage.GITHUB_REPO.getIllustrationIDFromURL(newMetadataLocation);
                    // keep track of this *assigned* location, vs. what we intended
                    updateLastSavedInfo(backend, assignedID);
                    break;
                case 'JUPYTER_NOTEBOOK':
                    // Test saves to Jupyter notebook, so we can translate 'NEW' (stated intent) to an actual slot number!
                    if (saveToLocation === 'NEW') {
                        // N.B. response.data is the *new* illustration list
                        var howManyIllustrations = response.data.length;
                        var newSlotPosition = howManyIllustrations - 1;
                        updateLastSavedInfo(backend, newSlotPosition);
                    } else {
                        updateLastSavedInfo(backend, saveToLocation);
                    }
                    break;
                case 'LOCAL_FILESYSTEM':
                    // Nothing to do here. We can't see the new local filename!
                    break;
            }

            // update the illustration list
            if (options.REFRESH_LIST) {
                showIllustrationList( backend, 'SAVING_ILLUSTRATION', {FLUSH_CACHE: true} );
            }
        }
    });
}
function deleteIllustration(backend, deleteLocation, callback) {
    /* N.B. We generally assume this is NOT the current (live) illustration,
     * but another chosen from a storage popup!
     */
    console.log("deleteIllustration() CHECKING FOR SPECIFIED BACKEND+LOCATION...");
    if (!backend || !deleteLocation) {
        console.error("deleteIllustration() requires a storage backend and location!");
        console.error("  backend: "+ backend +" <"+ typeof(backend) +">");
        console.error("  location: "+ deleteLocation +" <"+ typeof(deleteLocation) +">");
        return;
    }

    console.log("deleteIllustration() STARTING simple deletion...");
    storage[ backend ].deleteIllustration(deleteLocation, function(response) {
        // (re)load the saved illustration (or report any error)
        if (response.error) {
            console.error( response.error );
        } else {
            // update the list in UI, to show that it's really gone
            console.log("deleteIllustration() gave this response (new illustration list? or simpler result?)");
            console.log( response );
            //currentIllustrationList = response.data;
            // any cleanup?
            switch (backend) {
                case 'GITHUB_REPO':
                    // Did we just delete the currently loaded illustration!?
                    if (('url' in ill.metadata) && (ill.metadata.url().endsWith( '/'+ deleteLocation ))) {
                        // Clear its internal 'url' and 'sha', to force 'Save As' behavior next time
                        console.log("stylist.deleteIllustration(): clobbered live illustration! so clearing its SHA and URL...");
                        ill.metadata.url('');
                        ill.metadata.sha('');
                        clearLastSavedInfo();
                    }
                    break;
            }
        }
        if (typeof callback === 'function') {
            // typically reloading an illustration list
            callback();
        }
    });
}

function showStorageOptions( currentOperation ) {
    // Show all storage backends, incl. disabled / not available.
    var $popup = $('#storage-options-popup');
    // TODO: $popup.find(':input').val('');  // clear any old values?

    // Show appropriate UI and behavior for the desired operation (eg, SAVING_ILLUSTRATION)
    $popup.find('[class^=if-]').hide();
    $popup.find('.if-'+ currentOperation).show();  // eg, '.if-SAVING_ILLUSTRATION'
    switch (currentOperation) {
        case ('LOADING_ILLUSTRATION'):
        case ('SAVING_ILLUSTRATION'):
        //case ('LOADING_TEMPLATE'):
        //case ('LOADING_TEMPLATE'):
            // adjust display and behavior in the shared popup
            break;
        default:
            console.error("MISSING/UNKNOWN storage operation: '"+ 
                currentOperation +"' <"+ typeof(currentOperation) +">");
            return;
    }

    // Display should reflect the availability of each storage backend (check
    // here, so we don't keep testing)
    if (stylist.utils.browserSupportsFileAPI()) {
        $popup.find('.file-api-supported').show();
        $popup.find('.file-api-NOT-supported').hide();
    } else {
        $popup.find('.file-api-supported').hide();
        $popup.find('.file-api-NOT-supported').show();
    }
    if (hostApplication === TreeIllustrator.hostApplications.JUPYTER_NOTEBOOK) {
        $popup.find('.notebook-storage-supported').show();
        $popup.find('.notebook-storage-NOT-supported').hide();
    } else {
        $popup.find('.notebook-storage-supported').hide();
        $popup.find('.notebook-storage-NOT-supported').show();
    }

    if (storage.GITHUB_REPO.userIsLoggedIntoGitHub()) {
        $('#github-login-panel').hide();
        $('#github-logged-in').show();
    } else {
        $('#github-login-panel').show();
        $('#github-logged-in').hide();
    }

    $popup.modal('show');
    //$popup.find('#github-authorize').unbind('click').click(loginToGitHub);

    // (re)bind UI with Knockout
    var $boundElements = $('#storage-options-popup .modal-body'); // add other elements?
    $.each($boundElements, function(i, el) {
        ko.cleanNode(el);
        ko.applyBindings({},el);
    });
}
function toggleSaveOptionDetails(clicked) {
    var $clicked = $(clicked);
    var $currentOptionPanel = $clicked.closest('.modal-body');
    var $otherOptionPanels = $clicked.closest('.modal').find('.modal-body').not($currentOptionPanel);
    $otherOptionPanels.find('.option-details').hide();
    $currentOptionPanel.find('.option-details').toggle();
}

/*
function gatherStaticInputData() {
    // TODO: Return an array of objects with .path, .value, other sensible properties
    return [ ];
}

function gatherAllInputData() {
    // TODO: Return an array of objects with .path, .value, other sensible properties
    return [ ];
}

function gatherAllTransformData() {
    // TODO: Return an array of objects with .path, .value, other sensible properties
    return [ ];
}
*/

function loadArchiveFromChosenFile( vm, evt ) {
    // First param (corresponding view-model data) is probably empty; focus on the event!
    // ASSUME we're in the storage-options popup.
    var $hintArea = $('#local-filesystem-warning').eq(0);
    $hintArea.html("");  // clear for new results
    var eventTarget = evt.target || evt.srcElement;
    switch(eventTarget.files.length) {
        case (0):
            console.warn('No file(s) selected!');
            return;
        case (1):
        default:  // ignore multiple files for now, just load the first
            var fileInfo = eventTarget.files[0];
            console.warn("fileInfo.name = "+ fileInfo.name);
            console.warn("fileInfo.type = "+ fileInfo.type);
            var isValidArchive = false;
            switch (fileInfo.type) {
                case 'application/zip':
                    isValidArchive = true;
                    break;
                case '':
                    // check file extension
                    if (fileInfo.name.match('.(zip|ill)$')) {
                        isValidArchive = true;
                    }
                    break;
            }
            if (!isValidArchive) {
                var msg = "Archived illustrations should end in <code>.zip</code> or <code>.ill</code>. Choose another file?";
                $hintArea.html(msg).show();
                return;
            }
            // Still here? try to read and unzip this archive!
            jszip.loadAsync(fileInfo)   // read the Blob
                 .then(function(zip) {  // success callback
                     console.log('reading ZIP contents...');
                     var msg = "Reading illustration contents...";
                     $hintArea.html(msg).show();
                     // How will we know when it's all (async) loaded? Count down as each entry is read!
                     var zipEntriesToLoad = 0;
                     var initialCache = {};
                     for (var p in zip.files) { zipEntriesToLoad++; }
                     // Stash most found data in the cache, but main JSON should be parsed
                     var mainIllustrationJSON = null;
                     zip.forEach(function (relativePath, zipEntry) {  // 2) print entries
                         console.log('  '+ zipEntry.name);
                         console.log(zipEntry);
                         // skip directories (nothing to do here)
                         if (zipEntry.dir) {
                             //console.warn("SKIPPING directory "+ zipEntry.name +"...");
                             zipEntriesToLoad--;
                             return;
                         }
                         // read and store files
                         zipEntry.async('text', function(metadata) {
                                    // report progress?
                                    var msg = "Reading illustration contents ("+ zipEntry.name +"): "+ metadata.percent.toFixed(2) +" %";
                                    $hintArea.html(msg).show();
                                 })
                                 .then(function success(data) {
                                           console.log("Success unzipping "+ zipEntry.name +":\n"+ data);
                                           zipEntriesToLoad--;
                                           // parse and stash the main JSON data; cache the rest
                                           switch (zipEntry.name) {
                                               case 'main.json':
                                                   mainIllustrationJSON = JSON.parse(data);
                                                   break;
                                               default:
                                                   // copy to our initial cache
                                                   initialCache[ zipEntry.name ] = data;
                                           }
                                           if (zipEntriesToLoad === 0) {
                                               // we've read in all the ZIP data! open this illustration
                                               // (setting its initial cache) and close this popup
                                               loadIllustrationData( mainIllustrationJSON, initialCache, 'EXISTING');
                                               // update last-saved info
                                               //updateLastSavedInfo('LOCAL_FILESYSTEM', 'UNKNOWN');
                                               updateLastSavedInfo('LOCAL_FILESYSTEM', fileInfo.name);
                                               // N.B. the File API *always* downloads to an unused path+filename
                                               $('#storage-options-popup').modal('hide');
                                           }
                                       },
                                       function error(e) {
                                           var msg = "Problem unzipping "+ zipEntry.name +":\n"+ e.message;
                                           $hintArea.html(msg).show();
                                       });
                     });
                 }, 
                 function (e) {         // failure callback
                     var msg = "Error reading <strong>" + fileInfo.name + "</strong>! Is this a proper zip file?";
                     $hintArea.html(msg).show();
                 });
    }
}

function getDefaultArchiveFileName( candidateFileName ) {
    // try to use a candidate name, if provided
    var suggestedFileName = $.trim(candidateFileName) || 
        stylist.ill.metadata.name() || 
        "UNTITLED_ILLUSTRATION";
    if (!suggestedFileName.toLowerCase().endsWith('.zip')) {
        suggestedFileName += '.zip';
    }
    return suggestedFileName;
}
function saveArchiveWithSuggestedName() {
    var $filenameField = $('input#suggested-archive-filename');
    var suggestedFileName = $.trim($filenameField.val());
    if (suggestedFileName) {
        suggestedFileName = getDefaultArchiveFileName(suggestedFileName);
        stylist.storage[ LOCAL_FILESYSTEM ].saveIllustration(suggestedFileName);
    } else {
        stylist.storage[ LOCAL_FILESYSTEM ].saveIllustration();
    }
    updateLastSavedInfo('LOCAL_FILESYSTEM', suggestedFileName || 'UNKNOWN');
    $('#local-filesystem-warning').slideDown();
}

// Expose some members to outside code (eg, Knockout bindings, onClick
// attributes...)
var api = [
    'TreeIllustrator',
    'userLogin',
    'userDisplayName',
    'userEmail',
    'showStorageOptions',
    'toggleSaveOptionDetails',
    'userHasStorageAccess',
    'userIsLoggedIn',
    'showIllustrationList',
    'loadIllustrationList',
    'fetchAndLoadExistingIllustration',
    'fetchAndLoadIllustrationTemplate',
    'saveCurrentIllustration',
    'inchesToCentimeters',
    'centimetersToInches',
    'inchesToPoints',
    'pointsToInches',
    'centimetersToPoints',
    'pointsToCentimeters',
    'pixelsToInches',
    'inchesToPixels',
    'pixelsToCentimeters',
    'centimetersToPixels',
    'pixelsToPhysicalUnits',
    'physicalUnitsToPixels',
    'pointsToCentimeters',
    'getPrintAreaLandmarks',
    'toggleFixedRulers',
    'refreshViz',
    'doNothing',
    'browser_ppi',
    'internal_ppi',
    'display_ppi',
    'internalUnitsToOverlayPixels',
    'overlayPixelsToInternalUnits',
    'availableTrees',
    'availableDataSources',
    'zoomViewport',
    'printIllustration',
    'resizeViewportToShowAll',
    'availableStyleGuides',
    'showStyleGuidePicker',
    'showAccordionPanel',
    'showAccordionPanelForElement',
    'applyChosenStyleGuide',
    'handleChosenLocalFile',
    'enterFullScreen',
    'exitFullScreen',
    'ill',
    //'gatherStaticInputData',
    //'gatherAllInputData',
    //'gatherAllTransformData',
    'loadArchiveFromChosenFile',
    'getDefaultArchiveFileName',
    'saveArchiveWithSuggestedName',
    'clearLastSavedInfo',
    'view',
    //'jszip',
    //'FileSaver',
    'utils',
    'storage'
];
$.each(api, function(i, methodName) {
    // populate the default 'module.exports' object
    exports[ methodName ] = eval( methodName );
});
