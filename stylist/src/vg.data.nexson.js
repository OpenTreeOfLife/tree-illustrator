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
 *
 * NOTE that this output creates a basic layout with X and Y position for each
 * node, so any branch-rotation scheme (e.g. ladderized right) must be applied
 * here rather than downstream!
 */
var vg  = require('vega'),
    //d3  = require('d3'),
    log  = require('vega-logging'),
    Transform = require('vega/src/transforms/Transform');

function Nexson(graph) {
  Transform.prototype.init.call(this, graph);
  Transform.addParameters(this, {
      // N.B. we need either `treeID` or both `*Position` args below!
      treeID: {type: 'value'},
      treesCollectionPosition: {type: 'value', default: 0},
      treePosition: {type: 'value', default: 0},
      illustrationElementID: {type: 'value', default: ''},
      branchRotation: {type: 'value', default: 'UNCHANGED'},
      nodeLabelField: {type: 'value', default: 'originalLabel'}
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
      branchRotation = this.param('branchRotation'),
      nodeLabelField = this.param('nodeLabelField'),
      illustrationElementID = this.param('illustrationElementID'),
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
          var childNode = getPhyloNodeByID(childID);
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
  function countDescendantTips( node ) {
      /* Recurse through all descendants of this node and count the tips,
       * adding the total as an ad-hoc property of the node.
       *
       * Since these totals are often used in for branch rotation, we should be
       * able to pre-process nodes as needed, then run a final sweep that
       * only processes un-modified nodes.
       *
       * TODO: Count just tips? or all descendants?
       */
      if ('descendantTipCount' in node) {   // do this once only!
          return;
      }
      var children = getNexsonChildren(node);
      if (children.length === 0) {
          // this node is a leaf and should "count itself"
          node.descendantTipCount = 1;
      } else {
          var tipCount = 0;
          $.each(children, function(i, child) {
              countDescendantTips(child);
              tipCount += child.descendantTipCount;
          });
          node.descendantTipCount = tipCount;
      }
  }
  function assignNodeLabels( node ) {
      /* Add the various properties that might be shown as labels. Since these
       * can also be used in an alphabetical sort (for branch rotation), we
       * should be able to pre-process these as needed, followed by a final
       * sweep that just processes any un-modified nodes.
       */
      if ('originalLabel' in node) {   // do this once only!
          return;
      }
      /* N.B. It's best to provide at least an empty string for all
       * properties, to avoid showing 'undefined' labels in some browsers.
       */
      node.explicitLabel = '';
      node.originalLabel = '';
      node.ottTaxonName = '';
      node.ottId = '';
      if ('label' in node) {
        console.log(">> this node has 'label'");
        node.explicitLabel = node['label'];
      }
      if ('@label' in node) {
        console.log(">> this node has '@label'");
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
  };
  function assignNodeStyles(node) {
      /* Reckon effective style values per node, to support node- and
       * clade-specific styling.
       */
      if ('effectiveStyles' in node) {   // do this once only!
          return;
      }
      node.effectiveStyles = stylist.ill.gatherAllEffectiveStyles(node);
  }
  function assignEdgeStyles(edge) {
      /* Reckon effective style values per node, to support node- and
       * clade-specific styling.
       */
      if ('effectiveStyles' in edge) {   // do this once only!
          return;
      }
      /*
      edge.effectiveStyles = {
          "edgeThickness": stylist.ill.getEffectiveStyle(edge, 'edgeThickness'),
          "edgeColor": stylist.ill.getEffectiveStyle(edge, 'edgeColor')
      }
      */
      edge.effectiveStyles = stylist.ill.gatherAllEffectiveStyles(edge);
  }

  function getPhyloNodeByID(id) {
      // There should be only one matching node (or none) within a tree.
      // (NOTE that we now use a flat collection across all trees, so there's no 'tree' argument)
      var lookup = getFastLookup('NODES_BY_ID');
      return lookup[ id ] || null;
  }
  //function getPhyloNodeByTaxon = function( tree, idOrLabel ) {
  //function getPhyloNodeByValue = function( tree, idOrLabel ) {
  function getPhyloNodesByLabel(label) {
      /* Return any nodes that match the specified string in ANY label field
       * N.B. that we will accept a regex here, for fast retrieval of multiple
       * labeled nodes, e.g. to reckon their MRCA
       */
      var phylotree = this;
      var matchingNodes = [ ];
      // Convert string to regex (OK for incoming regex, too)
      label = RegExp(label, 'i');
      // Check label attributes, taxon names, etc.
      $.each(phylotree.phyloNodes, function(i, node) {
          // N.B. Regex test is very forgiving of non-string args.
          if (label.test(node.ottTaxonName) ||
              label.test(node.ottId) ||
              label.test(node.explicitLabel) ||
              label.test(node.originalLabel)) {
              matchingNodes.push(node);
          }
      });
      return matchingNodes;
  }

  function getPhyloNodeAncestry(node) {
      // Gather all ancestor nodes, from tip (or target node) to root
      var ancestors = [ ];
      while (node.parent) {
          ancestors.push(node.parent);
          node = node.parent;
      };
      return ancestors;
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

    /* Apply the chosen branch-rotation method, i.e. how child nodes are
     * ordered within the tree. Note that all options here should be
     * deterministic; the same input tree and rotation method should *always*
     * produce the same output. We'll accomplish this by using d3's
     * alphabetical sort as the tie-breaker.
     *
     * Some of these methods introduce new burdens:
     *  - Sorting by clade size means we need to recurse and count children for
     *    all nodes ahead of time.
     *  - Alpha-sorting uses active node labels, so we need to know them.
     *
     * The method choices below are enumerated in TreeIllustrator.js, so any
     * changes should be shared in both places.
     */
    var branchRotator;
    switch(branchRotation) {
        case 'UNCHANGED':
            branchRotator = null;
            break;
        case 'ALPHABETICAL':
            branchRotator = function(a,b) {
                // sort based on the user's chosen field (passed as param)
                assignNodeLabels(a);
                assignNodeLabels(b);
                return d3.descending(a[ nodeLabelField ], b[ nodeLabelField ]);
            };
            break;
        case 'LADDERIZE_RIGHT':
            branchRotator = function(a,b) {
                countDescendantTips(a);
                countDescendantTips(b);
                if (a.descendantTipCount > b.descendantTipCount) return -1;
                if (b.descendantTipCount > a.descendantTipCount) return 1;
                // Still here? Fall back to alphabetic sort
                assignNodeLabels(a);
                assignNodeLabels(b);
                return d3.descending(a[ nodeLabelField ], b[ nodeLabelField ]);
            };
            break;
        case 'LADDERIZE_LEFT':
            branchRotator = function(a,b) {
                countDescendantTips(a);
                countDescendantTips(b);
                if (a.descendantTipCount > b.descendantTipCount) return 1;
                if (b.descendantTipCount > a.descendantTipCount) return -1;
                // Still here? Fall back to alphabetic sort
                assignNodeLabels(a);
                assignNodeLabels(b);
                return d3.descending(a[ nodeLabelField ], b[ nodeLabelField ]);
            };
            break;
        case 'ZIG_ZAG':
            // Mimic the ladderize options above, but alternate left and right each time
            var leftOrRight = 'LEFT';
            branchRotator = function(a,b) {
                countDescendantTips(a);
                countDescendantTips(b);
                if (leftOrRight === 'LEFT') {
                    leftOrRight = 'RIGHT';
                    if (a.descendantTipCount > b.descendantTipCount) return 1;
                    if (b.descendantTipCount > a.descendantTipCount) return -1;
                } else {  // presumably it's 'RIGHT'
                    leftOrRight = 'LEFT';
                    if (a.descendantTipCount > b.descendantTipCount) return -1;
                    if (b.descendantTipCount > a.descendantTipCount) return 1;
                }
                // Still here? Fall back to alphabetic sort
                assignNodeLabels(a);
                assignNodeLabels(b);
                return d3.descending(a[ nodeLabelField ], b[ nodeLabelField ]);
            };
            break;
        default:
            console.error("No such branch-rotation method: '"+ branchRotation +"'!");
    }

    var layout = d3.layout.cluster()  // or tree (seems most basic)
                          .size([1.0, 1.0])  // just making the default size explicit
                          .separation(function(a,b) {
                               /* We want all tips (leaves) to be evenly spaced, whether or
                                * not they are siblings:
                                *   https://github.com/mbostock/d3/wiki/Cluster-Layout#separation
                                */
                               // return (a.parent == b.parent) ? 1 : 2;
                               return 1;
                           })
                           .children(getNexsonChildren)   // defined below
                           .sort(branchRotator),   // defined above
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
      console.warn("  illustrationElementID: "+ illustrationElementID);
      return false;
    }

    var phylotree = {
        // Copy _id of source data
        _id: fullNexson._id,
        rootNode: rootNode,
        // Add useful methods as well
        getPhyloNodeByID: getPhyloNodeByID,
        getPhyloNodesByLabel: getPhyloNodesByLabel
        //getPhyloNodeAncestry: getPhyloNodeAncestry
    };
    if (illustrationElementID) {
        /* IF we're in Tree Illustrator, add reciprocal pointers between this
         * phylotree and the corresponding IllustratedTree element.
         *
         * N.B. that this provides a vital bridge between two worlds: the
         * ephemeral objects here (within the Vega rendering pipline) and the
         * more persistent Illustration object model.
         */
        var illustratedTree = stylist.ill.getElementByID(illustrationElementID);
        phylotree.illustratedTree = illustratedTree;
        illustratedTree.phylotree = phylotree;
    }

    console.warn("CREATING phyloNodes");
    phylotree.phyloNodes = layout
      //.size(vg.data.size(size, group))
      //.value(value)
        .nodes(rootNode);

    /* Normalize the node locations to fill the specified area. This will
     * ensure that the rendered tree matches our user's chosen size, and that
     * radial trees don't have weird gaps.
     */
    var minX = Number.POSITIVE_INFINITY,
        minY = Number.POSITIVE_INFINITY,
        maxX = Number.NEGATIVE_INFINITY,
        maxY = Number.NEGATIVE_INFINITY;
    $.each(phylotree.phyloNodes, function(i, node) {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x);
        maxY = Math.max(maxY, node.y);
    });
    var xScale = 1.0 / (maxX - minX);
    var yScale = 1.0 / (maxY - minY);
    $.each(phylotree.phyloNodes, function(i, node) {
        // Add essential metadata (before assigning styles below)
        node.metadata = {type: 'phylonode'};
        if (illustrationElementID) {
            node.metadata.illustratedTreeID = illustrationElementID;
        }
        node.ancestry = getPhyloNodeAncestry(node);
        // Scale X/Y coordinates
        node.x = (node.x - minX) * xScale;
        node.y = (node.y - minY) * yScale;
        // Add misc. properties and all possible labels
        assignNodeLabels(node);
    });
    $.each(phylotree.phyloNodes, function(i, node) {
        assignNodeStyles(node);
        // TODO: Watch for divergent labels and styles (eg, when ladderizing)!
    });

    console.warn("CREATING phyloEdges");
    phylotree.phyloEdges = layout.links(phylotree.phyloNodes);
    $.each(phylotree.phyloEdges, function(i, edge) {
        // Add essential metadata (before assigning styles below)
        edge.metadata = {type: 'phyloedge'};
        if (illustrationElementID) {
            edge.metadata.illustratedTreeID = illustrationElementID;
        }
    });
    $.each(phylotree.phyloEdges, function(i, edge) {
        // Add misc. properties
        assignEdgeStyles(edge);
        // TODO: Watch for divergent labels and styles (eg, when ladderizing)!
        ///console.log(edge.effectiveStyles);
    });

/* translate incoming keys to their output names?
    var keys = vg.keys(output),
        len = keys.length;

    phylotree.forEach(function(d) {
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
    console.log("OUTGOING phylotree from nexson transform:");
    console.log(phylotree);
*/
    return phylotree;
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
               + " and d3.phylogram.js. NOTE: Requires `treeID` OR both `*Position` args!",
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
    },
    "illustrationElementID": {
      "description": "The ID of the corresponding IllustratedTree (Tree Illustrator only)",
      "oneOf": [{"type": "string"}, {"$ref": "#/refs/signal"}]  // TODO: signal?
    }
  },
  "additionalProperties": false,  // TODO: confirm this
  "required": ["type"]
};
