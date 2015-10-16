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
vg.transforms.stash = function(test) {
  //var data = vg.accessor("data");      // incoming data to be (possibly) cached
  var data;

  /* N.B. Vega always duplicates the incoming spec:
   *   https://github.com/trifacta/vega/blob/e8013b855ef8331d1a07b9ef266cc8fc2738e436/src/parse/spec.js#L7
   * ... so we can't accept the object itself as the incoming 'cache' argument,
   * or we'll just end up stashing to a clone. Instead, we expect 'cachePath' with
   * a dot-delimited path, like so:
   *
   *    treeData.transform.push({
   *        "type": "stash", 
   *        "cachePath": 'TreeIllustrator.cache',
   *        "key": treeSourceCacheKey,
   *        "flush": false
   *    });
   *
   * (This example should point to an object at window.TreeIllustrator.cache)
   */
  var cache;     // the cache itself (an associative array)

  // Expected arguments (and defaults for each)
  var key = '',         // an idempotent key for this data
      flush = false;    // if true, force new data into the cache

  function stash(data) {
console.log("INCOMING data to stash transform:");
console.log(data);
/*
*/
    
    if (typeof cache === 'undefined') {
        console.error('No cache has been set for the vg.transforms.stash transform!');
        return data;
    }
    /* Note that we always store a *copy* of the data, since Vega always clones
     * data in a spec (see comment above).
     */
    if (flush || !(key in cache)) {
        // be sure to cache the "raw" data as returned from source
        if ('data' in data) {
            cache[ key ] = vg.duplicate(data.data);
        } else {
            cache[ key ] = vg.duplicate(data);
        }
        // N.B. vg.duplicate cleans up any weird methods and circular references
    }

    console.log("OUTGOING data from stash transform:");
    console.log(data);
/*
*/
    return data;
  }

  // Expose methods to accept variables from Vega spec
  stash.cachePath = function(f) {
    // we pass a string here, to use a persistent cache and not Vega's copy
    var getCache = vg.accessor(f);
    cache = getCache(window);
    return stash;
  };
  stash.key = function(s) {
    key = String(s);
    return stash;
  };
  stash.flush = function(b) {
    flush = Boolean(b);
    return stash;
  };

  return stash;
};
