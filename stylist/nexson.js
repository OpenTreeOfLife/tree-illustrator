/* 
 * Transform NEXson data into a form suitable for use in the Tree Illustrator
 * and d3.phylogram.js. This extends the Vega's vg.data space so we can take
 * advantage of its pipeline and other features. It's patterned after the 
 * project's treemap.js, which also does transformation tied to a specific 
 * d3 representation.
 */
vg.data.nexson = function() {
  var layout = d3.layout.treemap()
                 //.children(function(d) { return d.values; }),
                 .children(getChildren),  // below
      value = vg.accessor("data"),
      size = ["width", "height"],
      params = ["round", "sticky", "ratio", "padding"],
      output = {
        "x": "x",
        "y": "y",
        "dx": "width",
        "dy": "height"
      };

  // Expect the ID of the specified tree, or the position of the specified
  // trees collection and tree.
  var treeID = null,
      treesCollectionPosition = 0,
      treePosition = 0;

  function nexson(data, db, group) {
debugger;
    data = layout
      .size(vg.data.size(size, group))
      .value(value)
      .nodes(vg.isTree(data) ? data : {values: data});
    
    var keys = vg.keys(output),
        len = keys.length;

    data.forEach(function(d) {
      var key, val;
      for (var i=0; i<len; ++i) {
        key = keys[i];
        if (key !== output[key]) {
          val = d[key];
          delete d[key];
          d[output[key]] = val;
        }
      }
      d.children = getChildren(d);
    });
    
    return data;
  }

  nexson.size = function(sz) {
debugger;
    size = sz;
    return nexson;
  };

  nexson.value = function(field) {
debugger;
    value = vg.accessor(field);
    return nexson;
  };

  params.forEach(function(name) {
    nexson[name] = function(x) {
      layout[name](x);
      return nexson;
    }
  });

  // stolen from facet.js
  nexson.keys = function(k) {
debugger;
    keys = vg.array(k).map(vg.accessor);
    return nexson;
  };
  nexson.sort = function(s) {
debugger;
    sort = vg.data.sort().by(s);
    return nexson;
  };

  // Expose methods to accept tree ID (or ordinal position of the 
  // desired trees collection and a tree within it).
  nexson.treeID = function(s) {
    treeID = s;
    return nexson;
  };
  nexson.treesCollectionPosition = function(n) {
    treesCollectionPosition = n;
    return nexson;
  };
  nexson.treePosition = function(n) {
    treePosition = n;
    return nexson;
  };

  function getChildren(node) {
    debugger;
    return [];
  }

  nexson.output = function(map) {
debugger;
    // build children
    vg.keys(output).forEach(function(k) {
      if (map[k] !== undefined) {
        output[k] = map[k];
      }
    });
    return nexson;
  };

  return nexson;
};
