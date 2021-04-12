'use strict';

const browserify = require('browserify');
const ts = require("gulp-typescript");
const gulp = require('gulp');
const source = require('vinyl-source-stream')
const uglify = require('gulp-uglify');

const tsProject = ts.createProject('tsconfig.json');

gulp.task('ts', function() {
    return gulp.src('src/*.ts')
        .pipe(tsProject()).js
        .pipe(uglify())
        .pipe(gulp.dest('dist'));
});

gulp.task('bundle', function () {
    const b = browserify({
        entries : './dist/sdk.js',
        debug: true
    });

    return b.bundle()
        .pipe(source('sdk-bundle.js'))
        .pipe(gulp.dest('.'));
});

gulp.task('default', gulp.series('ts', 'bundle'));