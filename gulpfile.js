'use strict';

// This gulpfile makes use of new JavaScript features.
// Babel handles this without us having to do anything. It just works.
// You can read more about the new JavaScript features here:
// https://babeljs.io/docs/learn-es2015/

var path = require('path')
var gulp = require('gulp')
var del = require('del')
var runSequence = require('run-sequence')
var browserSync = require('browser-sync')
var gulpLoadPlugins = require('gulp-load-plugins')
var pkg = require('./package.json')
var fs = require('fs')

var $ = gulpLoadPlugins()
var reload = browserSync.reload

// 设置env环境
var env = 'dev'
function setEnv (type) {
  env = type || 'env'
  fs.writeFile('src/libs/env.js', 'window.env = "' + env + '"', function (err) {
    err && console.log(err)
  })
}

// Lint JavaScript
gulp.task('lint', () =>
  gulp.src(['src/js/**/*.js'])
    .pipe($.eslint())
    .pipe($.eslint.format())
    .pipe($.if(!browserSync.active, $.eslint.failAfterError()))
);

// Optimize images
gulp.task('images', () =>
  gulp.src('src/styles/images/**/*')
    .pipe($.cache($.imagemin({
      progressive: true,
      interlaced: true
    })))
    .pipe(gulp.dest('dist/styles/images/'))
    .pipe($.size({title: 'images'}))
);

// Copy all files at the root level (app)
gulp.task('copy', () =>
  gulp.src([
    // 'src/libs/*',
    // '!src/*.html',
  ], {
    dot: true
  }).pipe(gulp.dest('dist'))
    .pipe($.size({title: 'copy'}))
);

// Compile and automatically prefix stylesheets
gulp.task('styles', () => {
  const AUTOPREFIXER_BROWSERS = [
    'ie >= 10',
    'ie_mob >= 10',
    'ff >= 30',
    'chrome >= 34',
    'safari >= 7',
    'opera >= 23',
    'ios >= 7',
    'android >= 4.4',
    'bb >= 10'
  ];

  // For best performance, don't add Sass partials to `gulp.src`
  return gulp.src([
    'src/styles/**/*.scss',
    'src/styles/**/*.css'
  ])
    .pipe($.newer('.tmp/styles'))
    // source map
    .pipe($.sourcemaps.init())
    // .pipe($.sass({
    //   precision: 10
    // }).on('error', $.sass.logError))
    .pipe($.autoprefixer(AUTOPREFIXER_BROWSERS))
    .pipe(gulp.dest('.tmp/styles'))
    // Concatenate and minify styles
    .pipe($.if('*.css', $.cssnano()))
    .pipe($.size({title: 'styles'}))
    // .pipe($.sourcemaps.write('./'))
    .pipe(gulp.dest('dist/styles/'))
    .pipe(gulp.dest('.tmp/styles'));
});

// Concatenate and minify JavaScript. Optionally transpiles ES2015 code to ES5.
// to enable ES2015 support remove the line `"only": "gulpfile.babel.js",` in the
// `.babelrc` file.
gulp.task('scripts', () => 
    gulp.src([
      // Note: Since we are not using useref in the scripts build pipeline,
      //       you need to explicitly list your scripts here in the right order
      //       to be correctly concatenated
      'src/js/*.js', 'src/libs/dropload.min.js'
      // Other scripts
    ])
      .pipe($.newer('.tmp/scripts'))
      // .pipe($.sourcemaps.init())
      // .pipe($.babel())
      // .pipe($.sourcemaps.write())
      // .pipe(gulp.dest('.tmp/scripts'))
      // .pipe($.concat('main.min.js'))
      .pipe($.uglify())
      // Output files
      .pipe($.size({title: 'scripts'}))
      // .pipe($.sourcemaps.write('.'))
      .pipe(gulp.dest('dist/js/'))
      .pipe(gulp.dest('.tmp/scripts'))
);

gulp.task('scripts:prod', () =>
    // 忽略dropload是因为不打包在vendor中，在script中单独引入
    gulp.src(['src/libs/*.js', '!src/libs/vconsole.min.js', '!src/libs/dropload.min.js'])
        .pipe($.concat('vendor.js'))
        .pipe(gulp.dest('dist/js/'))
)

gulp.task('scripts:vender', () =>
    gulp.src(['src/libs/*.js'])
        .pipe($.concat('vender.js'))
        .pipe(gulp.dest('dist/js/'))
)

// Scan your HTML for assets & optimize them
gulp.task('html', () => {
  return gulp.src(['src/**/*.html', '!src/**/2.html'])
    .pipe($.useref({
      searchPath: '{.tmp,app}',
      noAssets: true
    }))

    // add vendor to each file
    .pipe($.cheerio(function($) {
      var removeLists = ['./libs/axios.min.js', './libs/zepto.min.js', './libs/axios.min.js', './libs/zepto.min.js', './libs/vconsole.min.js']
      $('script').each(function() {
        // 去除多余的script标签
        var script = $(this);
        var src = script[0].attribs.src
        if (removeLists.indexOf(src) > -1) {
          script.remove();
        }
      })
      $($('script')[0]).before('<script src="/js/vendor.js"></script>')
    }))

    // Minify any HTML
    .pipe($.if('*.html', $.htmlmin({
      removeComments: true,
      collapseWhitespace: true,
      collapseBooleanAttributes: true,
      removeAttributeQuotes: true,
      removeRedundantAttributes: true,
      removeEmptyAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      removeOptionalTags: true
    })))
    // Output files
    .pipe($.if('*.html', $.size({title: 'html', showFiles: true})))
    .pipe(gulp.dest('dist/'));
});

// handle index.html 
gulp.task('indexHtml', () => {
  gulp.src('src/**/*.html')
    .pipe($.cheerio(function($) {
      var removeLists = ['./libs/axios.min.js', './libs/zepto.min.js']
      $('script').each(function() {
        // 去除多余的script标签
        var script = $(this);
        var src = script[0].attribs.src
        if (removeLists.indexOf(src) > -1) {
          script.remove();
        }
      })
      $($('script')[0]).before('<script src="./js/vendor.js"></script>')
    }))
    .pipe(gulp.dest('dist/'))
})

// Clean output directory
gulp.task('clean', () => del(['.tmp', 'dist/*', '!dist/.git'], {dot: true}));

// Watch files for changes & reload
gulp.task('serve', ['lint', 'scripts', 'styles'], () => {
  setEnv('development')
  browserSync({
    notify: false,
    // Customize the Browsersync console logging prefix
    logPrefix: 'WSK',
    // Allow scroll syncing across breakpoints
    scrollElementMapping: ['main', '.mdl-layout'],
    // Run as an https by uncommenting 'https: true'
    // Note: this uses an unsigned certificate which on first access
    //       will present a certificate warning in the browser.
    // https: true,
    server: ['.tmp', 'src/'],
    port: 3000
  });

  gulp.watch(['src/**/*.html'], reload);
  gulp.watch(['src/styles/**/*.{scss,css}'], ['styles', reload]);
  gulp.watch(['src/js/**/*.js'], ['lint', 'scripts', reload]);
});

// Build and serve the output from the dist build
gulp.task('serve:dist', ['default'], () =>
  browserSync({
    notify: false,
    logPrefix: 'WSK',
    // Allow scroll syncing across breakpoints
    scrollElementMapping: ['main', '.mdl-layout'],
    // Run as an https by uncommenting 'https: true'
    // Note: this uses an unsigned certificate which on first access
    //       will present a certificate warning in the browser.
    // https: true,
    server: 'dist',
    port: 3001
  })
);

// Build production files, the default task
// gulp.task('default', ['clean'], cb =>
//   runSequence(
//     'styles',
//     ['lint', 'html', 'scripts', 'images', 'copy'],
//     'generate-service-worker',
//     cb
//   )
// );

gulp.task('default', ['clean'], cb =>
  runSequence(
    'styles',
    ['html', 'scripts', 'scripts:vender', 'images'],
    cb
  )
);

gulp.task('build', ['clean'], cb => {
  setEnv('production')
  runSequence(
    'styles',
    ['html', 'scripts', 'scripts:prod', 'images'],
    cb
  )
});

// Run PageSpeed Insights
// gulp.task('c', cb =>
//   // Update the below URL to the public URL of your site
//   pagespeed('example.com', {
//     strategy: 'mobile'
//     // By default we use the PageSpeed Insights free (no API key) tier.
//     // Use a Google Developer API key if you have one: http://goo.gl/RkN0vE
//     // key: 'YOUR_API_KEY'
//   }, cb)
// );
 

// Load custom tasks from the `tasks` directory
// Run: `npm install --save-dev require-dir` from the command-line
// try { require('require-dir')('tasks'); } catch (err) { console.error(err); }
