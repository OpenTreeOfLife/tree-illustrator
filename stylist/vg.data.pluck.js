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
      cachePath: {type: 'field'},  // TODO: 'field' or 'value' here?
      key: {type: 'value'},  // TODO?
      flush: {type: 'value', default: false}
  });
  /* TODO: which (if any) of these is appropriate to return?
  this.router(true);
  return this.router(true).produces(true);
  return this.mutates(true);
  debugger;
  return this.router(true);
  */
}

var prototype = (Pluck.prototype = Object.create(Transform.prototype));
prototype.constructor = Pluck;

prototype.transform = function(input) {
  log.debug(input, ['plucking']);

  /* TODO
  if (input.add.length || input.mod.length || input.rem.length) {
    input.sort = dl.comparator(this.param('by').field);
  }
  */
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
    /* TODO: review params
    "cachePath": {
      "description": "A field pointing to the cache object",
      "oneOf": [{"type": "string"}, {"$ref": "#/refs/signal"}]  // TODO: signal?
    },
    "key": {
      "description": "A unique key for this data in the stash",
      "oneOf": [{"type": "string"}, {"$ref": "#/refs/signal"}]  // TODO: signal?
    },
    "flush": {
      "description": " If true, will replace any existing stashed data.", // TODO: confirm
      "oneOf": [{"type": "boolean"}, {"$ref": "#/refs/signal"}],
      "default": false
    }
    */
  },
  "additionalProperties": false,  // TODO: confirm this
  "required": ["type"]  // TODO: review params
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
