/* 
 * Store the incoming data (if it's not already found) using the specified
 * function and key, then pass it along unchanged.
 *
 * This is a "do-nothing" data transform to allow caching of intermediate results
 * from within a Vega pipeline (a series of transforms). The intent is to
 * support a much faster pipeline for frequently modified visualizations, as
 * used in the Tree Illustrator project:
 *   https://github.com/OpenTreeOfLife/tree-illustrator
 * 
 * Note that this transform doesn't concern itself with the details of the caching 
 * mechanism; it's assumed to be an existing key/value store, perhaps a simple
 * associative array or something smarter. Similarly, the host application is
 * responsible for defining idempotent keys for cached data.
 * 
 * Also, note that this doesn't *retrieve* cached data or speed things up on
 * its own! Instead, by feeding a cache it enables the host application to
 * construct a simpler pipeline by providing cached data instead of URLs,
 * omitting unneeded transforms, etc.
 */
var vg  = require('vega'),
    log  = require('vega-logging'),
    assert = require('assert'),
    dl = require('datalib'),
    Transform = require('vega/src/transforms/Transform');

function Stash(graph) {
  Transform.prototype.init.call(this, graph);
  Transform.addParameters(this, {
      cacheSetter: {type: 'value'},
      key: {type: 'value'},
      flush: {type: 'value', default: false}
  });

  return this;
  // TODO: add calls to mutates(), router()?
}

var prototype = (Stash.prototype = Object.create(Transform.prototype));
prototype.constructor = Stash;

prototype.transform = function(input) {
  log.debug(input, ['stashing']);

  var cacheSetter = this.param('cacheSetter'),
      setCacheItem = eval(cacheSetter),
      key = this.param('key'),
      flush = this.param('flush');

  if (!setCacheItem || (typeof setCacheItem !== 'function')) {
    // if an invalid cache setter is submitted, treat this as a no-op
    console.warn('stash transform: no callable/function found in eval('+ cacheSetter +')! skipping this data');
    return input;
  }

  // For now, this transform ASSUMES just one incoming tuple.
  assert(input.add.length > 0,
         "The stash transform expects an added datum (none found).");
  assert((input.add.length < 2 &&
          input.mod.length === 0 &&
          input.rem.length === 0),
         "The stash transform only stores a single added datum.");

  /* Stash a single incoming datum. Note that we actually store a *copy* of
   * the data, since Vega always clones data in a spec (see comment above).
   * Be sure to cache the "raw" data as returned from source!
   */
  var rawValue = dl.duplicate(input.add[0]);
  // N.B. dl.duplicate cleans up any weird methods and circular references
  setCacheItem( key, rawValue, flush);

/* OR should we stash all data piecemeal, based on state??
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
    "cacheSetter": {
      "description": "The (full, global) name of a cache's setter function",
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
  "required": ["type", "key", "cacheSetter"]
};
