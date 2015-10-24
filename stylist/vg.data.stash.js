/* 
 * Store the incoming data (if it's not already found) in the specified object
 * using the specified key, then pass it along unchanged.
 *
 * This is a "do-nothing" data transform to allow caching of intermediate results
 * from within a Vega pipeline (a series of transforms). The intent is to
 * support a much faster pipeline for frequently modified visualizations, as
 * used in the Tree Illustrator project:
 *   https://github.com/OpenTreeOfLife/tree-illustrator
 * 
 * Note that this transform doesn't concern itself with the details of the caching 
 * mechanism; it's assumed to be an existing Javascript object (associative
 * array) that functions as a simple key/value store. Similarly, the host
 * application is responsible for defining idempotent keys for cached data.
 * 
 * Also, note that this doesn't *retrieve* cached data or speed things up on
 * its own! Instead, by feeding a cache it enables the host application to
 * construct a simpler pipeline by providing cached data instead of URLs,
 * omitting unneeded transforms, etc.
 */
var vg  = require('vega'),
    log  = require('vega-logging'),
    dl = require('datalib'),
    Transform = require('vega/src/transforms/Transform');

function Stash(graph) {
  Transform.prototype.init.call(this, graph);
  Transform.addParameters(this, {
      cachePath: {type: 'value'},
      key: {type: 'value'},
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

var prototype = (Stash.prototype = Object.create(Transform.prototype));
prototype.constructor = Stash;

prototype.transform = function(input) {
  log.debug(input, ['stashing']);
/*
  console.log("INCOMING data to stash transform:");
  console.log(input);
  
  console.log("  cachePath:");
  console.log(this.param('cachePath'));
  console.log(this.param('cachePath').field);

  console.log("  key:");
  console.log(this.param('key'));

  console.log("  flush:");
  console.log(this.param('flush'));
*/

  var g = this._graph,
      cachePath = this.param('cachePath'),
      cache = eval(cachePath),
      key = this.param('key'),
      flush = this.param('flush');

  if (!cache || (typeof cache !== 'object')) {
    // if an invalid cache path is submitted, treat this as a no-op
    console.warn('stash transform: no cache found in eval('+ cachePath +')! skipping this data');
    return input;
  }

  /* Stash the complete, current data. Note that we actually store a *copy* of
   * the data, since Vega always clones data in a spec (see comment above).
   */
  if (flush || !(key in cache)) {
    // be sure to cache the "raw" data as returned from source
    // NOTE that g.dataValues() is a hash with n ids!
    // for now, let's stash the whole thing
    cache[ key ] = dl.duplicate(g.dataValues());
    // N.B. dl.duplicate cleans up any weird methods and circular references
/*
    for (var valueName in g.dataValues()) {
      var valueData = g.dataValues()[valueName];
          cache[ key ] = dl.duplicate(valueData);
      //if ('_data' in valueData) {
      //    cache[ key ] = dl.duplicate(valueData._data);
      //} else {
      //}
    }
*/
  }

/* OR should we stash data piecemeal, based on state??
  // move new (and possibly changed) data to the cache
  function set(x) {
    //move one datum (tuple?) into the cache
    console.log("setting '"+ x +"'...");
    //Tuple.set(x, field, expr(x, null, signals));
  }
  input.add.forEach(set);
  if (this.reevaluate(input)) {
    input.mod.forEach(set);
  }
*/
  return input;
};

module.exports = Stash;

Stash.schema = {
  "$schema": "http://json-schema.org/draft-04/schema#",
  "title": "Stash transform",
  "description": "Stores the incoming data (if it's not already found) in the" +
    " specified object using the specified key, then passes it along unchanged.",
  "type": "object",
  "properties": {
    "type": {"enum": ["stash"]},
    "cachePath": {
      "description": "A field pointing to the cache object",
      "oneOf": [{"type": "string"}, {"$ref": "#/refs/signal"}]  // TODO: signal?
    },
    "key": {
      "description": "A unique key for this data in the stash",
      "oneOf": [{"type": "string"}, {"$ref": "#/refs/signal"}]
    },
    "flush": {
      "description": "If true, will replace any existing stashed data.",
      "oneOf": [{"type": "boolean"}, {"$ref": "#/refs/signal"}],
      "default": false
    }
  },
  "additionalProperties": false,  // TODO: confirm this
  "required": ["type", "key", "cachePath"]
};
