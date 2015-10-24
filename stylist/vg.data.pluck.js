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
var vg  = require('vega'),
    log  = require('vega-logging'),
    Transform = require('vega/src/transforms/Transform');

function Pluck(graph) {
  Transform.prototype.init.call(this, graph);
  Transform.addParameters(this, {
      field: {type: 'field'}
  });
  // TODO: confirm that this is appropriate here
  return this.mutates(true);
}

var prototype = (Pluck.prototype = Object.create(Transform.prototype));
prototype.constructor = Pluck;

prototype.transform = function(input) {
  log.debug(input, ['plucking']);

  var g = this._graph,
      field = this.param('field');
  
  var output = field.accessor(input);
  if (output) {
    return output;
  }

  console.warn('pluck transform: unable to resolve this field ('+ field.field +')! returning input');
  return input;
};

module.exports = Pluck;

Pluck.schema = {
  "$schema": "http://json-schema.org/draft-04/schema#",
  "title": "Pluck transform",
  "description": "Grabs a property (or deeper path) from a hierarchy.",
  "type": "object",
  "properties": {
    "type": {"enum": ["pluck"]},
    "field": {
      "description": "Which field of the data you want to select.",
      "oneOf": [{"type": "field"}, {"$ref": "#/refs/signal"}]  // TODO: signal?
    }
  },
  "additionalProperties": false,
  "required": ["type", "field"]
};

/*
vg.transforms.pluck = function() {

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
*/
