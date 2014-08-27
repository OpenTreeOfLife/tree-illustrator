/* 
 * A simple transform to grab the named property from a JS object (not an
 * array). This makes it easier to deal with hierarchical data with 
 * multiple "inner" datasets (eg, nodes and edges) and complex upstream
 * transforms.
 *
 * EXAMPLE:
 *    "from": {
 *      "data": "phyloTree", 
 *      "transform": [
 *          {"type":"pluck", "field":"phyloNodes" }
 *      ] 
 *  },
 */
vg.data.pluck = function() {

  var field = null;

  function pluck(data) {    
    var result = field(data);
    return result;
  }
  
  pluck.field = function(f) {
    field = vg.accessor(f);
    return pluck;
  };

  return pluck;
};
