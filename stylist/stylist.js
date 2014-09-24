//vg.data.phylogram = d3.phylogram.rightAngleDiagonal;

var availableTrees = [
    {
        name: "Jansen, 2007", 
        url: "./pg_10.json"
       /* TODO: just provide IDs here?
        studyID: 'pg_10',
        treeID: 'tree5',
        otusID: 'otus2'
        */ 
    },
    {
        name: "Springer M., 2012", 
        url: "./pg_2584.json"
    }
];

var availableStyles = [
    {
        name: "Basic", 
        style:  { 
          "width": 800,
          "height": 800,
          "padding": {"top": 50, "left": 30, "bottom": 60, "right": 10},
          //, "viewport": [350, 350],
          //"data": [{"name": "table"}],
          "marks": [
            {
              "type": "group",
              "properties": {
                "enter": {
                  "x": {"value": 0.5},
                  "y": {"value": 10}, // {"scale": "g", "field": "key"},
                  "height": {"value": 300}, // {"group": "height"}, // {"scale": "g", "band": true},
                  "width": {"value": 600}, // {"group": "width"},
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
              "name": "y", 
              //"type": "linear",
              "range": "height", 
              "nice": false,
              "domain": [0, 1]  // {"data": "phyloTree", "field": "data.trees.length"}
              //"domain": {"data": "phyloTree", transform: {"type": "pluck", "field": "phyloNodes"}, "field": "y"}
            }
          ],

          "axes": [
            {
              "type": "x", 
              "scale": "x",
              "grid": true,
              "orient": "top",
              //"title": "Time",
              "ticks": 10,  // MISSING? what's up with that?
              //"grid": true,
              "properties": {
                "ticks": {
                  "stroke": {"value": "steelblue"}
                },
                "majorTicks": {
                  "strokeWidth": {"value": 2}
                },
                "labels": {
                  "fill": {"value": "steelblue"},
                  "angle": {"value": 50},
                  "fontSize": {"value": 14},
                  "align": {"value": "left"},
                  "baseline": {"value": "middle"}
                  //"dx": {"value": 3}
                },
                "title": {
                  "fill": {"value": "steelblue"},
                  "fontSize": {"value": 16}
                },
                "axis": {
                  "stroke": {"value": "#333"},
                  "strokeWidth": {"value": 0.5}
                }
              }
            },
            {"type": "y", "grid": true, "scale": "y"}

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
        style:  { 
        }
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
      var view = chart({el:"#view", renderer:"svg"})  // , data:viewModel.data})  <== MUST BE INLINE, NOT URL!
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
        console.log( "There are "+ $('svg').length +" SVG elements on this page");
        console.log( "There are "+ $('svg g').length +" SVG groups on this page");
        tg  = $('svg g g g g g g:eq(0) g')
        tn = tg.find('g.type-symbol');
        te = tg.find('g.type-path');
        rn = tn.find('path').eq(0);

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

        // bring stuff into view //TODO: cleanup
        tn.attr('transform','translate(100,100)')
        te.attr('transform','translate(100,100)')

        // colorize nodes and edges to ROYGBV
        colors = ['red','orange','yellow','green','blue','violet'];
        $.each(tn.find('path'), function(i, n) {
            $(n).css('stroke', colors[i]);
        });
        $.each(te.find('path'), function(i, e) {
            $(e).css('stroke', colors[i]);
        });
        
    });
}
var tg, tn, te, rn; 

var viewModel;
$(document).ready(function() {
    // create the viewModel (a full vega spec?) and build a matching UI
    viewModel = {
        style: availableStyles[0].style,  // see above
        data: [
            {
                'name':"phyloTree", 
                'url': buildStudyFetchURL( 'pg_2823' ), 
                'format':{
                    "type":"treejson",   // necessary to ingest a JS object (vs. array)
                    //"property":"data.nexml.trees.0.tree.0.node"       // find node array
                    "children": function(node) {
                        // blah
                        debugger;
                    }
                    // TODO: Specify nth trees collection, and nth tree inside!
                },
                'transform':[
                    // N.B. that this can include layout properties (size, etc)
                    {"type": "nexson", "treesCollectionPosition":0, "treePosition":0}       // , "size": [230, 90]}
                    ,
                    { 
                        "type": "phylogram", 
                        // consolidate all other interesting phylogram choices here?
                        "layout": "radial",
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
    viewModel.data = {
        'name':'phyloTree', 
        'url':treeInfo.url, 
        'format':{"type":"treejson"},  // initial match for JSON object, vs. array
        'transform':[
            {"type": "nexson", "treesCollectionPosition":0, "treePosition":0}  // to generic tree?
            // TODO: add all possible properties (common to by all formats?)
            // TODO: merge supporting data from other files? or do that downstream?
            // TODO: final tailoring to phylogram layout (one, or several?)
        ]
    };
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
