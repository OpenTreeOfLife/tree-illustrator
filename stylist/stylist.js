//vg.data.phylogram = d3.phylogram.rightAngleDiagonal;

var availableTrees = [
    {
        name: "Gazis, 2014", 
        url: buildStudyFetchURL( 'pg_2818' )
       /* TODO: provide more IDs here?
        studyID: 'pg_10',
        treeID: 'tree5',
        otusID: 'otus2'
        */ 
    },
    {
        name: "Jansen, 2007", 
        url: buildStudyFetchURL( 'pg_10' ), // "./pg_10.json"
    },
    {
        name: "Drew BT, 2014", 
        url: buildStudyFetchURL( 'pg_2821' )
    }

];


/* Conversion utilities for physical units */
var cm_per_inch = 2.54;
function inchesToCentimeters( inches ) {
    return inches * cm_per_inch;
}
function centimetersToInches( cm ) {
    return cm / cm_per_inch;
}

function pixelsToInches( px ) {
    return px / ppi;
}
function inchesToPixels( inches ) {
    return inches * ppi;
}
function pixelsToCentimeters( px ) {
    return inchesToCentimeters(px / ppi);
}
function centimetersToPixels( cm ) {
    return centimetersToInches( cm ) * ppi;
}
/*
console.log("CONVERSION TESTS");
console.log(inchesToCentimeters(1));
console.log(inchesToCentimeters(0.1));
console.log(inchesToCentimeters(8.5));
console.log("--");
console.log(centimetersToInches(2.54));
console.log(centimetersToInches(1));
console.log(centimetersToInches(100));
console.log("--");
console.log(inchesToPixels(1));
console.log(pixelsToInches(90));
console.log("--");
console.log(centimetersToPixels(1));
console.log(pixelsToCentimeters(90));
console.log("--");
*/



var physicalWidth = 4.0;
var physicalHeight = 5.0;
var physicalUnits = 'INCHES';   // or 'CENTIMETERS'
var ppi;  // SVG default pixels per inch (can be modified to suit printing device)

var availableStyles = [
    {
        name: "Basic", 
        style:  { 
          "width": 800,
          "height": 800,
          "padding": {"top": 50, "left": 50, "bottom": 60, "right": 10},
          //, "viewport": [350, 350],
          //"data": [{"name": "table"}],
          "marks": [
            {
              "type": "group",
              "properties": {
                "enter": {
                  "x": {"value": 0.5},
                  "y": {"value": 10}, // {"scale": "g", "field": "key"},
                  "height": {"value": (physicalUnits === 'INCHES' ? inchesToPixels(physicalHeight) : centimetersToPixels(physicalHeight)) },  // {"group": "height"}, // {"scale": "g", "band": true},
                  "width": {"value": (physicalUnits === 'INCHES' ? inchesToPixels(physicalWidth) : centimetersToPixels(physicalWidth))},      // {"group": "width"},
                  "stroke": {"value": "#ccc"}
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
              "range": "height"
              //"domain": {"data": "phyloTree", transform: {"type": "pluck", "field": "phyloNodes"}, "field": "y"}
            }
            ,
            {
              "name": "inches-across", 
              "nice": true,
              "domain": [0, (physicalUnits === 'INCHES' ? physicalWidth : centimetersToInches(physicalWidth)) ],  // {"data": "phyloTree", "field": "data.trees.length"}
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
            },
            {
                "type": "y", 
                "scale": "height-cm",
                "grid": false,
                "orient": "left",
                "title": "cm"
            }
          ],



              //"from": {"data": "series"},
              "marks": [

        { 
            "type": "group",
            "properties": {
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
                  "stroke": {"value": "red"}
                }
              }
            },
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
                  "fill": {"value": "red"}
                }
              }
            }
/* ,
            {
              "type": "text",
              "from": {"data": "phyloTree", "transform": [{"type":"pluck", "field":"phyloNodes" }] },
              "properties": {
                "enter": {
                  "x": {"scale": "time", "field": "x", "mult":1},
                  "y": {"scale": "y", "field": "y", "mult":1.0}
                },
                "update": {
                  "text": {"value":"LBL"},
                  //"text": {"field":"y"},
                  "fill": {"value":"orange"}
                },
                "hover": {
                  "fill": {"value": "red"}
                }
              }
            },
*/
                ] /* end of inner group marks */
            } /* end of inner group */

              ] /* end of outer group marks */
            } /* end of outer group */


          ] /* end of Basic marks */
        } /* end of Basic style */
    }, /* end of Basic */

/*
    {
        name: "Nature", 
        style:  {
          "width": 300,
          "height": 500,
          "padding": {"top": 80, "left": 30, "bottom": 30, "right": 10},
          //"data": [{"name": "table"}],
          "scales": [
            {
              "name": "x", "type": "ordinal", "range": "width",
              "domain": {"data": "table", "field": "data.x"}
            },
            {
              "name": "y", "range": "height", "nice": true,
              "domain": {"data": "table", "field": "data.y"}
            }
          ],
          "axes": [
            {"type": "x", "scale": "x"},
            {"type": "y", "scale": "y"}
          ],
          "marks": [
            {
              "type": "rect",
              "from": {"data": "table"},
              "properties": {
                "enter": {
                  "x": {"scale": "x", "field": "data.x"},
                  "y": {"scale": "y", "field": "data.y"},
                  "y2": {"scale": "y", "value": 0},
                  "width": {"scale": "x", "band": false, "offset": -1}
                },
                "update": {
                  "fill": {"value": "navy"}
                },
                "hover": {
                  "fill": {"value": "yellow"}
                }
              }
            },
            {
              "type": "rect",
              "interactive": false,
              "from": {"data": "table"},
              "properties": {
                "enter": {
                  "x": {"scale": "x", "field": "data.x", "offset": -3.5},
                  "y": {"scale": "y", "field": "data.y", "offset": -3.5},
                  "y2": {"scale": "y", "value": 0, "offset": 3.5},
                  "width": {"scale": "x", "band": false, "offset": 6},
                  "fill": {"value": "transparent"},
                  "stroke": {"value": "red"},
                  "strokeWidth": {"value": 2}
                },
                "update": {
                  "strokeOpacity": {"value": 0}
                },
                "hover": {
                  "strokeOpacity": {"value": 1}
                }
              }
            }
          ]
        }
    },
*/
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

var spec = {
  "width": 400,
  "height": 200,
  "padding": {"top": 10, "left": 30, "bottom": 30, "right": 10},
  //"data": [{"name": "table"}],
  "scales": [
    {
      "name": "x", "type": "ordinal", "range": "width",
      "domain": {"data": "table", "field": "data.x"}
    },
    {
      "name": "y", "range": "height", "nice": false,
      "domain": {"data": "table", "field": "data.y"}
    }
  ],
  "axes": [
    {"type": "x", "scale": "x"},
    {"type": "y", "scale": "y"}
  ],
  "marks": [
    {
      "type": "rect",
      "from": {"data": "table"},
      "properties": {
        "enter": {
          "x": {"scale": "x", "field": "data.x"},
          "y": {"scale": "y", "field": "data.y"},
          "y2": {"scale": "y", "value": 0},
          "width": {"scale": "x", "band": false, "offset": -1}
        },
        "update": {
          "fill": {"value": "steelblue"}
        },
        "hover": {
          "fill": {"value": "red"}
        }
      }
    },
    {
      "type": "rect",
      "interactive": false,
      "from": {"data": "table"},
      "properties": {
        "enter": {
          "x": {"scale": "x", "field": "data.x", "offset": -3.5},
          "y": {"scale": "y", "field": "data.y", "offset": -3.5},
          "y2": {"scale": "y", "value": 0, "offset": 3.5},
          "width": {"scale": "x", "band": false, "offset": 6},
          "fill": {"value": "transparent"},
          "stroke": {"value": "red"},
          "strokeWidth": {"value": 2}
        },
        "update": {
          "strokeOpacity": {"value": 0}
        },
        "hover": {
          "strokeOpacity": {"value": 1}
        }
      }
    }
  ]
};

/* Offer functions to munge different input formats into d3-compatible JSON.
 * We might ultimately migrate this functionality into the vg.data namespace, but this 
 * is arguably outside of the scope of vega, see for example this discussion:
 *   https://github.com/trifacta/vega/issues/29#issuecomment-16319363
 */
var adapters = {
    'identity': function( data ) {
        // do nothing (default filter)
        return data;
    },
    'nexson': function( data ) {
        // TODO: Repeat transformations from OpenTree curation tool
        return data;
    },
    'arguson': function( data ) {
        // TODO: Support this (or another format) for piecmeal display of very large trees?
        return data;
    },
    'newick': function( data ) {
        // TODO: Support other common formats?
        return data;
    }
}

var fullSpec;
function refreshViz() {
    if (!viewModel.style) return;
   
    // filter the incoming data, if applicable
    var dataFilter = adapters[ viewModel.dataFormat ];
    var adaptedData = vg.isFunction(dataFilter) ? dataFilter(viewModel.data) : viewModel.data;

    // build the "full" specification, adding study data to preset style
    fullSpec = $.extend(true, {}, viewModel.style, {'data': viewModel.data});
    vg.parse.spec(fullSpec, function(chart) {
      var view = chart({el:"#viz-outer-frame", renderer:"svg"})  // , data:viewModel.data})  <== MUST BE INLINE, NOT URL!
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
        tn.attr('transform','translate(100,100)')
        te.attr('transform','translate(100,100)')

        // ugly hack to remove the intervening FOREIGNOBJECT and DIV between our outer SVG and vega's SVG
        ///$('#viz-vega-fo').replaceWith($('div.vega').contents());
        initTreeIllustratorWindow();
    });
}
var tg, tn, te, rn; 

var viewModel;
$(document).ready(function() {
    // correct the active ppi (pixels / inch) in this browser
    ppi = $('#ppi-test').width();
    $('#ppi-indicator').text(ppi);

    // update some of our available styles
    var mainGroupProperties = availableStyles[0].style.marks[0].properties.enter;
    if (mainGroupProperties) {
        mainGroupProperties.height.value = physicalUnits === 'INCHES' ? 
            inchesToPixels(physicalHeight) : 
            centimetersToPixels(physicalHeight);
        mainGroupProperties.width.value = physicalUnits === 'INCHES' ? 
            inchesToPixels(physicalWidth) : 
            centimetersToPixels(physicalWidth);
    }
    var cmHeightScale = availableStyles[0].style.marks[0].scales[1];
    if (cmHeightScale) {
        cmHeightScale.domain = [
            0, 
            (physicalUnits === 'INCHES' ? inchesToCentimeters(physicalHeight) : physicalHeight) 
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
                        //"orientation": 0,
                        "tipsAlignment": 'right'
                    }
                ]
            }
        ],
        illustrationID: null,  // TODO: assign a key/ID when saved?
        illustrationName: "Untitled"
    };
    var editorArea = $('#editor')[0];
    ko.applyBindings(viewModel, editorArea);

    // TODO: Add "safety net" if there are unsaved changes
    // TODO: Add JSON support for older IE?
    // TODO: Add bootstrap for style+behavior?

    //initTreeIllustratorWindow();
    refreshViz();
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
                        //"radialArc": [90, 0],
                        //"radialSweep": 'CLOCKWISE',
                        "radialSweep": 'COUNTERCLOCKWISE',
                        //"branchStyle": "diagonal",  // other options here?
                        "branchLengths": "",  // empty/false, or a property name to compare?
                        "width": 100,   // TODO: FIX these dimensions (they rotate)
                        "height": 100, 
                        //"orientation": 0,
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
    //var styleName = $('#style-chooser option:selected').val();
    var styleName = $('#style-chooser').val();
    var selectedStyles = $.grep(availableStyles, function(o) {return o.name === styleName;});
    var styleInfo = null;
    if (selectedStyles.length > 0) {
        styleInfo = selectedStyles[0];
    }
    if (!styleName || !styleInfo) {
        console.warn("No style found under '"+ styleName +"'!");
        return;
    }
    viewModel.style = styleInfo.style;
    refreshViz();
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
}

function initTreeIllustratorWindow() {
    var $outerFrame = $("#viz-outer-frame");
    var $scrollingViewport = $outerFrame.find('div.vega');
    var $topRuler = $outerFrame.find('#fixed-ruler-top');
    var $leftRuler = $outerFrame.find('#fixed-ruler-left');
    
    // sync scrolling of rulers to viewport
    $scrollingViewport.unbind('scroll').on('scroll', function() {
    //TODO: delegate these for one-time call!
    //$outerFrame.on('scroll', 'div.vega', function() {
        console.log("SCROLLING, left="+$scrollingViewport.scrollLeft()+", top="+$scrollingViewport.scrollTop());
        $topRuler.scrollLeft($scrollingViewport.scrollLeft());
        $leftRuler.scrollTop($scrollingViewport.scrollTop());
    });
    
    // sync resizing of rulers to viewport
    // (no event for this except on the window, it's an on-demand thing)
    var topRulerScale = d3.scale.linear()
        .domain([0,100])
        .range([0,300]);
    var topRulerAxis = d3.svg.axis()
        .scale(topRulerScale)
        .orient('top');
    var topRuler = d3.select("#fixed-ruler-top svg")
        .attr("width", $scrollingViewport.children()[0].scrollWidth+'px')
        .attr("height", '20px')
        .append("g")
        .attr("class",'outer-axis')
        .attr("transform", "translate(0, 19)")
        .call(topRulerAxis);

    var leftRulerScale = d3.scale.linear()
        .domain([0,100])
        .range([0,300]);
    var leftRulerAxis = d3.svg.axis()
        .scale(leftRulerScale)
        .orient('left');
    var leftRuler = d3.select("#fixed-ruler-left svg")
        .attr("width", '20px')
        .attr("height", $scrollingViewport.children()[0].scrollHeight+'px')
        .append("g")
        .attr("class",'outer-axis')
        .attr("transform", "translate(19, 0)")
        .call(leftRulerAxis);
    
    // TODO: sync scaling (axes) of rulers to viewport
}
