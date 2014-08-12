var availableStyles = [
    {
        name: "Basic", 
        style:  { 
          "width": 400,
          "height": 200,
          "padding": {"top": 10, "left": 30, "bottom": 30, "right": 10},
          "data": [{"name": "table"}],
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
                  "width": {"scale": "x", "band": true, "offset": -1}
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
                  "width": {"scale": "x", "band": true, "offset": 6},
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
    {
        name: "Nature", 
        style:  {
          "width": 300,
          "height": 500,
          "padding": {"top": 80, "left": 30, "bottom": 30, "right": 10},
          "data": [{"name": "table"}],
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
                  "width": {"scale": "x", "band": true, "offset": -1}
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
                  "width": {"scale": "x", "band": true, "offset": 6},
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
  "data": [{"name": "table"}],
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
          "width": {"scale": "x", "band": true, "offset": -1}
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
          "width": {"scale": "x", "band": true, "offset": 6},
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

var data = {table: [
  {"x": 1,  "y": 28}, {"x": 2,  "y": 55},
  {"x": 3,  "y": 43}, {"x": 4,  "y": 91},
  {"x": 5,  "y": 81}, {"x": 6,  "y": 53},
  {"x": 7,  "y": 19}, {"x": 8,  "y": 87},
  {"x": 9,  "y": 52}, {"x": 10, "y": 48},
  {"x": 11, "y": 24}, {"x": 12, "y": 49},
  {"x": 13, "y": 87}, {"x": 14, "y": 66},
  {"x": 15, "y": 17}, {"x": 16, "y": 27},
  {"x": 17, "y": 68}, {"x": 18, "y": 16},
  {"x": 19, "y": 49}, {"x": 20, "y": 75}
]};

function refreshViz() {
    if (!viewModel.spec) return;
    vg.parse.spec(viewModel.spec, function(chart) {
      var view = chart({el:"#view", data:data})
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
    });
}

var viewModel;
$(document).ready(function() {
    // create the viewModel (complete spec?) and build a matching UI
    viewModel = {
        spec: availableStyles[0].style,  // see above
        data: data,  // see above
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
    viewModel.spec = styleInfo.style;
    refreshViz();
}
