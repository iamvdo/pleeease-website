#Workflow

##Node.js

You can use the `process` function with 2 parameters:

* `css` is the CSS as string
* `options` is an object specifying [options you want](/docs/#features)

It returns fixed CSS as string.

```javascript
var pleeease = require('pleeease'),
    fs       = require('fs');

var css = fs.readFileSync('app.css', 'utf8');

// define options here
var options = {};

var fixed = pleeease.process(css, options);

fs.writeFile('app.min.css', fixed, function (err) {
  if (err) {
    throw err;
  }
  console.log('File saved!');
});
```

You can also use Pleeease as a PostCSS plugin. For example, if you want to use another minifier:

```javascript
var postcss  = require('postcss'),
    pleeease = require('pleeease');

var options = {
  minifier: false
};

var fixed = postcss().use(pleeease(options)).use(minifier).process('a{}').css;
```

##With Brunch

If you're using [Brunch](http://brunch.io) (good point), you may want to use [brunch-pleeease](https://github.com/iamvdo/brunch-pleeease).

Add this plugin as a dependency in your `package.json`

```javascript
{
  "dependencies": {
    "brunch-pleeease": "^1.0.0"
  }
}
```

Or install it:

```javascript
$ npm install --save brunch-pleeease
```

Now, the module does its job. You can set it in Brunch configuration file, for example:

```javascript
plugins:
  pleeease:
    autoprefixer: true
    rem: false
    pseudoElements: false
    import: true
    minifier: true
    mqpacker: true
```

Note that brunch-pleeease is an optimizer plugin, so it only works when `optimize: true` is set. The `--production` environment activates optimizers.

If you want sourcemaps, from CSS or from a preprocessor like Sass, you can activate them in configuration file, like so:

```javascript
sourceMaps: true
plugins:
  pleeease:
    sourcemaps: true
```

The first `sourceMaps` option enable sourcemaps from Brunch (for [Sass brunch](https://github.com/brunch/sass-brunch) for example). The second one `plugins.pleeease.sourcemaps` enable sourcemaps for Pleeease (basically `@import`'ed file). **You can now have a full sourcemaps chain!**

You can also use the [pre-configured Pleeease skeleton](https://github.com/iamvdo/brunch-with-pleeease).

##With Gulp

You can use [gulp-pleeease](https://github.com/danielhusar/gulp-pleeease). Here is a `Gulpfile.js` example, with Sass and sourcemaps support:

```javascript
var gulp = require('gulp');
var sass = require('gulp-ruby-sass');
var pleeease = require('gulp-pleeease');

var SassOptions = {
    sourcemap: true,
    style: "compact"
};
// set minifier to false to keep Sass sourcemaps support
var PleeeaseOptions = {
    optimizers: {
        minifier: false
    }
};

gulp.task('awesome_css', function () {
    gulp.src('./scss/main.scss')
        .pipe(sass(SassOptions))
        .pipe(pleeease(PleeeaseOptions))
        .pipe(gulp.dest('./public'));
});
```

Note: This is based on [@ddprrt's article](http://fettblog.eu/blog/2014/04/10/gulp-sass-autoprefixer-sourcemaps/) for sourcemaps support. You can also use [gulp-sass](https://github.com/dlmanning/gulp-sass) (based on libsass) if you don't need sourcemaps.

##With Grunt

You can use [grunt-pleeease](https://github.com/danielhusar/grunt-pleeease).