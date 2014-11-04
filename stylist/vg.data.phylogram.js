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
    Creates a radial dendrogram.
    Options: same as build, but without diagonal, skipTicks, and 
      skipBranchLengthScaling

  rightAngleDiagonal()
    Similar to d3.diagonal except it create an orthogonal crook instead of a
    smooth Bezier curve.
    
  radialRightAngleDiagonal()
    d3.phylogram.rightAngleDiagonal for radial layouts.
*/

vg.data.phylogram = function() {
    // caller-defined properties
    var layout = 'cartesian';  // 'cartesian' | 'radial' | 'cladogram' | ???
    // Typically we will maintain proportional coordinates and distances;
    // these will be scaled downstream using SVG group transforms.
    var width = 1.0;
    var height = 1.0;
    var radialArc = [0, 360];  // angles of arc for a circular layout
    var radialSweep = 'CLOCKWISE';  // 'CLOCKWISE' or 'COUNTERCLOCKWISE'
    var branchStyle = ''; 
        // 'rightAngleDiagonal', 'radialRightAngleDiagonal', or a standard
        // D3 diagonal; by default, this will be based on the chosen layout
    var branchLengths = '';
    var tipsAlignment = 'right';
        // disregard for radial layouts?
    var orientation = -90; 
        // degrees of rotation from default (0, -90, 90, 180)
        // NOTE that this is not set directly (from vega spec) but from within
    var descentAxis = 'x'; // x|y
        // needed to render paths correctly
        // TODO: add more from options below
    var nodeLabelSource = 'MAPPED';  // 'ORIGINAL' or 'MAPPED'
        // choose preferred source for labels; fall back as needed and use marker classes
        // to distinguish these in display
    var showFallbackLabels = true;  // boolean

    function phylogram(data) {
      // Expecting incoming data in the 'phylotree' format described here:
      //  https://github.com/OpenTreeOfLife/tree-illustrator/wiki/Building-on-D3-and-Vega
      console.log('STARTING phylogram transform...');

      // scale all coordinates as directed
      if (width !== 1) {
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
                    pathGenerator = d3.svg.line();
                    break;
                case 'cartesian':
                    pathGenerator = rightAngleDiagonal();
                    break;
                default:
                    // allow for moretraditional paths
                    pathGenerator = d3.svg[branchStyle]();
            }
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

      // copy layout properties to the phylotree, for possible use downstream
      data.layout = layout;
      data.tipsAlignment = tipsAlignment;
      data.descentAxis = descentAxis;  // implicit in tipsAlignment?
      data.orientation = orientation;  // implicit in tipsAlignment?
      data.width = width;
      data.height = height;
      data.branchStyle = branchStyle;
      data.branchLengths = branchLengths;
      data.nodeLabelSource = nodeLabelSource;
      data.showFallbackLabels = showFallbackLabels;

      return data;
    }
      
    // Setters (called from Vega spec)
    
    phylogram.layout = function(s) {
      layout = s;
      return phylogram;
    };
      
    phylogram.branchStyle = function(s) {
      branchStyle = s;
      return phylogram;
    };
      
    phylogram.width = function(i) {
      width = i;
      return phylogram;
    };
      
    phylogram.radialArc = function(a) {
      // expects an array of start and end angle; if we get an integer, convert it
      if (vg.isArray(a)) {
        radialArc = a;
      } else {
        radialArc = [0, a];
      } 
      return phylogram;
    };
      
    phylogram.radialSweep = function(s) {
      switch(s) {
        case 'COUNTERCLOCKWISE':
        case 'CLOCKWISE':
          radialSweep = s;
          break;
        default:
          radialSweep = 'CLOCKWISE';
      } 
      return phylogram;
    };
      
    phylogram.height = function(i) {
      height = i;
      return phylogram;
    };
      
    phylogram.tipsAlignment = function(s) {
      // This places the tips on the specified edge, and sets the 
      // orientation (rotation angle)
      // N.B. Ignore this when making for radial layouts!
      var expectedValues = ['top','right','bottom','left'];
      s = $.trim(s).toLowerCase();
      if ($.inArray(s, expectedValues) === -1) {
        s = 'right';
      }
      tipsAlignment = s;
      switch(tipsAlignment) {
        case 'top':
          orientation = 180;
          descentAxis = 'y';
          break;
        case 'right':
          orientation = -90;
          descentAxis = 'x';
          break;
        case 'bottom':
          orientation = 0;
          descentAxis = 'y';
          break;
        case 'left':
          orientation = 90;
          descentAxis = 'x';
          break;
      }
      return phylogram;
    };
      
    phylogram.branchLengths = function(s) {
      branchLengths = s;
      return phylogram;
    };

    phylogram.nodeLabelSource = function(s) {
      switch(s) {
        case 'ORIGINAL':
        case 'MAPPED':
          nodeLabelSource = s;
          break;
        default:
          nodeLabelSource = 'MAPPED';
      } 
      return phylogram;
    }

    phylogram.showFallbackLabels = function(b) {
      showFallbackLabels = Boolean(b);
      return phylogram;
    }

    var displacePoint = function(point, delta) {
        // where 'delta' is an object with x and y properties
        point.x += delta.x;
        point.y += delta.y;
        return point;
    }

    var scalePoint = function(point) {
        // where point is any object having x and y properties
        // NOTE that we're scaling up from fractional values (0.0 - 1.0), so
        // the nominal width+height are also our scaling multipliers
        point.x *= width;
        point.y *= height;
        // scale cartesian_x and y, if stored
        if ('cartesian_x' in point) {
            point.cartesian_x *= width;
            point.cartesian_y *= height;
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
    // map Y coordinate to total spedified width
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
    var proportionalY = ((d.y / width) * totalArcDegrees);
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
            rotation = 0,
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
        // do nothing
    }
    var radialLayout = function(data) {
        // project points (nodes) to radiate out from center

        // move all points to put the root node at origin (0.0)
        var rootNode = data.phyloNodes[0];  // I believe this is always true
        var nudgeRootToOrigin = {x: -(rootNode.x), y: -(rootNode.y)};
        var alignPointsToOrigin = function(point) {
            return displacePoint(point, nudgeRootToOrigin);
        };
        data.phyloNodes.map(alignPointsToOrigin);
        
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
        // TODO: support branch lengths?
    }

    return phylogram;
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
    debugger;
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
