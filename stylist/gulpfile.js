'use strict';

var browserify = require('browserify');
var gulp = require('gulp');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var uglify = require('gulp-uglify');
//var sourcemaps = require('gulp-sourcemaps');
var gutil = require('gulp-util');

gulp.task('default', function() {
    // place code for your default task here
    console.log("default task (does nothing!)");
});

gulp.task('js', function () {
  // call from command line as 'gulp js'
  // set up the browserify instance on a task basis
  var b = browserify({
    entries: './stylist.js',
    //entries: './vg.data.stash.js',
    debug: true  // enables sourcemaps
  });

  return b.bundle()
    .pipe(source('stylist-bundle.js'))
    .pipe(buffer())
    /*
    .pipe(sourcemaps.init({loadMaps: true}))
        // Add transformation tasks to the pipeline here.
        .pipe(uglify())
        .on('error', gutil.log)
    .pipe(sourcemaps.write('./'))
    */
    .pipe(gulp.dest('./'));
});
