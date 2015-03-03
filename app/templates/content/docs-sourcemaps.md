##Sourcemaps

**Pleeease generates sourcemaps** (disabled by default). Enable them in options:

```javascript
{
    "sourcemaps": true
}
```

If you want to have correct sourcemaps, you should always specify `in` and `out` files:

```javascript
{
    "in": "input.css",
    "out": "output.css",
    "sourcemaps": true
}
```

By default, sourcemaps will be inlined in CSS. If you want separate sourcemaps, you need to set `sourcemaps` option based on [PostCSS documentation](https://github.com/postcss/postcss#source-maps):

```javascript
{
    "in": "input.css",
    "out": "output.css",
    "sourcemaps": {
        "map": {
            "inline": false
        }
    }
}
```

If you're using [CLI tool](#cli), two files will be written on disk. With programmatic usage, Pleeease will return an object with `css` and `map` properties.

```javascript
var opts = {
    "in": "input.css",
    "out": "output.css",
    "sourcemaps": {
        "map": {
            "inline": false
        }
    }
};

var fixed = pleeease.process('a{a:a}', opts);

// fixed.css
// fixed.map
```

If [you've activated a preprocessor](#preprocessors), no need for more options. You will get sourcemaps from preprocessor.