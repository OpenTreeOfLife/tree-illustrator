/*
  (Heavily) adapted from Ken-ichi Ueda's 'd3.phylogram.js'

  Wrapper around a d3-based phylogram (tree where branch lengths are scaled),
  refactored into a Vega transform. What does this change?
    - Returns transformed data (an object with nodes and links, projected to
      the coordinate space based on the chosen layout).
    - Assumes all incoming data has proportional x/y values (0.0 to 1.0).
    - Doesn't render anything! Just passes the projected data for downstream
      rendering.

  This includes new and modified layouts, including
    - radial (circular) layout with *scaled* branch lengths
    - a traditional cladogram with straight, diagonal edges

  Copyright (c) 2014, Jim Allman
  Copyright (c) 2013, Ken-ichi Ueda

  All rights reserved.

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

  Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer. Redistributions in binary
  form must reproduce the above copyright notice, this list of conditions and
  the following disclaimer in the documentation and/or other materials
  provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
  LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
  CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
  SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
  INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
  CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
  POSSIBILITY OF SUCH DAMAGE.

  DOCUMENTATION

  buildCartesian(nodes, links, options)
    Creates a phylogram.
    Arguments:
      nodes: JS array of nodes
      links: JS array of links
    Options:
      tree
        Pre-constructed d3 tree layout.
      diagonal
        Function that creates the d attribute for an svg:path. Defaults to a
        right-angle diagonal.
      skipTicks
        Skip the tick rule.
      skipBranchLengthScaling
        Make a dendrogram instead of a phylogram.
  
  buildRadial(nodes, links, options)
    Creates a radial dendrogram.
    Options: same as build, but without diagonal, skipTicks, and
      skipBranchLengthScaling
  
  buildCladogram(nodes, links, options)
    Creates a "triangular" dendrogram
    Options: TODO

  rightAngleDiagonal()
    Similar to d3.diagonal except it create an orthogonal crook instead of a
    smooth Bezier curve.
    
  radialRightAngleDiagonal()
    d3.phylogram.rightAngleDiagonal for radial layouts.
*/
var vg  = require('vega'),
    log  = require('vega-logging'),
    Transform = require('vega/src/transforms/Transform');

function Phylogram(graph) {
  Transform.prototype.init.call(this, graph);
  Transform.addParameters(this, {
    layout: {type: 'value', default: 'cartesian'},
    width: {type: 'value', default: 1.0},
    height: {type: 'value', default: 1.0},
    // some are only used in radial layout, ignored in others
    radius: {type: 'value', default: 0.5},
    radialArc: {type: 'array<value>', default: [0, 360]},
    radialSweep: {type: 'value', default: 'CLOCKWISE'},  // 'CLOCKWISE' | 'COUNTERCLOCKWISE'
    // others are used only in non-radial layouts
    tipsAlignment: {type: 'value', default: 'RIGHT'},
    branchStyle: {type: 'value', default: ''}, // usu. determined by layout
    branchLengths: {type: 'value', default: ''},
    nodeLabelSource: {type: 'value', default: 'MAPPED'}, // 'ORIGINAL' | 'MAPPED'
    showFallbackLabels: {type: 'value', default: true}
    // some are reckoned internally (not available to the caller)
    //descentAxis: {type: 'value', default: 'x'}, // 'x' | 'y'
    //orientation: {type: 'value', default: -90},
  });
  return this.produces(true)
             .mutates(true);
}

var prototype = (Phylogram.prototype = Object.create(Transform.prototype));
prototype.constructor = Phylogram;

prototype.transform = function(input) {
  log.debug(input, ['making a phylogram']);

  for (var i = 0; i < input.add.length; i++) {
    this.buildPhylogram(input.add[i]);
  }
  if (this.reevaluate(input)) {
    for (var i = 0; i < input.mod.length; i++) {
      this.buildPhylogram(input.mod[i]);
    }
  }
  /* N.B. Typical notation doesn't work here ('this' is not defined in the called func)
  input.add.forEach();
  if (this.reevaluate(input)) {
    input.mod.forEach(this.buildPhylogram);
  }
  */

  return input;
};

prototype.buildPhylogram = function(data) {
    // read in params
    var layout = this.param('layout');  // 'cartesian' | 'radial' | 'cladogram' | ???

    // NOTE that width and height refer to the final display, so these might
    // map to X or Y coordinates depending on orientation
    var width = this.param('width');
    var height = this.param('height');
    var radius = this.param('radius');  // for radial layout
    var radialArc = this.param('radialArc');  // angles of arc (radial layout only)
    var radialSweep = this.param('radialSweep');  // 'CLOCKWISE' or 'COUNTERCLOCKWISE'
    var branchStyle = this.param('branchStyle');
        // 'rightAngleDiagonal', 'radialRightAngleDiagonal', or a standard
        // D3 diagonal; by default, this will be based on the chosen layout
    var branchLengths = this.param('branchLengths');
    var tipsAlignment = this.param('tipsAlignment');
        // disregard for radial layouts?
    var orientation; // this.param('orientation');
        // degrees of rotation from default (0, -90, 90, 180)
        // NOTE that this is not set directly (from vega spec) but from within
    var descentAxis; // this.param('descentAxis');
        // needed to render paths correctly
        // TODO: add more from options below
    var nodeLabelSource = this.param('nodeLabelSource');  // 'ORIGINAL' or 'MAPPED'
        // choose preferred source for labels; fall back as needed and use marker classes
        // to distinguish these in display
    var showFallbackLabels = this.param('showFallbackLabels');  // boolean

    /* apply some internal constraints (formerly in param setters) */

    if (layout === 'radial') {
      // N.B. radial layout needs fixed (-90) orientation
      orientation = -90;
      descentAxis = 'x';
    } else {
      switch(tipsAlignment) {
        case 'TOP':
          orientation = 180;
          descentAxis = 'y';
          break;
        case 'RIGHT':
          orientation = -90;
          descentAxis = 'x';
          break;
        case 'BOTTOM':
          orientation = 0;
          descentAxis = 'y';
          break;
        case 'LEFT':
          orientation = 90;
          descentAxis = 'x';
          break;
      }
    }

    function phylogram(data) {
      // Expecting incoming data in the 'phylotree' format described here:
      //  https://github.com/OpenTreeOfLife/tree-illustrator/wiki/Building-on-D3-and-Vega

      //console.log('STARTING phylogram transform...');

      // scale all coordinates as directed
      if ((width !== 1.0) || (height !== 1.0)) {
          data.phyloNodes.map(scalePoint);
      }

      if (orientation !== 0) {
          // rotate all nodes by n degrees
          data.phyloNodes.map(rotatePointByOrientation);
      }

      // apply the chosen layout, in a 1x1 "virtual space"..?
      var layoutGenerator;
      switch(layout) {
          case 'radial':
              layoutGenerator = radialLayout;
              break;
          case 'cladogram':
              layoutGenerator = cladogramLayout;
              break;
          case 'cartesian':
          default:
              layoutGenerator = cartesianLayout;
      }
      layoutGenerator(data);

      // set (or revise) paths for all links
      var pathGenerator;
      switch(branchStyle) {
        case '':
            // if none specified, match the layout
            switch(layout) {
                case 'radial':
                    pathGenerator = radialRightAngleDiagonal();
                    break;
                case 'cladogram':
                    pathGenerator = straightLineDiagonal();
                    break;
                case 'cartesian':
                    pathGenerator = rightAngleDiagonal();
                    break;
                default:
                    // allow for moretraditional paths
                    pathGenerator = d3.svg[branchStyle]();
            }
            break;
        case 'straightLineDiagonal':
            pathGenerator = straightLineDiagonal();
            break;
        case 'radialRightAngleDiagonal':
            pathGenerator = radialRightAngleDiagonal();
            break;
        case 'rightAngleDiagonal':
            pathGenerator = rightAngleDiagonal();
            break;
        case 'diagonal':
            // intercept and switch its x/y bias
            if (descentAxis === 'x') {
                pathGenerator = function(d) {
                    // copied from vg.data.link > diagonalX
                    var s = d.source,
                        t = d.target,
                        m = (s.x + t.x) / 2;
                    return "M" + s.x + "," + s.y
                         + "C" + m   + "," + s.y
                         + " " + m   + "," + t.y
                         + " " + t.x + "," + t.y;
                }
            } else {
                pathGenerator = function(d) {
                    // copied from vg.data.link > diagonalY
                    var s = d.source,
                        t = d.target,
                        m = (s.y + t.y) / 2;
                    return "M" + s.x + "," + s.y
                         + "C" + s.x + "," + m
                         + " " + t.x + "," + m
                         + " " + t.x + "," + t.y;
                }
            }
            break;
        case 'radial':
            // intercept and switch its x/y bias
            pathGenerator = d3.svg.diagonal.radial();
                //.projection(function (d) { return [d.y, d.x]; });
            break;
        default:
            pathGenerator = d3.svg[branchStyle]();
            break;
      }

      data.phyloEdges.forEach(function(d, i) {
        d.path = pathGenerator(d);
      });

      var getBoundingBoxFromPoints = function( points, options ) {
          // get X/Y bounds from a list of point-like objects
          options = options || {useCoordinates: 'DISPLAY'};
          var extents = {
              minX:  Number.MAX_VALUE,
              maxX: -Number.MAX_VALUE,
              minY:  Number.MAX_VALUE,
              maxY: -Number.MAX_VALUE
          };
          if (options.useCoordinates === 'CARTESIAN') {
              points.map(function(n) {
                  extents.minX = Math.min(n.cartesian_x, extents.minX);
                  extents.minY = Math.min(n.cartesian_y, extents.minY);
                  extents.maxX = Math.max(n.cartesian_x, extents.maxX);
                  extents.maxY = Math.max(n.cartesian_y, extents.maxY);
              });
          } else {
              points.map(function(n) {
                  extents.minX = Math.min(n.x, extents.minX);
                  extents.minY = Math.min(n.y, extents.minY);
                  extents.maxX = Math.max(n.x, extents.maxX);
                  extents.maxY = Math.max(n.y, extents.maxY);
              });
          }
          return extents;
      }

      /* Generate a "hotspot" path based on layout and dimensions. 
       * (This is used to respond to mouse actions, etc. while editing.) 
       */
      var hotspotGenerator = function() {
          // "M 200 175 A 25 25 0 1 0 217.678 217.678"
          switch(layout) {
              case 'cartesian':
                  // Use the final bounding box of all nodes
                  var extents = getBoundingBoxFromPoints( data.phyloNodes );
                  // rename for clarity
                  var top =     extents.minY,
                      right =   extents.maxX,
                      bottom =  extents.maxY,
                      left =    extents.minX;
                  return "M "+ left +","+ top
                       +" L "+ right +","+ top
                       +" L "+ right +","+ bottom
                       +" L "+ left +","+ bottom
                       +" Z";
              case 'cladogram':
                  var extents = getBoundingBoxFromPoints( data.phyloNodes );
                  var path = "M 0,0";   // start and end at root node
                  switch(tipsAlignment) {
                    case 'TOP':
                      return path
                            +" L "+ extents.minX +","+ extents.minY
                            +" L "+ extents.maxX +","+ extents.minY
                            +" Z";
                    case 'RIGHT':
                      return path
                            +" L "+ extents.maxX +","+ extents.minY
                            +" L "+ extents.maxX +","+ extents.maxY
                            +" Z";
                    case 'BOTTOM':
                      return path
                            +" L "+ extents.minX +","+ extents.maxY
                            +" L "+ extents.maxX +","+ extents.maxY
                            +" Z";
                    case 'LEFT':
                      return path
                            +" L "+ extents.minX +","+ extents.minY
                            +" L "+ extents.minX +","+ extents.maxY
                            +" Z";
                  }
              case 'radial':
                  // sweep out the entire area of the graph
                  var path = "M0,0 L";   // start at root node, begin first line
                  // create a fake "edge" to discern the full arc
                  var extents =  getBoundingBoxFromPoints( data.phyloNodes, {useCoordinates: 'CARTESIAN'} );
                  var fullWidthEdge = {
                      source: {cartesian_x: extents.maxX, cartesian_y: extents.minY},
                      target: {cartesian_x: extents.maxX, cartesian_y: extents.maxY}
                  };
                  // get the full arc as a path string
                  var pathGenerator = radialRightAngleDiagonal();
                  // prepend root node position and close the final shape
                  // EXAMPLE output: 'M-228,19 A229,229 0 0,0 -227,26L-227,26'
                  //    BECOMES 'M0,0 L-228,19 A229,229 0 1,1 -227,26L-227,26 Z'
                  path += pathGenerator(fullWidthEdge).slice(1); // trim initial 'M'
                  path += " Z";
                  // Flip the large-arc and sweep flags for "outer sweep"; see
                  //  https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths#Arcs
                  //  http://www.w3.org/TR/SVG/paths.html#PathDataEllipticalArcCommands
                  path = path.replace("0 0,0 ", "0 1,1 "); 
                  return path;

              default:
                  console.error("Unknown tree layout for bounding box!");
                  return "M -50,-50 L -50,50, L 50,50, L 50,-50 Z";
          }
      }
      /* Generate a series of vertex handles based on layout and dimensions.
       * (These are also used to respond to mouse actions, etc. while editing.)
       */
      var handleGenerator = function() {
          var handles = [ ];
          var moveHandleTip = "Drag to move this tree on the page.";
          var resizeHandleTip = "Drag to change width and height";
          switch(layout) {
              case 'cartesian':
              case 'cladogram':
                  // These use just two handles on "opposite" corners from the root node.
                  handles.push({ name: 'center', x: 0, y: 0, shape: 'diamond', size: 120,
                                 tooltip: moveHandleTip });
                  var extents = getBoundingBoxFromPoints( data.phyloNodes );
                  switch(tipsAlignment) {
                    case 'TOP':
                      handles.push({ name: 'top-left', x: extents.minX, y: extents.minY,
                                     tooltip: resizeHandleTip });
                      handles.push({ name: 'top-right', x: extents.maxX, y: extents.minY,
                                     tooltip: resizeHandleTip });
                      break;
                    case 'RIGHT':
                      handles.push({ name: 'top-right', x: extents.maxX, y: extents.minY,
                                     tooltip: resizeHandleTip });
                      handles.push({ name: 'bottom-right', x: extents.maxX, y: extents.maxY,
                                     tooltip: resizeHandleTip });

                      break;
                    case 'BOTTOM':
                      handles.push({ name: 'bottom-left', x: extents.minX, y: extents.maxY,
                                     tooltip: resizeHandleTip });
                      handles.push({ name: 'bottom-right', x: extents.maxX, y: extents.maxY,
                                     tooltip: resizeHandleTip });
                      break;
                    case 'LEFT':
                      handles.push({ name: 'top-left', x: extents.minX, y: extents.minY,
                                     tooltip: resizeHandleTip });
                      handles.push({ name: 'bottom-left', x: extents.minX, y: extents.maxY,
                                     tooltip: resizeHandleTip });
                      break;
                  }
                  break;

              case 'radial':
                  handles.push({ name: 'center', x: 0, y: 0, shape: 'diamond', size: 120,
                                 tooltip: moveHandleTip });
                  // Reckon three handle positions (on perimeter) in Cartesian coordinates...
                  var extents = getBoundingBoxFromPoints( data.phyloNodes, {useCoordinates: 'CARTESIAN'} );
                  var startPoint = {x: extents.maxX, y: extents.minY},
                      midPoint = {x: extents.maxX, y: (extents.maxY + extents.minY) / 2},
                      endPoint = {x: extents.maxX, y: extents.maxY};
                  // ... then convert to polar coordinates (simple arrays)
                  startPoint = cartesianToPolarProjection( startPoint, {returnType: 'POLAR_COORDS'} );
                  endPoint = cartesianToPolarProjection( endPoint, {returnType: 'POLAR_COORDS'} );
                  midPoint = cartesianToPolarProjection( midPoint, {returnType: 'POLAR_COORDS'} );

                  // pass all polar properties (angle, radius, theta) plus a descriptive name
                  handles.push( $.extend(startPoint, {name: 'start-angle',
                                                      tooltip: "Drag to change radius and starting angle"}) );
                  handles.push( $.extend(endPoint, {name: 'end-angle',
                                                    tooltip: "Drag to change radius and ending angle"}) );
                  handles.push( $.extend(midPoint, {name: 'radius',
                                                    tooltip: "Drag to change this tree's radius" }) );
                  break;
          }
          // merge in default properties as needed
          $.each(handles, function(i,h) {
              handles[i] = $.extend({ shape:'circle', size:80, rotate:0 }, handles[i]);
          });
          return handles;
      }

      data.hotspot = [  // emulate a tuple
          {
              "path": hotspotGenerator()
          }
      ];
      data.vertexHandles = handleGenerator(); // returns an array

      // copy layout properties to the phylotree, for possible use downstream
      data.layout = layout;
      data.tipsAlignment = tipsAlignment;
      data.descentAxis = descentAxis;  // implicit in tipsAlignment?
      data.orientation = orientation;  // implicit in tipsAlignment?
      data.width = width;
      data.height = height;
      data.radius = radius;
      data.branchStyle = branchStyle;
      data.branchLengths = branchLengths;
      data.nodeLabelSource = nodeLabelSource;
      data.showFallbackLabels = showFallbackLabels;

      // copy generators for hotspot and other handles
      //data.hotspotGenerator = hotspotGenerator;
      //data.handleGenerator = handleGenerator;
      Phylogram.hotspotGenerator = hotspotGenerator;
      Phylogram.handleGenerator = handleGenerator;

      return data;
    }
      
    var displacePoint = function(point, delta) {
        // where 'delta' is an object with x and y properties
        point.x += delta.x;
        point.y += delta.y;
        return point;
    }

    // Return width *or* height, as appropriate for the current orientation
    var getOuterDimensionForX = function() {
        switch(orientation) {
            case 0:
            case 180:
            case -180:
                return width;

            case 90:
            case -90:
            case 270:
            case -270:
                return height;
        }
        console.error("getOuterDimensionForX(): Unexpected value for orientation: '"+ orientation +"'");
    }
    var getOuterDimensionForY = function() {
        switch(orientation) {
            case 0:
            case 180:
            case -180:
                return height;
            case 90:
            case -90:
            case 270:
            case -270:
                return width;
        }
        console.error("getOuterDimensionForY(): Unexpected value for orientation: '"+ orientation +"'");
    }

    var scalePoint = function(point) {
        // where point is any object having x and y properties
        // NOTE that we're scaling up from fractional values (0.0 - 1.0), so
        // the nominal width+height are also our scaling multipliers
        point.x *= getOuterDimensionForX();
        if (layout === 'radial') {
            point.y *= radius;
        } else {
            point.y *= getOuterDimensionForY();
        }
        // scale cartesian_x and y, if stored
        if ('cartesian_x' in point) {
            point.cartesian_x *= getOuterDimensionForX();
            point.cartesian_y *= getOuterDimensionForY();
        }
        return point;
    }

    var rotatePointByOrientation = function(point) {
        // use the vega input 'orientation' value to spin the tree
        return rotatePoint(point, orientation);
    }
    var rotatePointByY = function(point) {
        // Y coordinate should be between 0.0 and 1.0
        var yAngle = 360.0 * point.x;
        return rotatePoint(point, yAngle);
    }

    var rotatePoint = function(point, angle, pivot) {
        // where point is any object having x and y properties, and 'pivot'
        // is an optional second point
        var cos = Math.cos,
            sin = Math.sin,
            angle = degreesToRadians(angle || orientation), // convert to radians
            // default midpoint is origin (0,0)
            xm = (pivot && 'x' in pivot) ? pivot.x : 0,
            ym = (pivot && 'y' in pivot) ? pivot.y : 0,
            x = point.x,    // capture old x and y for this point
            y = point.y;

        // subtract midpoints, rotate from origin, then restore them
        point.x = (x - xm) * cos(angle) - (y - ym) * sin(angle) + xm;
        point.y = (x - xm) * sin(angle) + (y - ym) * cos(angle) + ym;
        if ('cartesian_x' in point) {
            cx = point.cartesian_x,    // capture old coords
            cy = point.cartesian_y;
            point.cartesian_x = (cx - xm) * cos(angle) - (cy - ym) * sin(angle) + xm;
            point.cartesian_y = (cx - xm) * sin(angle) + (cy - ym) * cos(angle) + ym;
        }
        return point;
    }

    function radiansToDegrees(r) {
        return (r * 180 / Math.PI);
    }
    function degreesToRadians(d) {
        return (d * Math.PI / 180);
    }
    function normalizeDegrees(d) {
        // convert to positive integer, e.g. -90 ==> 270
        return (d + (360 * 3)) % 360;
    }

  // Convert XY and radius to angle of a circle centered at 0,0
  var coordinateToAngle = function(coord, radius) {
    var wholeAngle = 2 * Math.PI,
        quarterAngle = wholeAngle / 4;
    
    var coordQuad = coord[0] >= 0 ?
            (coord[1] >= 0 ? 1 : 2) :
            (coord[1] >= 0 ? 4 : 3),
        coordBaseAngle = Math.abs(Math.asin(coord[1] / radius));
    
    // Since this is just based on the angle of the right triangle formed
    // by the coordinate and the origin, each quad will have different
    // offsets
    switch (coordQuad) {
      case 1:
        coordAngle = quarterAngle - coordBaseAngle;
        break;
      case 2:
        coordAngle = quarterAngle + coordBaseAngle;
        break;
      case 3:
        coordAngle = 2*quarterAngle + quarterAngle - coordBaseAngle;
        break
      case 4:
        coordAngle = 3*quarterAngle + coordBaseAngle;
    }
    return coordAngle;
  }

  /* path generators */

  var straightLineDiagonal = function(d) {
    // do-nothing projection (just isolates x and y)
    var projection = function(d) { return [d.x, d.y]; }
    
    var path = function(pathData) {
      return "M" + pathData[0] + ' ' + pathData[1];
    }
    
    function diagonal(d) {
      var pathData = [d.source, d.target];
      pathData = pathData.map(projection);
      return path(pathData);
    }
    
    diagonal.projection = function(x) {
      if (!arguments.length) return projection;
      projection = x;
      return diagonal;
    };
    
    diagonal.path = function(x) {
      if (!arguments.length) return path;
      path = x;
      return diagonal;
    };
    
    return diagonal;
  }

  var rightAngleDiagonal = function(d) {
    // do-nothing projection (just isolates x and y)
    var projection = function(d) { return [d.x, d.y]; }
    
    var path = function(pathData) {
      return "M" + pathData[0] + ' ' + pathData[1] + " " + pathData[2];
    }
    
    function diagonal(d) {
      var midpointX = (d.source.x + d.target.x) / 2,
          midpointY = (d.source.y + d.target.y) / 2,
          pathData = (descentAxis === 'x') ?
                    [d.source, {x: d.source.x, y: d.target.y}, d.target] :
                    [d.source, {x: d.target.x, y: d.source.y}, d.target];
      pathData = pathData.map(projection);
      return path(pathData)
    }
    
    diagonal.projection = function(x) {
      if (!arguments.length) return projection;
      projection = x;
      return diagonal;
    };
    
    diagonal.path = function(x) {
      if (!arguments.length) return path;
      path = x;
      return diagonal;
    };
    
    return diagonal;
  }
  
  var cartesianToPolarProjection = function(d, options) {
    options = options || {returnType: 'XY-ARRAY'}; // or 'POLAR-COORDS'
    // radius is simply the x coordinate
    var r = d.x;

    ///var a = (d.y - 0) / 180 * Math.PI;
    // a = angle? or something else?

    // Angle is influenced by the specified size, arc and sweep.
    // map Y coordinate to total specified width
    var totalArcDegrees;
    // force both angles to positive numbers
    var startAngle = (radialArc[0] + 360) % 360;
    var endAngle = (radialArc[1] + 360) % 360;
    // check for arcs that cross the zero line
    var shiftAngle;
    if (radialSweep === 'COUNTERCLOCKWISE') {
        if (endAngle > startAngle) {
            totalArcDegrees = endAngle - startAngle;
        } else {
            totalArcDegrees = (endAngle+360) - startAngle;
        }
        shiftAngle = startAngle;
    } else { // assumes 'CLOCKWISE')
        if (startAngle > endAngle) {
            totalArcDegrees = startAngle - endAngle;
        } else {
            totalArcDegrees = (startAngle+360) - endAngle;
        }
        shiftAngle = endAngle;
    }
    var proportionalY = ((d.y / getOuterDimensionForX()) * totalArcDegrees);
    // shift angle 90 degrees (from 0=down to 0=right)
    ///proportionalY -= 90;

    // OR rotate angle to the start or end angle?
    ///proportionalY = (proportionalY + shiftAngle + 360) % 360;

    var a = proportionalY / 180 * Math.PI;
    // remap angle to the specified arc, in the sweep direction

    // TODO: reckon angle based on height/width and sweep
    if (options.returnType === 'POLAR_COORDS') {
        // add radius and angle (theta) for label display in vega
        var labelAngle = normalizeDegrees(radiansToDegrees(a));
        var labelAlignment = 'left';
        // TODO: adjustable nudge separates label text from drawn node
        var nudgeRadius = 4; // px?
        // TODO: adjustable nudge (should vary with text size) shifts angle
        // from the label's baseline to the middle of its x-height
        var nudgeTheta = degreesToRadians(0.6);

        // test for upside-down labels (assuming 0 deg = due right)
        if ((labelAngle > 90) && (labelAngle < 270)) {
            // left-side labels should be flipped and aligned right
            labelAlignment = 'right';
            labelAngle = normalizeDegrees(labelAngle + 180);
            nudgeTheta =  -(nudgeTheta)
        }
        var nodeAndLabelProperties = {
            // X, Y coordinates for the node itself
            'x': r * Math.cos(a),
            'y': r * Math.sin(a),
            // additional properties for placing the label
            'radius': r + nudgeRadius,
            'theta': a - degreesToRadians(orientation) + nudgeTheta, // in radians!
            'angle': labelAngle,
            'align': labelAlignment
        };
        return nodeAndLabelProperties;
    } else {
        // return XY-COORDS by default
        return [r * Math.cos(a), r * Math.sin(a)];
    }
  }

  var radialRightAngleDiagonal = function(d) {
    // We need a standalone version of this, since we're mapping (preserved)
    // cartesian_x and cartesian_y to polar coordinates.

    // translate from cartesian to polar coordinates
    var projection = cartesianToPolarProjection;
            
    var path = function(pathData) {
        var src = pathData[0],
            mid = pathData[1],
            dst = pathData[2],
            radius = Math.sqrt(src[0]*src[0] + src[1]*src[1]),
            srcAngle = coordinateToAngle(src, radius),
            midAngle = coordinateToAngle(mid, radius),
            clockwise = Math.abs(midAngle - srcAngle) > Math.PI ? midAngle <= srcAngle : midAngle > srcAngle,
            rotation = 0,  // this is moot for a circle
            largeArc = 0,
            sweep = clockwise ? 0 : 1;
        var pathString = 'M' + src + ' ' +
          "A" + [radius,radius] + ' ' + rotation + ' ' + largeArc+','+sweep + ' ' + mid +
          'L' + dst;
        return pathString;
    }
            
    function diagonal(d) {
      var midpointX = (d.source.cartesian_x + d.target.cartesian_x) / 2,
          midpointY = (d.source.cartesian_y + d.target.cartesian_y) / 2,
          pathData = (descentAxis === 'x') ?
                    [
                        {x: d.source.cartesian_x, y: d.source.cartesian_y},
                        {x: d.source.cartesian_x, y: d.target.cartesian_y},
                        {x: d.target.cartesian_x, y: d.target.cartesian_y}
                    ] :
                    [
                        {x: d.source.cartesian_x, y: d.source.cartesian_y},
                        {x: d.target.cartesian_x, y: d.source.cartesian_y},
                        {x: d.target.cartesian_x, y: d.target.cartesian_y}
                    ];
      pathData = pathData.map(projection);
      return path(pathData)
    }
            
    return diagonal;
  }
  
    /* layout generators (position points in 1.0, 1.0 space) */
    var cartesianLayout = function(data) {
        // place all nodes for the radial layout (already done)

        // just nudge all points to put the root node at 0,0
        moveRootToOrigin(data);
    }

    var moveRootToOrigin = function (data) {
        // move all points to put the root node at origin (0.0)
        var rootNode = data.phyloNodes[0];  // I believe this is always true
        var nudgeRootToOrigin = {x: -(rootNode.x), y: -(rootNode.y)};
        var alignPointsToOrigin = function(point) {
            return displacePoint(point, nudgeRootToOrigin);
        };
        data.phyloNodes.map(alignPointsToOrigin);
    }

    var radialLayout = function(data) {
        // place all nodes for the radial layout
        // project points (nodes) to radiate out from center
        moveRootToOrigin(data);
        
        var preserveCartesianCoordinates = function(point) {
            point.cartesian_x = point.x;
            point.cartesian_y = point.y;
        }
        data.phyloNodes.map(preserveCartesianCoordinates);

        ///data.phyloNodes.map(rotatePointByY);
        data.phyloNodes.map(function(d) {
            pcoords = cartesianToPolarProjection(d, {returnType:'POLAR_COORDS'});
            d.radius  = pcoords.radius;
            d.theta  = pcoords.theta;
            d.angle  = pcoords.angle;
            d.align  = pcoords.align;
            d.x = pcoords.x;
            d.y = pcoords.y;
        });
    }
    var cladogramLayout = function(data) {
        // place all nodes for the "triangular" cladogram layout
        // TODO: support branch lengths?

        // project points (nodes) to radiate out from center
        moveRootToOrigin(data);
        
        /* Precalculate available leaf-node positions (based on number of
         * leaves, final width & height, and tip alignment). Then do
         * depth-first traversal from the root to assign the leaves to these
         * positions, placing all ancestors along the way.
         */
        var leafNodes = $.grep(data.phyloNodes, function(n) {
            return n['^ot:isLeaf'] === true;
        });

        var nLeaves = leafNodes.length;

        /* How far should we move on the descent axis for each step in depth?
         * NOTE that we'll normalize this to match the original width or height
         * later; for now, let's match the distance between leaf nodes.
         */
        var depthStep;

        var leafPositions = [ ];
        var startingLeafX, leafXstep,
            startingLeafY, leafYstep;
        switch(tipsAlignment) {
            case 'TOP':
                startingLeafX = -(width / 2.0);
                leafXstep = width / (nLeaves-1);
                startingLeafY = -height;
                leafYstep = 0;
                depthStep = -leafXstep;
                break;
            case 'RIGHT':
                startingLeafX = width;
                leafXstep = 0;
                startingLeafY = -(height / 2.0);
                leafYstep = height / (nLeaves-1);
                depthStep = leafYstep;
                break;
            case 'BOTTOM':
                startingLeafX = -(width / 2.0);
                leafXstep = width / (nLeaves-1);
                startingLeafY = height;
                leafYstep = 0;
                depthStep = leafXstep;
                break;
            case 'LEFT':
                startingLeafX = -width;
                leafXstep = 0;
                startingLeafY = -(height / 2.0);
                leafYstep = height / (nLeaves-1);
                depthStep = -leafYstep;
                break;
        }

        leafNodes.map(function(n, i) {
            leafPositions.push({
                'x': startingLeafX + (leafXstep * i),
                'y': startingLeafY + (leafYstep * i)
            });
        });

        var rootNode = data.phyloNodes[0];  // I believe this is always true
        var fullExtents = distributeChildrenAsCladogram(rootNode, leafPositions, depthStep);

        // realign root node to origin (it gets "pushed" far away by complex trees)
        moveRootToOrigin(data);

        // Scale the resulting layout to match the desired width (or height)
        switch(tipsAlignment) {
            case 'TOP':
            case 'BOTTOM':
                // width is already good; height should be squeezed (or stretched)
                var squeeze = height / (fullExtents.maxY - fullExtents.minY);
                var fitToHeight = function(point) {
                    point.y *= squeeze;
                    return point;
                }
                data.phyloNodes.map(fitToHeight);
                break;
            case 'RIGHT':
            case 'LEFT':
                // height is already good; width should be squeezed (or stretched)
                var squeeze = width / (fullExtents.maxX - fullExtents.minX);
                var fitToWidth = function(point) {
                    point.x *= squeeze;
                    return point;
                }
                data.phyloNodes.map(fitToWidth);
                break;
        }
    }
   
    var distributeChildrenAsCladogram = function(node, leafPositions, depthStep) {
        if (!node.children || node.children.length === 0) { return; }
        var extents = {
            minX:  Number.MAX_VALUE,
            maxX: -Number.MAX_VALUE,
            minY:  Number.MAX_VALUE,
            maxY: -Number.MAX_VALUE,
            descendantLeafCount: 0
        };
        node.children.map(function(n, i) {
            if (n['^ot:isLeaf'] === true) {
                // capture the next available leaf position
                var leafPos = leafPositions.shift();
                n.x = leafPos.x;
                n.y = leafPos.y;

                extents.minX = Math.min(n.x, extents.minX);
                extents.minY = Math.min(n.y, extents.minY);
                extents.maxX = Math.max(n.x, extents.maxX);
                extents.maxY = Math.max(n.y, extents.maxY);
                extents.descendantLeafCount += 1;
            } else {
                var childExtents = distributeChildrenAsCladogram(n, leafPositions, depthStep);
                extents.minX = Math.min(n.x, childExtents.minX, extents.minX);
                extents.minY = Math.min(n.y, childExtents.minY, extents.minY);
                extents.maxX = Math.max(n.x, childExtents.maxX, extents.maxX);
                extents.maxY = Math.max(n.y, childExtents.maxY, extents.maxY);
                extents.descendantLeafCount += childExtents.descendantLeafCount;
            }
        });

        /* Position this node based on its depth and children's positions.
         * Note that we need to place it on the descent axis so that it
         * maintains (if possible) the proper angled edges for the
         * cladogram layout. This sometimes means we need to force
         * longer edges between this node and its children.
         */
        switch(tipsAlignment) {
            case 'TOP':
                node.y = Math.max(
                    extents.maxY - depthStep,  // one step closer to root
                    extents.minY - ((extents.descendantLeafCount - 1) * depthStep)
                );
                // x should be midpoint of all descendants' x
                node.x = (extents.maxX + extents.minX) / 2.0;
                break;
            case 'BOTTOM':
                node.y = Math.min(
                    extents.minY - depthStep,  // one step closer to root
                    extents.maxY - ((extents.descendantLeafCount - 1) * depthStep)
                );
                // x should be midpoint of all descendants' x
                node.x = (extents.maxX + extents.minX) / 2.0;
                break;
            case 'RIGHT':
                node.x = Math.min(
                    extents.minX - depthStep,  // one step closer to root
                    extents.maxX - ((extents.descendantLeafCount - 1) * depthStep)
                );
                // y should be midpoint of all descendants' y
                node.y = (extents.maxY + extents.minY) / 2.0;
                break;
            case 'LEFT':
                node.x = Math.max(
                    extents.maxX - depthStep,  // one step closer to root
                    extents.minX - ((extents.descendantLeafCount - 1) * depthStep)
                );
                // y should be midpoint of all descendants' y
                node.y = (extents.maxY + extents.minY) / 2.0;
                break;
        }

        // update extents and return to parent
        extents.minX = Math.min(node.x, extents.minX);
        extents.minY = Math.min(node.y, extents.minY);
        extents.maxX = Math.max(node.x, extents.maxX);
        extents.maxY = Math.max(node.y, extents.maxY);

        return extents;
    }

    return phylogram(data);
}



/***** SCRAP AREA *****/

/*
  styleTreeNodes = function(vis) {

    vis.selectAll('g.node circle')
        .attr("r", 2.5);

    vis.selectAll('g.leaf.node circle')
        .attr("r", 4.5);
    
    vis.selectAll('g.root.node circle')
        .attr("r", 4.5);
  }
*/
  
  function scaleBranchLengths(nodes, w) {
    // Visit all nodes and adjust y pos width distance metric
    var visitPreOrder = function(root, callback) {
      callback(root)
      if (root.children) {
        for (var i = root.children.length - 1; i >= 0; i--){
          visitPreOrder(root.children[i], callback)
        };
      }
    }
    visitPreOrder(nodes[0], function(node) {
      // TODO: if we have mixed trees (some edges with lengths), consider 1
      // as default length versus 0?
      node.rootDist = (node.parent ? node.parent.rootDist : 0) + (node.length || 0)
    })
    var rootDists = nodes.map(function(n) { return n.rootDist; });
    var yscale = d3.scale.linear()
      .domain([0, d3.max(rootDists)])
      .range([0, w]);
    visitPreOrder(nodes[0], function(node) {
      node.y = yscale(node.rootDist)
    })
    return yscale
  }
  
  
  var buildCartesian = function(selector, nodes, options) {
    options = options || {}
    var w = options.width || d3.select(selector).style('width') || d3.select(selector).attr('width'),
        h = options.height || d3.select(selector).style('height') || d3.select(selector).attr('height'),
        w = parseInt(w),
        h = parseInt(h);
    var tree = options.tree || d3.layout.cluster()
      .size([h, w])
      .sort(function(node) { return node.children ? node.children.length : -1; })
    var diagonal = options.diagonal || rightAngleDiagonal();
    var vis = options.vis || d3.select(selector).append("svg:svg")
        .attr("width", w + 300)
        .attr("height", h + 30)
      .append("svg:g")
        .attr("transform", "translate(120, 20)");

    if (!options.vis) {
      // add any special filters (once only)
      d3.select(selector).selectAll('svg')
       .append('defs')
         .append("svg:filter")
           .attr("id", "highlight")
           .each(function(d) {
               // add multiple elements to this parent
               d3.select(this).append("svg:feFlood")
                 //.attr("flood-color", "#ffeedd")  // matches .help-box bg color!
                 .attr("flood-color", "#ffb265")    // darkened to allow tint
                 .attr("flood-opacity", "0.5")
                 .attr("result", "tint");
               d3.select(this).append("svg:feBlend")
                 .attr("mode", "multiply")
                 .attr("in", "SourceGraphic")
                 .attr("in2", "tint")
                 .attr("in3", "BackgroundImage");
               /* ALTERNATIVE SOLUTION, using feComposite
               d3.select(this).append("svg:feComposite")
                 .attr("in", "SourceGraphic");
                */
           });
    }

    var nodes = tree(nodes);
    
    if (options.skipBranchLengthScaling) {
      var yscale = d3.scale.linear()
        .domain([0, w])
        .range([0, w]);
    } else {
      var yscale = scaleBranchLengths(nodes, w)
    }
    
    if (!options.skipTicks) {
      var lines = vis.selectAll('line')
          .data(yscale.ticks(10));
      
      lines
        .enter().append('svg:line')
          .attr('y1', 0)
          .attr('y2', h)
          .attr('x1', yscale)
          .attr('x2', yscale)
          .attr("stroke", "#eee");

      lines
        .exit().remove();

      var text_rules = vis.selectAll("text.rule")
          .data(yscale.ticks(10));

      text_rules
        .enter().append("svg:text")
          .attr("class", "rule")
          .attr("x", yscale)
          .attr("y", 0)
          .attr("dy", -3)
          .attr("text-anchor", "middle")
          .attr('font-size', '8px')
          .attr('fill', '#ccc')
          .text(function(d) { return Math.round(d*100) / 100; });

      text_rules
        .exit().remove();
    }
        
    
    // DATA JOIN
    /* more interactions and styles on final marks
    var path_links = vis.selectAll("path.link")
        .data(tree.links(nodes), function(d) { return d.source['@id'] +'_'+ d.target['@id']; });

    var path_link_triggers = vis.selectAll("path.link-trigger")
        .data(tree.links(nodes), function(d) { return d.source['@id'] +'_'+ d.target['@id'] +'_trigger'; });

    var g_nodes = vis.selectAll("g.node")
        .data(nodes, function(d) { return d['@id']; });

    // UPDATE (only affects existing links)
    path_links
        .attr("stroke", "#aaa");
    
    path_link_triggers
        .attr("stroke", "orange");

    
    // ENTER (only affects new links; do one-time initialization here)
    path_links
      .enter()
          .append("svg:path")                   // styled (visible) edge
            .attr("class", "link")
            .attr("fill", "none")
            .attr("stroke", "#f33")
            .attr("stroke-width", "4px");
    
    path_link_triggers
      .enter()
          .append("svg:path")                   // "hit area" for clicking edge
            .attr("class", "link-trigger")
            .attr("fill", "none")
            .attr("stroke", "red")
            .attr("stroke-width", "4px")
            //.attr('pointer-events', 'all')

    g_nodes
      .enter()
        .append("svg:g")
          .append("svg:circle")
            .attr("r", 2.5)
            .attr('stroke', 'red')
            .attr('pointer-events', 'all')      // detect on invisible stuff
            .attr('stroke-opacity', '0.0')
            .attr('stroke-width', '8px');

    // ENTER + UPDATE (affects all new AND existing links)
    path_links
        .attr("d", diagonal)
        .attr("class", function(d) { return "link "+ (d.source.ingroup ? "ingroup" : "outgroup"); });
        
    path_link_triggers
        .attr("d", diagonal)
        .attr("class", function(d) { return "link-trigger "+ (d.source.ingroup ? "ingroup" : "outgroup"); });

    g_nodes
        .attr("class", function(n) {
          // N.B. These classes are overridden by study-editor.js!
          if (n.children) {
            if (n.depth == 0) {
              return "root node";
            } else {
              return "inner node";
            }
          } else {
            return "leaf node";
          }
        })
        .attr("id", function(d) { return ("nodebox-"+ d['@id']); })
        .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; })

    // EXIT
    path_links
      .exit()
        .remove();

    path_link_triggers
      .exit()
        .remove();

    g_nodes
      .exit().remove();

    */
    // any dynamic readjustments of non-CSS attributes
    ///styleTreeNodes(vis);
    
    /* node labeling
    // TODO: why is this SUPER-SLOW with large trees? like MINUTES to run...
    // Is there a faster/cruder way to clear the decks?
    vis.selectAll('g.node text').remove();

    // provide an empty label as last resort, so we can see highlights
    var defaultNodeLabel = "unnamed";

    if (!options.skipLabels) {
      // refresh all labels based on tree position
      vis.selectAll('g.node')
        .append("svg:text")
          .attr('font-family', 'Helvetica Neue, Helvetica, sans-serif')
          .attr("dx", -6)
          .attr("dy", -6)
          .attr("text-anchor", 'end')
          .attr('font-size', '10px')
          .attr('fill', function(d) {
              switch(d.labelType) {
                  case ('mapped label'):
                      return '#000';
                  case ('node id'):
                      if (d.ambiguousLabel) {
                          return '#b94a48';  // show ambiguous labels, match red prompts
                      } else if (d.adjacentEdgeLabel) {
                          return '#888';
                      } else {
                          return '#888';
                      }
                  default:
                      return '#888';
              }
          })
          ///.text(function(d) { return d.length; });
          .attr('font-style', function(d) {
              return (d.labelType === 'mapped label' ? 'inherit' : 'italic');
          })
          .text(function(d) {
              // return (d.name + ' ('+d.length+')');
              var nodeLabel = '';
              if (d.labelType === 'node id') {
                  nodeLabel = '';  // hide these
              } else {
                  nodeLabel = d.name || defaultNodeLabel;
              }
              var supplementalLabel = d.ambiguousLabel || d.adjacentEdgeLabel;
              if (supplementalLabel) {
                  if (nodeLabel === '') {
                      nodeLabel = supplementalLabel;
                  } else {
                      nodeLabel = nodeLabel +" ["+ supplementalLabel +"]";
                  }
              }
              return nodeLabel;
          });

      vis.selectAll('g.root.node text')
          .attr("dx", -8)
          .attr("dy", 3);

      vis.selectAll('g.leaf.node text')
        .attr("dx", 8)
        .attr("dy", 3)
        .attr("text-anchor", "start");
    }
    
    */

    return {tree: tree, vis: vis}
  }
  
  var buildRadial = function(nodes, links, options) {
    options = options || {}
    /* set width, radius, space for edge labels
    var w = options.width || d3.select(selector).style('width') || d3.select(selector).attr('width'),
        r = w / 2,
        // NOTE the fudge factor here; longer labels will be clipped!
        labelWidth = options.skipLabels ? 10 : options.labelWidth || 120;
    */
    
    /* build SVG, set size and offet (center is 0,0)
    var vis = d3.select(selector).append("svg:svg")
        .attr("width", r * 2)
        .attr("height", r * 2)
      .append("svg:g")
        .attr("transform", "translate(" + r + "," + r + ")");
    */
        
    /* set space with x as polar coordinates (360 degrees), y = 1.0 */
    var tree = d3.layout.tree()  // TODO: use cluster here?
      .size([360, 500])   // WAS ([360, r - labelWidth])
      // sort populous to sparse branches
      .sort(function(node) { return node.children ? node.children.length : -1; })
      .separation(function(a, b) { return (a.parent == b.parent ? 1 : 2) / a.depth; });
    
    var phylogram = buildCartesian(selector, nodes, {
      vis: vis,
      tree: tree,
      skipBranchLengthScaling: true,
      skipTicks: true,
      skipLabels: options.skipLabels,
      diagonal: radialRightAngleDiagonal()
    })
    vis.selectAll('g.node')
      .attr("transform", function(d) { return "rotate(" + (d.x - 90) + ")translate(" + d.y + ")"; })
    
    if (!options.skipLabels) {
      vis.selectAll('g.leaf.node text')
        .attr("dx", function(d) { return d.x < 180 ? 8 : -8; })
        .attr("dy", ".31em")
        .attr("text-anchor", function(d) { return d.x < 180 ? "start" : "end"; })
        .attr("transform", function(d) { return d.x < 180 ? null : "rotate(180)"; })
        .attr('font-family', 'Helvetica Neue, Helvetica, sans-serif')
        .attr('font-size', '10px')
        .attr('fill', 'black');

      vis.selectAll('g.inner.node text')
        .attr("dx", function(d) { return d.x < 180 ? -6 : 6; })
        .attr("text-anchor", function(d) { return d.x < 180 ? "end" : "start"; })
        .attr("transform", function(d) { return d.x < 180 ? null : "rotate(180)"; });
    }
    
    return {tree: tree, vis: vis}
  }

module.exports = Phylogram;

Phylogram.schema = {
  "$schema": "http://json-schema.org/draft-04/schema#",
  "title": "Phylogram transform",
  "description": "Projects hierarchical data (presumably a tree) into one of several layouts "+
                 "and passes the results for downstream rendering.",
  "type": "object",
  "properties": {
    "type": {"enum": ["phylogram"]},
    "layout": {
      "description": "Should be 'radial', 'cladogram', or 'cartesian'.",
      "oneOf": [{"type": "string"}, {"$ref": "#/refs/signal"}],
      "default": 'cartesian'
    },
    "width": {
      "description": "Width of overall phylogram, in chosen physical units", // TODO: CONFIRM
      "oneOf": [{"type": "number"}, {"$ref": "#/refs/signal"}],
      "default": 1.0
    },
    "height": {
      "description": "Height of overall phylogram, in chosen physical units", // TODO: CONFIRM
      "oneOf": [{"type": "number"}, {"$ref": "#/refs/signal"}],
      "default": 1.0
    },
    "radius": {
      "description": "Radius (from center to edge) of a radial layout, in arbitrary units.",
      "oneOf": [{"type": "number"}, {"$ref": "#/refs/signal"}],
      "default": 0.5
    },
    "radialArc": {
      "description": "Angles of arc [start, end] for a circular layout.",
      "oneOf": [
          {
            "type": "array",
            "items": {"type": "number"},
            "minItems": 2,
            "maxItems": 2
          },
          {"$ref": "#/refs/signal"}
      ],
      "default": [0, 360]
    },
    "radialSweep": {
      "description": "Direction of arc, CLOCKWISE or COUNTERCLOCKWISE.",
      "oneOf": [{"type": "string"}, {"$ref": "#/refs/signal"}],
      "enum": ["CLOCKWISE", "COUNTERCLOCKWISE"],
      "default": 'CLOCKWISE'
    },
    "tipsAlignment": {
      "description": "Which edge will show the labeled tips.",
      "oneOf": [{"type": "string"}, {"$ref": "#/refs/signal"}],
      "enum": ["TOP", "RIGHT", "BOTTOM", "LEFT"],
      "default": 'right'
    },
    "branchStyle": {
      "description": "Override the layout's style (rarely used).",
      "oneOf": [{"type": "string"}, {"$ref": "#/refs/signal"}],
      "enum": ["rightAngleDiagonal", "radialRightAngleDiagonal",
               "straightLineDiagonal", "diagonal", "radial"],
      "default": ''
    },
    "branchLengths": {
      "description": "Map a data field to branch lengths (NOT YET IMPLEMENTED).",
      "oneOf": [{"type": "string"}, {"$ref": "#/refs/signal"}],  // is this type "field"?
      "default": ''
    },
    "nodeLabelSource": {
      "description": "Look for tip labels in a data field.",
      "oneOf": [{"type": "XXXXXXXXXXX"}, {"$ref": "#/refs/signal"}],
      "enum": ["XXXXXXXXXXX", "XXXXXXXXXXX"],
      "default": ''
    },
    "showFallbackLabels": {
      "description": "If primary label is not found, show alternatives.",
      "oneOf": [{"type": "boolean"}, {"$ref": "#/refs/signal"}],
      "default": true
    },
  },
  "additionalProperties": false,  // TODO: confirm this
  "required": ["type"]  // TODO: review params!
};
