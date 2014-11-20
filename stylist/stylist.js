/*
 * In this editor, we generate a declarative Vega spec (and its downstream d3
 * visualization) from a more descriptive scene-graph model. This corresponds
 * closely with a web UI that's bound and enabled using KnockoutJS.
 */

/* TODO: Offer all studies and trees from the Open Tree of Life repository,
 * plus other sources and tree formats.
 */
var availableTrees = [
    {
        name: "Gazis, 2014", 
        /* TODO: provide more IDs here (esp. tree ID)
        studyID: 'pg_10',
        treeID: 'tree5',
        otusID: 'otus2'
        */ 
        url: buildStudyFetchURL( 'pg_2818' )
    },
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
];


/* Conversion utilities for physical units
 */
var cm_per_inch = 2.54;
function inchesToCentimeters( inches ) {
    return inches * cm_per_inch;
}
function centimetersToInches( cm ) {
    return cm / cm_per_inch;
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
    if (physicalUnits === 'INCHES') {
        return pixelsToInches( px, ppi );
    } else {
        return pixelsToCentimeters( px, ppi );
    }
}
function physicalUnitsToPixels( units, ppi ) {
    if (physicalUnits === 'INCHES') {
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

// TODO: These key properties should be driven from the loaded illustration
var physicalUnits = 'INCHES'; // 'CENTIMETERS' | 'INCHES'
var physicalWidth = 4.0;      // in the chosen units
var physicalHeight = 5.0;

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
var availableStyles = [
    {
        name: "Basic", 
        style:  { 
          "width": 800,
          "height": 900,
          "padding": {
            "top": 0,
            "left": 0,
            "bottom": 0,
            "right": 0
          },
          //, "viewport": [350, 350],
          //"data": [{"name": "table"}],
          "marks": [
            {
              "type": "group",
              "name": "illustration-elements",  // becomes marker class .illustration-elements
              "properties": {
                "enter": {
                  "x": {"value": 0},
                  "y": {"value": 0}, // {"scale": "g", "field": "key"},
                  "height": {"value": physicalUnitsToPixels(physicalHeight, internal_ppi) },  // {"group": "height"}, // {"scale": "g", "band": true},
                  "width": {"value": physicalUnitsToPixels(physicalWidth, internal_ppi) }     // {"group": "width"},
                },
                "update": {
                  //"transform": {"value":"rotate(-25)"}  // ???
                }
              },

          "scales": [
/*
            {
              "name": "time", 
              "type": "linear",
              "range": "width",
              //"domain": {"data": "phyloTree", transform: {"type": "pluck", "field": "phyloNodes"}, "field": "x"}
              "domain": [0, 1]
            },
*/
            {
              "name": "x", 
              "range": "width", 
              "nice": false,
              //"domain": {"data": "phyloTree", transform: [{"type": "pluck", "field": "phyloNodes"}], "field": "x" }
              "domain": [0, 1]  // {"data": "phyloTree", "field": "data.trees.length"}
            },
            {
              // height in cm
              "name": "height-cm", 
              "type": "linear",
              "nice": false,
              "domain": [0, (physicalUnits === 'INCHES' ? inchesToCentimeters(physicalHeight) : physicalHeight) ],  // {"data": "phyloTree", "field": "data.trees.length"}
              "range": [0, physicalUnitsToPixels(physicalHeight, internal_ppi)] //"height"
              //"domain": {"data": "phyloTree", transform: {"type": "pluck", "field": "phyloNodes"}, "field": "y"}
            }
            ,
            {
              "name": "inches-across", 
              "nice": true,
              "domain": [0, (physicalUnits === 'INCHES' ? physicalWidth : centimetersToInches(physicalWidth, internal_ppi)) ],  // {"data": "phyloTree", "field": "data.trees.length"}
              "range": "width"
              //"domain": {"data": "phyloTree", transform: [{"type": "pluck", "field": "phyloNodes"}], "field": "x" }
              //"domain": [0, 1]  // {"data": "phyloTree", "field": "data.trees.length"}
            }
            ,
            {
              "name": "cm-down", 
              "range": "height", 
              "nice": true//,
              //"domain": {"data": "phyloTree", transform: [{"type": "pluck", "field": "phyloNodes"}], "field": "x" }
              //"domain": [0, 1]  // {"data": "phyloTree", "field": "data.trees.length"}
            }
          ],

          "axes": [
/* HIDING the internal rulers
            {
              "type": "x", 
              "scale": "inches-across",
              //"grid": true,
              "orient": "top",
              "title": "Inches",
              //"ticks": 10,  // MISSING? what's up with that?
              "properties": {
                "ticks": {
                  //"stroke": {"value": "steelblue"}
                },
                "majorTicks": {
                  //"strokeWidth": {"value": 2}
                },
                "labels": {
                  //"fill": {"value": "steelblue"},
                  //"angle": {"value": 50},
                  //"fontSize": {"value": 14},
                  //"align": {"value": "left"},
                  //"baseline": {"value": "middle"}
                  //"dx": {"value": 3}
                },
                "title": {
                  //"fill": {"value": "steelblue"},
                  "fontSize": {"value": 10}
                },
                "axis": {
                  "stroke": {"value": "#333"},
                  "strokeWidth": {"value": 0.5}
                }
              }
            }
            ,
            {
                "type": "y", 
                "scale": "height-cm",
                "grid": false,
                "orient": "left",
                "title": "cm"
            }
*/
         ],



              //"from": {"data": "series"},
              "marks": [

        { 
            "type": "group",
            "name": "default-tree",  // becomes marker class .default-tree
            "properties": {
                "enter": {
                    "x": {"value": 0},
                    "y": {"value": 0}
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
                "data": "phyloTree", 
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
                  "stroke": {"value": "#888"},
                  "strokeWidth": {"value": 1.0}
                },
                "hover": {
                 // "stroke": {"value": "red"}
                }
              }
            },

    {   /* group node/label pairs, for easier event binding later */
        "type":"group",
        "marks":[
            {
              "type": "symbol",
              //"from": {"data": "phyloTree", "transform": [{"type":"array", "fields":["phyloNodes"] }] },
              //"from": {"data": "phyloTree", "transform": [{"type":"copy", "from":"phyloTree", "fields":["x", "y"] }] },
              "from": {"data": "phyloTree", "transform": [{"type":"pluck", "field":"phyloNodes" }] },
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
            }
            ,
            {
              "type": "text",
              "from": {"data": "phyloTree", "transform": [{"type":"pluck", "field":"phyloNodes" }] },
              "properties": {
                "enter": {
                  /* Properties for cartesian / rectangular layouts
                  "x": {"scale": "time", "field": "x", "mult":1},
                  "y": {"scale": "y", "field": "y", "mult":1.0}
                  "dx": {"value": -6},
                  "dy": {"value": -6},
                  */

                  /* Properties for radial/polar layouts.
                   * Radius and theta (angle from origin, in radians) are the
                   * alternatives to X and Y for polar projection, and assume
                   * that the x and y properties represent the origin or center
                   * of the layout, ie, the root node. See discussion at
                   *  https://github.com/trifacta/vega/pull/187
                   */
                  "x": {"value": 0},  // this is origin for radial/polar projection
                  "y": {"value": 0},
                  "radius": {"field": "radius"},  // px from origin
                  "theta": {"field": "theta"},  // in radians (what direction from origin)
                  "align": {"field": 'align'},  // NOTE that some labels are flipped 180deg for legibility
                  "angle": {"field": "angle"},  // in degrees

                  "fontSize": {"value": 5}
                        // TODO: adjustable font size (convert pt to px)
                },
                "update": {
                  "text": {"field": "ottTaxonName"},
                  //"text": {"field":"y"},
                  "fill": {"value":"black"}
                },
                "hover": {
                  "fill": {"value": "red"}
                }
              }
            } /* end of label marks */
           ]
          } /* end of grouped node+label */ 
           ,

                ] /* end of inner group marks */
            } /* end of inner group */

              ] /* end of outer group marks */
            } /* end of outer group */


          ] /* end of Basic marks */
        } /* end of Basic style */
    }, /* end of Basic */

    // more examples, just suggestive names for now
    {
        name: "Phylogram test", 
        style:  { }
    },
    {
        name: "Systematic Biology", 
        style:  { }
    },
    {
        name: "Nature (monochrome)", 
        style:  { }
    },
    {
        name: "Modern (from SysBio)", 
        style:  { }
    },
    {
        name: "Jim\'s favorites", 
        style:  { }
    }
];

/* The current Vega spec is generated using the chosen style (above) and 
 * the illustration source and decisions made in the web UI. When the
 * illustration is saved, the latest can also be embedded. Or perhaps we should
 * always generate it fresh from the source data and scene graph whenn
 * (re)loading the illustration?
 */
var vegaSpec;
function refreshViz(options) {
    if (!viewModel.style) return;
    if (!options) options = {}; 

    // build the "full" specification, adding study data to preset style
    vegaSpec = $.extend(true, {}, viewModel.style, {'data': viewModel.data});
    vg.parse.spec(vegaSpec, function(chart) {
      var view = chart({el:"#viz-outer-frame", renderer:"svg"})  // , data:viewModel.data})  <== MUST BE INLINE, NOT URL!
/*
        .on("mouseover", function(event, item) {
          // invoke hover properties on cousin one hop forward in scenegraph
          view.update({
            props: "hover",
            items: item.cousin(1)
          });
        })
        .on("mouseout", function(event, item) {
          // reset cousin item, using animated transition
          view.update({
            props: "update",
            items: item.cousin(1),
            duration: 250,
            ease: "linear"
          });
        })
*/
        .update();

        // populate temporary vars for SVG-tree group, nodes, paths, root node
        tg  = $('svg g g g g g g:eq(0) g')
        tn = tg.find('g.type-symbol');
        te = tg.find('g.type-path');
        rn = tn.find('path').eq(0);
/*
        // what are the visual extents of all nodes?
        var top = Number.MAX_VALUE;
        var right = Number.MIN_VALUE;
        var bottom = Number.MIN_VALUE;
        var left = Number.MAX_VALUE;
        $.each(tn.children(), function(index, n) {
            var $n = $(n);
            var os = $n.offset();
            top = Math.min(top, os.top);
            right = Math.max(right, os.left + $n.width());
            bottom = Math.max(bottom, os.top + $n.height());
            left = Math.min(left, os.left);
        });
        console.log("BOUNDS for all nodes:");
        console.log("  top="+ top);
        console.log("  right="+ right);
        console.log("  bottom="+ bottom);
        console.log("  left="+ left);

        // what are the visual extents of all edges?
        $.each(te.children(), function(index, e) {
            var $e = $(e);
            var os = $e.offset();
            top = Math.min(top, os.top);
            right = Math.max(right, os.left + $e.width());
            bottom = Math.max(bottom, os.top + $e.height());
            left = Math.min(left, os.left);
        });
        console.log("BOUNDS for all edges:");
        console.log("  top="+ top);
        console.log("  right="+ right);
        console.log("  bottom="+ bottom);
        console.log("  left="+ left);
*/
        // colorize nodes and edges to ROYGBV
        colors = ['red','orange','#cc0','green','blue','violet'];
        $.each(tn.find('path'), function(i, n) {
            $(n).css('stroke', colors[i]);
        });
        $.each(te.find('path'), function(i, e) {
            $(e).css('stroke', colors[i]);
        });

        // bring stuff into view //TODO: cleanup
        //tn.attr('transform','translate(100,100)')
        //te.attr('transform','translate(100,100)')

        // ugly hack to remove the intervening FOREIGNOBJECT and DIV between our outer SVG and vega's SVG
        ///$('#viz-vega-fo').replaceWith($('div.vega').contents());
        if (options.SHOW_ALL) {
            resizeViewportToShowAll();
        } else {
            initTreeIllustratorWindow();
        }
    });
}
var tg, tn, te, rn; 

var viewModel;
var ill;
$(document).ready(function() {
    // test for the preset ppi (pixels / inch) in this browser
    browser_ppi = $('#svg-toolbox').width() / 10.0;
    // NOTE that this is still unlikely to match the physical size of any particular monitor!
    // If that's important, we might want to let the user tweak this value.
    $('#browser-ppi-indicator').text(browser_ppi);
    $('#display-ppi-indicator').text(display_ppi);

    // update some of our available styles
/*
    var mainGroupProperties = availableStyles[0].style.marks[0].properties.enter;
    if (mainGroupProperties) {
        mainGroupProperties.height.value = physicalUnitsToPixels(physicalHeight, internal_ppi);
        mainGroupProperties.width.value = physicalUnitsToPixels(physicalWidth, internal_ppi);
        mainGroupProperties.x.value = physicalUnitsToPixels(physicalWidth/2.0, internal_ppi);
        mainGroupProperties.y.value = physicalUnitsToPixels(physicalHeight/2.0, internal_ppi);
    }
*/
    // nudge default tree into center of canvas
    var defaultTreeProperties = availableStyles[0].style.marks[0].marks[0].properties.enter;
    defaultTreeProperties.x.value = physicalUnitsToPixels(physicalWidth/2.0, internal_ppi);
    defaultTreeProperties.y.value = physicalUnitsToPixels(physicalHeight/2.0, internal_ppi);

    var cmHeightScale = availableStyles[0].style.marks[0].scales[1];
    if (cmHeightScale) {
        cmHeightScale.domain = [
            0, 
            (physicalUnits === 'INCHES' ? inchesToCentimeters(physicalHeight, internal_ppi) : physicalHeight) 
        ];
        cmHeightScale.range = [
            0, 
            physicalUnitsToPixels(physicalHeight, display_ppi) 
        ];
    }
    var inWidthScale = availableStyles[0].style.marks[0].scales[2];
    if (inWidthScale) {
        inWidthScale.domain = [
            0, 
            (physicalUnits === 'INCHES' ? physicalWidth : centimetersToInches(physicalWidth))
        ];
    }

    // create the viewModel (a full vega spec?) and build a matching UI
    viewModel = {
        style: availableStyles[0].style,  // see above
        data: [
            {
                'name':"phyloTree", 
                //'url': buildStudyFetchURL( 'pg_2823' ),   // TINY TREE
                //'url': buildStudyFetchURL( 'pg_2818' ),     // BIG TREE
                'url': availableTrees[0].url,
                'format':{ "type":"treejson" },  // necessary to ingest a JS object (vs. array)
                'transform':[
                    // N.B. that this can include layout properties (size, etc)
                    {"type": "nexson", "treesCollectionPosition":0, "treePosition":0}       // , "size": [230, 90]}
                    ,
                    { 
                        "type": "phylogram", 
                        // consolidate all other interesting phylogram choices here?
                        "layout": "radial",
                        //"radialArc": [90, 0],
                        //"radialSweep": 'CLOCKWISE',
                        "radialSweep": 'COUNTERCLOCKWISE',
                        //"branchStyle": "diagonal",  // other options here?
                        "branchLengths": "",  // empty/false, or a property name to compare?
                        "width": 100,   // TODO: FIX these dimensions (they rotate)
                        "height": 100, 
                        "tipsAlignment": 'right'
                    }
                ]
            }
        ],
        illustrationID: null,  // TODO: assign a key/ID when saved?
        illustrationName: "Untitled"
    };

    ill = new TreeIllustrator.Illustration();
    var editorArea = $('#editor')[0];
    ko.applyBindings(ill, editorArea);

    // TODO: Add "safety net" if there are unsaved changes
    // TODO: Add JSON support for older IE?

    // resizing the window should refresh/resize the viewport
    $(window).resize(function() {
        zoomViewport('REFRESH');
    });

    refreshViz( {SHOW_ALL: true} );
});

function buildStudyFetchURL( studyID ) {
    // ASSUMES we're using the phylesystem API to load studies from the OpenTree dev site
    var template = "http://api.opentreeoflife.org/phylesystem/v1/study/{STUDY_ID}?output_nexml2json=1.0.0&auth_token=ANONYMOUS"
    return template.replace('{STUDY_ID}', studyID);
}

function useChosenData() {
    var treeName = $('#tree-chooser').val();
    var selectedTrees = $.grep(availableTrees, function(o) {return o.name === treeName;});
    var treeInfo = null;
    if (selectedTrees.length > 0) {
        treeInfo = selectedTrees[0];
    }
    if (!treeName || !treeInfo) {
        console.warn("No tree found under '"+ treeName +"'!");
        return;
    }
    //viewModel.data.table = [treeInfo]; // TODO: switch from 'table' to 'tree'?
    viewModel.data = [{
        'name':'phyloTree', 
        'url':treeInfo.url, 
        'format':{"type":"treejson"},  // initial match for JSON object, vs. array
        'transform':[
            {"type": "nexson", "treesCollectionPosition":0, "treePosition":0}  // to generic tree?
                    ,
                    { 
                        "type": "phylogram", 
                        "layout": "radial",
                        //"radialArc": [90, 270],
                        //"radialSweep": 'CLOCKWISE',
                        "radialSweep": 'COUNTERCLOCKWISE',
                        //"branchStyle": "diagonal",  // other options here?
                        "branchLengths": "",  // empty/false, or a property name to compare?
                        "width": 100,   // TODO: FIX these dimensions (they rotate)
                        "height": 100, 
                        "tipsAlignment": 'right'
                    }
            // TODO: add all possible properties (common to by all formats?)
            // TODO: merge supporting data from other files? or do that downstream?
            // TODO: final tailoring to phylogram layout (one, or several?)
        ]
    }];
    refreshViz();
}

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

function testTransform(arg1, arg2, arg3) {
    console.log("testTransform");
    console.log(arg1);
    console.log(arg2);
    console.log(arg3);
    return true;
}

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

function togglePhysicalUnits(toggle) {
    var $toggleBtn = $(toggle);
    if (physicalUnits === 'INCHES') {
        physicalUnits = 'CENTIMETERS';
        physicalWidth = inchesToCentimeters(physicalWidth);
        physicalHeight = inchesToCentimeters(physicalHeight);
        $toggleBtn.text('Work in inches');
    } else {
        physicalUnits = 'INCHES';
        physicalWidth = centimetersToInches(physicalWidth);
        physicalHeight = centimetersToInches(physicalHeight);
        $toggleBtn.text('Work in cm');
    }
    refreshViz();
}

function initTreeIllustratorWindow() {
    var $outerFrame = $("#viz-outer-frame");
    var $scrollingViewport = $outerFrame.find('div.vega');
    var $rulerUnitsDisplay = $outerFrame.find('#fixed-ruler-units');
    var $topRuler = $outerFrame.find('#fixed-ruler-top');
    var $leftRuler = $outerFrame.find('#fixed-ruler-left');
    //var scrollbarWidth = $scrollingViewport[0].offsetWidth - $scrollingViewport[0].clientWidth;
    var topRulerAdjustedWidth = $scrollingViewport[0].clientWidth;
    var leftRulerAdjustedHeight = $scrollingViewport[0].clientHeight;

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
    $rulerUnitsDisplay.text( physicalUnits === 'INCHES' ? "in" : "cm" );
    
    // adjust viewport/viewbox to reflect current magnification (display_ppi)
    updateViewportViewbox( $scrollingViewport );

    // sync scrolling of rulers to viewport
    //TODO: delegate these for one-time call!
    $scrollingViewport.unbind('scroll').on('scroll', function() {
        $topRuler.scrollLeft($scrollingViewport.scrollLeft());
        $leftRuler.scrollTop($scrollingViewport.scrollTop());
    });
    
    // sync resizing of rulers to viewport
    // (no event for this except on the window, it's an on-demand thing)
    var mainGroupProperties = availableStyles[0].style.marks[0].properties.enter;

    var viewportWidth = $scrollingViewport.children()[0].scrollWidth;
    var viewportHeight = $scrollingViewport.children()[0].scrollHeight;
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
        .attr("height", rulerWidth+"px")
    drawRuler(topRuler, 'HORIZONTAL', physicalUnits, topRulerScale);

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
        .attr("height", viewportHeight+"px")
    drawRuler(leftRuler, 'VERTICAL', physicalUnits, leftRulerScale);
    
    enableViewportMask();
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
    // just the region defined for printing
    return $('#illustration-background')[0].getBBox();
}
function getInclusiveIllustrationBoundingBox() {
    // Fetch the region defined for printing, PLUS any "out of bounds" SVG elements.
    return d3.select('g.illustration-elements').node().getBBox();
    /* REMINDER: This designated group should contain all illustration elements
       and an invisible box matching the printed area. */
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
    return bbox;
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
        .attr('width', physicalUnitsToPixels(physicalWidth, internal_ppi))
        .attr('height', physicalUnitsToPixels(physicalHeight, internal_ppi));

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
    var printBottomEdge = physicalUnitsToPixels(physicalHeight, internal_ppi);
    var printRightEdge = physicalUnitsToPixels(physicalWidth, internal_ppi);
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
    var unitSuffix = getPhysicalUnitSuffix();
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

function printIllustration() {
    // print standalone SVG as a simple document
    var w=window.open();
    if (!w) {
        alert("Please allow popups for this domain.");
        return;
    }
    var showDiagnostics = $('#toggle-printing-diagnostics').is(':checked');
    w.document.write(getPrintableSVG( {INCLUDE_DIAGNOSTICS: showDiagnostics} ));
    w.print();
    w.close();
}

function testAddElement() {
    d3.select('div.vega svg g.illustration-elements')
        .append('rect')
            .attr('id','RED-RECT')
            .style('fill','#500')
            .attr('x', 325)
            .attr('y', 400)
            .attr('width', '100')
            .attr('height', '80');
    initTreeIllustratorWindow();
}
function testRemoveElement() {
    d3.select('#RED-RECT').remove();
    initTreeIllustratorWindow();
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
function movePanelUp(e) {
    var $widget = $(e.target);
    if ($widget.hasClass('move-disabled')) return false;
    var $panel = $(e.target).closest('.panel');
    if ($panel.prev().prev().length) {
        $panel.insertAfter($panel.prev().prev());
    } else {
        $panel.closest('.accordion').prepend($panel);
    }
    updateMoveWidgets();
    return false; // no more actions here
}
function movePanelDown(e) {
    var $widget = $(e.target);
    if ($widget.hasClass('move-disabled')) return false;
    var $panel = $(e.target).closest('.panel');
    $panel.insertAfter($panel.next());
    updateMoveWidgets();
    return false; // no more actions here
}
function updateMoveWidgets() {
    var $panels = $('#ti-main-accordion > .panel');
    $panels.each(function(i, panel) {
        var $panel = $(panel);
        if ($panel.prev('.tree-panel, .data-panel').length) {
            // enable move-up widget
            $panel.find('.panel-heading .move-up').removeClass('move-disabled');
        } else {
            // nowhere to move, disable it
            $panel.find('.panel-heading .move-up').addClass('move-disabled');
        }
        if ($panel.next('.tree-panel, .data-panel').length) {
            // enable move-down widget
            $panel.find('.panel-heading .move-down').removeClass('move-disabled');
        } else {
            // nowhere to move, disable it
            $panel.find('.panel-heading .move-down').addClass('move-disabled');
        }
    });
}
$(document).ready(function() {
    $('#ti-main-accordion .panel-body').on('shown', accordionPanelShown);
    $('#ti-main-accordion .panel-body').on('hidden', accordionPanelHidden);

    $('#ti-main-accordion .panel-heading').on('mouseenter', showAccordionHint);
    $('#ti-main-accordion .panel-heading').on('mouseleave', hideAccordionHint);

    $('#ti-main-accordion .move-up').on('click', movePanelUp);
    $('#ti-main-accordion .move-down').on('click', movePanelDown);

    updateMoveWidgets();
});
