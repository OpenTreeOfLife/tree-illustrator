/* 
 * Transform NEXson data into a form suitable for use in the Tree Illustrator
 * and d3.phylogram.js. This extends the Vega's vg.data space so we can take
 * advantage of its pipeline and other features. It's patterned after the 
 * project's treemap.js, which also does transformation tied to a specific 
 * d3 representation.
 * 
 * Anticipate other importers like this one for NEXML, etc. (assumes JSON? or
 * can we parse free-form text? YES, since vega handles CSV, etc.). Each one 
 * should produce the same output: a uniform JS object representing a
 * d3-ready tree (see https://github.com/OpenTreeOfLife/tree-illustrator/wiki/Building-on-D3-and-Vega#data-importers)
 */
var vg  = require('vega'),
    //d3  = require('d3'),
    log  = require('vega-logging'),
    Transform = require('vega/src/transforms/Transform');

function Nexson(graph) {
  Transform.prototype.init.call(this, graph);
  Transform.addParameters(this, {
      treeID: {type: 'value'},
      treesCollectionPosition: {type: 'value', default: 0},
      treePosition: {type: 'value', default: 0}
  });
  return this.produces(true)
             .mutates(true);
}

var prototype = (Nexson.prototype = Object.create(Transform.prototype));
prototype.constructor = Nexson;

prototype.transform = function(input) {
  log.debug(input, ['converting to nexson']);

  var treeID = this.param('treeID'),
      treesCollectionPosition = this.param('treesCollectionPosition'),
      treePosition = this.param('treePosition'),
      nexml = null;

  /*
   * NEXson-specific logic, encapsulated for easy access to nexml, etc.
   *
   * Adapted from https://github.com/OpenTreeOfLife/opentree/blob/79aa1f4f72940c0f5708fd2ced56190d8c34ad9a/curator/static/js/study-editor.js
   */
  var fastLookups = {
      'NODES_BY_ID': null,
      'OTUS_BY_ID': null,
      'EDGES_BY_SOURCE_ID': null,
      'EDGES_BY_TARGET_ID': null
  };
  function getFastLookup( lookupName ) {
      // return (or build) a flat list of Nexson elements by ID
      if (lookupName in fastLookups) {
          if (fastLookups[ lookupName ] === null) {
              buildFastLookup( lookupName );
          }
          return fastLookups[ lookupName ];
      }
      console.error("No such lookup as '"+ lookupName +"'!");
      return null;
  }
  function buildFastLookup( lookupName ) {
      // (re)build and store a flat list of Nexson elements by ID
      if (lookupName in fastLookups) {
          clearFastLookup( lookupName );
          var newLookup = {};
          switch( lookupName ) {

              case 'NODES_BY_ID':
                  // assumes that all node ids are unique, across all trees
                  var allTrees = [];
                  $.each(nexml.trees, function(i, treesCollection) {
                      $.each(treesCollection.tree, function(i, tree) {
                          allTrees.push( tree );
                      });
                  });
                  $.each(allTrees, function( i, tree ) {
                      $.each(tree.node, function( i, node ) {
                          var itsID = node['@id'];
                          if (itsID in newLookup) {
                              console.warn("Duplicate node ID '"+ itsID +"' found!");
                          }
                          newLookup[ itsID ] = node;
                      });
                  });
                  break;

              case 'OTUS_BY_ID':
                  // assumes that all node ids are unique, across all trees
                  // AND 'otus' collections!
                  $.each(nexml.otus, function( i, otusCollection ) {
                      $.each(otusCollection.otu, function( i, otu ) {
                          var itsID = otu['@id'];
                          if (itsID in newLookup) {
                              console.warn("Duplicate otu ID '"+ itsID +"' found!");
                          }
                          newLookup[ itsID ] = otu;
                      });
                  });
                  break;

              case 'EDGES_BY_SOURCE_ID':
                  // allow multiple values for each source (ie, multiple children)
                  var allTrees = [];
                  $.each(nexml.trees, function(i, treesCollection) {
                      $.each(treesCollection.tree, function(i, tree) {
                          allTrees.push( tree );
                      });
                  });
                  $.each(allTrees, function( i, tree ) {
                      $.each(tree.edge, function( i, edge ) {
                          var sourceID = edge['@source'];
                          if (sourceID in newLookup) {
                              newLookup[ sourceID ].push( edge );
                          } else {
                              // create the array, if not found
                              newLookup[ sourceID ] = [ edge ];
                          }
                      });
                  });
                  break;

              case 'EDGES_BY_TARGET_ID':
                  // allow multiple values for each target (for conflicted trees)
                  var allTrees = [];
                  $.each(nexml.trees, function(i, treesCollection) {
                      $.each(treesCollection.tree, function(i, tree) {
                          allTrees.push( tree );
                      });
                  });
                  $.each(allTrees, function( i, tree ) {
                      $.each(tree.edge, function( i, edge ) {
                          var targetID = edge['@target'];
                          if (targetID in newLookup) {
                              newLookup[ targetID ].push( edge );
                          } else {
                              // create the array, if not found
                              newLookup[ targetID ] = [ edge ];
                          }
                      });
                  });
                  break;

          }
          fastLookups[ lookupName ] = newLookup;
      } else {
          console.error("No such lookup as '"+ lookupName +"'!");
      }
  }
  function clearFastLookup( lookupName ) {
      // clear chosen lookup, on demand (eg, after merging in new OTUs)
      if (lookupName === 'ALL') {
          for (var aName in fastLookups) {
              fastLookups[ aName ] = null;
          }
          return;
      } else if (lookupName in fastLookups) {
          fastLookups[ lookupName ] = null;
          return;
      }
      console.error("No such lookup as '"+ lookupName +"'!");
  }
  function getNexsonChildren(d) {
      var parentID = d['@id'];
      var itsChildren = [];
      var childEdges = getTreeEdgesByID(null, parentID, 'SOURCE');

      // If this node has one child, it's probably a latent root-node that
      // should be hidden in the tree view.
      if (childEdges.length === 1) {
          // treat ITS child node as my immediate child in the displayed tree
          var onlyChildNodeID = childEdges[0]['@target'];
          childEdges = getTreeEdgesByID(null, onlyChildNodeID, 'SOURCE');
      }

      $.each(childEdges, function(index, edge) {
          var childID = edge['@target'];
          var childNode = getTreeNodeByID(childID);
          if (!('@id' in childNode)) {
              console.error(">>>>>>> childNode is a <"+ typeof(childNode) +">");
              console.error(childNode);
          }
          itsChildren.push( childNode );
      });
      // N.B. D3 layouts expect null, instead of an empty array
      ///return (itsChildren.length === 0) ? null: itsChildren;
      return itsChildren;
  }
  function getTreeNodeByID(id) {
      // There should be only one matching (or none) within a tree
      // (NOTE that we now use a flat collection across all trees, so there's no 'tree' argument)
      var lookup = getFastLookup('NODES_BY_ID');
      return lookup[ id ] || null;
  }
  function getOTUByID(id) {
      // There should be only one matching (or none) in this study
      var lookup = getFastLookup('OTUS_BY_ID');
      return lookup[ id ] || null;
  }
  function getTreeEdgesByID(tree, id, sourceOrTarget) {
      // look for any edges associated with the specified *node* ID; return
      // an array of 0, 1, or more matching edges within a tree
      //
      // 'sourceOrTarget' lets us filter, should be 'SOURCE', 'TARGET', 'ANY'
      var foundEdges = [];
      var matchingEdges = null;

      if ((sourceOrTarget === 'SOURCE') || (sourceOrTarget === 'ANY')) {
          // fetch and add edges with this source node
          var sourceLookup = getFastLookup('EDGES_BY_SOURCE_ID');
          matchingEdges = sourceLookup[ id ];
          if (matchingEdges) {
              foundEdges = foundEdges.concat( matchingEdges );
          }
      }

      if ((sourceOrTarget === 'TARGET') || (sourceOrTarget === 'ANY')) {
          // fetch and add edges with this target node
          var targetLookup = getFastLookup('EDGES_BY_TARGET_ID');
          matchingEdges = targetLookup[ id ];
          if (matchingEdges) {
              foundEdges = foundEdges.concat( matchingEdges );
          }
      }

      return foundEdges;
  }
  function getSpecifiedTree() {
    var tree = null;
    // try all incoming options to locate this tree
    if ($.trim(treeID) !== '') {
        tree = getTreeByID(treeID);
    } else {
        tree = getTreeByPosition(treesCollectionPosition, treePosition);
    }
    return tree;
  }
  function getTreeByID(id) {
      var allTrees = [];
      if (!nexml) {
          return null;
      }
      $.each(nexml.trees, function(i, treesCollection) {
          $.each(treesCollection.tree, function(i, tree) {
              allTrees.push( tree );
          });
      });
      var foundTree = null;
      $.each( allTrees, function(i, tree) {
          if (tree['@id'] === id) {
              foundTree = tree;
              return false;
          }
      });
      return foundTree;
  }
  function getTreeByPosition(collectionPos, treePos) {
    var collection = nexml.trees[collectionPos];
    var tree = collection.tree[treePos];
    return tree;
  }
  function getRootNode() {
    // use options to find the root node, or return null
    var foundRoot = null;
    var tree = getSpecifiedTree();
    if (!tree) {
        return null;
    }
    var specifiedRoot = tree['^ot:specifiedRoot'] || null;
    var rootNodeID = specifiedRoot ? specifiedRoot : tree.node[0]['@id'];
    $.each(tree.node, function(i, node) {
        // Find the node with this ID and see if it has an assigned OTU
        if (node['@id'] === rootNodeID) {
            foundRoot = node;
            return false;
        }
    });
    return foundRoot;
  }
  /* END of 'NEXson-specific logic' */

  function convert(fullNexson) {
    // convert a new (or changed?) tree to Tree Illustrator's preferred format
    nexml = fullNexson.data.nexml;

    var layout = d3.layout.cluster()  // or tree (seems most basic)
                   .children(getNexsonChildren),  // below
        params = [ 'size' ],  // ["round", "sticky", "ratio", "padding"],
        output = {
          //"x": "x",
          //"y": "y",
          //"dx": "width",
          //"dy": "height"
        };

    var rootNode = getRootNode();  // defined below
    if (!rootNode) {
      console.warn("No root node found!");
      console.warn("  treeID: "+ treeID);
      console.warn("  treesCollectionPosition: "+ treesCollectionPosition);
      console.warn("  treePosition: "+ treePosition);
      return false;
    }

    data = {
        // copy _id of source data
        '_id': fullNexson._id
    };

    data.phyloNodes = layout
      //.size(vg.data.size(size, group))
      //.value(value)
        .nodes(rootNode);

    // add all possible labels to each node
    var tree = getSpecifiedTree();
    $.each(data.phyloNodes, function(i, node) {
      /* N.B. It's best to provide at least an empty string for all
       * properties, to avoid showing 'undefined' labels in some browsers.
       */
      node.explicitLabel = '';
      node.originalLabel = '';
      node.ottTaxonName = '';
      node.ottId = '';
      if ('label' in node) {
        console.log(">> node "+ i +" has 'label'");
        node.explicitLabel = node['label'];
      }
      if ('@label' in node) {
        console.log(">> node "+ i +" has '@label'");
        node.explicitLabel = node['@label'];
      }
      if ('@otu' in node) {
        var itsOTU = getOTUByID( node['@otu'] );
        // attach OTU with possible label(s) here
        if (itsOTU) {
          // nudge the relevant properties into a generic form
          if ('^ot:originalLabel' in itsOTU) {
            node.originalLabel = itsOTU['^ot:originalLabel'];
          }
          if ('^ot:ottTaxonName' in itsOTU) {
            node.ottTaxonName = itsOTU['^ot:ottTaxonName'];
          }
          if ('^ot:ottId' in itsOTU) {
            node.ottId = itsOTU['^ot:ottId'];
          }
          if ('@label' in itsOTU) {
            // This is uncommon, but appears in our converted Newick.
            // Yield to an explicit label on the node itself!
            console.log(">> stealing otu label '"+ itsOTU['@label'] +"' for this node");
            if ($.trim(node.explicitLabel) === '') {
              node.explicitLabel = itsOTU['@label'];
            }
          }
        }
      }
    });

    data.phyloEdges = layout.links(data.phyloNodes);
/* translate incoming keys to their output names?
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
      //d.children = getChildren(d);
    });
*/


/*
    console.log("OUTGOING data from nexson transform:");
    console.log(data);
*/
    return data;
  }
  
  //input.add.forEach(convert);
  for (var i = 0; i < input.add.length; i++) {
    // actually replace each item with the new stucture
    input.add[i] = convert(input.add[i]);
  }
  if (this.reevaluate(input)) {
    //input.mod.forEach(convert);
    for (var i = 0; i < input.mod.length; i++) {
      // actually replace each item with the new stucture
      input.mod[i] = convert(input.mod[i]);
    }
  }
  // return the modified ChangeSet
  return input;
};

module.exports = Nexson;

Nexson.schema = {
  "$schema": "http://json-schema.org/draft-04/schema#",
  "title": "Nexson transform",
  "description": "Transforms NEXson data into a form suitable for use in the Tree Illustrator"
               + " and d3.phylogram.js.",
  "type": "object",
  "properties": {
    "type": {"enum": ["nexson"]},
    "treeID": {
      "description": "An explicit tree ID (should be definitive)",
      "oneOf": [{"type": "string"}, {"$ref": "#/refs/signal"}]  // TODO: signal?
    },
    "treesCollectionPosition": {
      "description": "Look in the nth 'trees' element (collection of 'tree')",
      "oneOf": [{"type": "integer"}, {"$ref": "#/refs/signal"}],  // TODO: signal?
      "default": 0
    },
    "treePosition": {
      "description": "Convert the nth 'tree' found in this collection", // TODO: confirm
      "oneOf": [{"type": "integer"}, {"$ref": "#/refs/signal"}],
      "default": 0
    }
  },
  "additionalProperties": false,  // TODO: confirm this
  "required": ["type"]  // TODO: add required params
};







if (false) {

vg.transforms.nexson = function() {
  var layout = d3.layout.cluster()  // or tree (seems most basic)
                 //.children(function(d) { return d.values; }),
                 //.size([20,20])  // defaults to [1.0, 1.0]
                 .children(getNexsonChildren),  // below
      value = vg.accessor("data"),
      fullNexson = null,
      nexml = null,
      //size = ["width", "height"],
      params = [ 'size' ],  // ["round", "sticky", "ratio", "padding"],
      output = {
        //"x": "x",
        //"y": "y",
        //"dx": "width",
        //"dy": "height"
      };

  // Expect the ID of the specified tree, or the position of the specified
  // trees collection and tree.
  var treeID = null,
      treesCollectionPosition = 0,
      treePosition = 0;

  function nexson(data, db, group) {
/*
console.log("INCOMING data to nexson transform:");
console.log(data);
*/
    fullNexson = data['data'];  // stash the complete NEXson!
    nexml = fullNexson.data.nexml;
    var rootNode = getRootNode();  // defined below
    if (!rootNode) {
        console.warn("No root node found!");
        console.warn("  treeID: "+ treeID);
        console.warn("  treesCollectionPosition: "+ treesCollectionPosition);
        console.warn("  treePosition: "+ treePosition);
        return false;
    }

    data = {};

    data.phyloNodes = layout
      //.size(vg.data.size(size, group))
      //.value(value)
      .nodes(rootNode);

    // add all possible labels to each node
    var tree = getSpecifiedTree();
    $.each(data.phyloNodes, function(i, node) {
        /* N.B. It's best to provide at least an empty string for all
         * properties, to avoid showing 'undefined' labels in some browsers.
         */
        node.explicitLabel = '';
        node.originalLabel = '';
        node.ottTaxonName = '';
        node.ottId = '';
        if ('label' in node) {
            console.log(">> node "+ i +" has 'label'");
            node.explicitLabel = node['label'];
        }
        if ('@label' in node) {
            console.log(">> node "+ i +" has '@label'");
            node.explicitLabel = node['@label'];
        }
        if ('@otu' in node) {
            var itsOTU = getOTUByID( node['@otu'] );
            // attach OTU with possible label(s) here
            if (itsOTU) {
                // nudge the relevant properties into a generic form
                if ('^ot:originalLabel' in itsOTU) {
                    node.originalLabel = itsOTU['^ot:originalLabel'];
                }
                if ('^ot:ottTaxonName' in itsOTU) {
                    node.ottTaxonName = itsOTU['^ot:ottTaxonName'];
                }
                if ('^ot:ottId' in itsOTU) {
                    node.ottId = itsOTU['^ot:ottId'];
                }
                if ('@label' in itsOTU) {
                    // This is uncommon, but appears in our converted Newick.
                    // Yield to an explicit label on the node itself!
                    if ($.trim(node.explicitLabel) === '') {
                        console.log(">> stealing otu label '"+ itsOTU['@label'] +"' for this node");
                        node.explicitLabel = itsOTU['@label'];
                    } else {
                        console.log(".. existing explicitLabel: "+ node.explicitLabel);
                    }
                }
            }
        }
    });
    
    data.phyloEdges = layout.links(data.phyloNodes);
/* translate incoming keys to their output names?
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
      //d.children = getChildren(d);
    });
*/

    
/*
    console.log("OUTGOING data from nexson transform:");
    console.log(data);
*/
    return data;
  }

  nexson.value = function(field) {
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
    keys = vg.array(k).map(vg.accessor);
    return nexson;
  };
  nexson.sort = function(s) {
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

    /*
     * NEXson-specific logic, encapsulated for easy access to nexml, etc.
MOVED
     */

  nexson.output = function(map) {
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

}


