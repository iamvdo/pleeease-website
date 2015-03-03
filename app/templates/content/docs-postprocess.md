##Postprocessors

Features can be disabled with the `false` keyword or modified using each postprocessor options. See each features:

* [autoprefixer](#autoprefixer), [filters](#filters), [rem](#rem), [pseudoElements](#pseudoelements), [opacity](#opacity)
* [import](#import), [minifier](#minifier), [mqpacker](#mqpacker)
* [Pleeease.NEXT](#pleeease-next)
* [sourcemaps](#sourcemaps)

The default options are:

```javascript
{
  "autoprefixer": true,
  "filters": true,
  "rem": true,
  "pseudoElements": true,
  "opacity": true,

  "import": true,
  "minifier": true,
  "mqpacker": false,

  "sourcemaps": false,

  "next": false
}
```

###autoprefixer

<div class="note">
Type: `Object` | Default: `{browsers: ["> 1%", "last 2 versions", "Firefox ESR", "Opera 12.1"], cascade: true}`
</div>

**Adds vendor prefixes to CSS**, using [Autoprefixer](https://github.com/ai/autoprefixer). From Autoprefixer options, you can specify the browsers you want to target in your project:

* `last 2 versions` is last versions for each browser
* `last 2 Chrome versions` is last versions of the specified browser.
* `> 5%` is browser versions, selected by global usage statistics.
* `Firefox > 20` is Firefox versions newer than 20.
* `Firefox >= 20` is Firefox version 20 or newer.
* `ios 7` to set browser version directly.
* `none` clean CSS from any vendor prefixes.

For example:

```javascript
{
  "autoprefixer": {"browsers": ["last 4 versions", "ios 6"]}
}
```

Autoprefixer converts this file:

```css
.element {
  display: flex;
  flex-direction: column;
  background: linear-gradient(red, blue);
}
```

To this one:

 ```css
.element {
  display: -webkit-box;
  display: -webkit-flex;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-orient: vertical;
  -webkit-box-direction: normal;
  -webkit-flex-direction: column;
      -ms-flex-direction: column;
          flex-direction: column;
  background: -webkit-gradient(linear, left top, left bottom, from(red), to(blue));
  background: -webkit-linear-gradient(red, blue);
  background: linear-gradient(red, blue);
}
```

You can also disable visual cascade for CSS prefixes:

```javascript
{
  "autoprefixer": {"cascade": false}
}
```

See [Autoprefixer on GitHub](https://github.com/ai/autoprefixer).

###filters

<div class="note">
Type: `Object` | Default: `{oldIE: false}`
</div>

**Converts CSS shorthand filters to SVG equivalent**, using [pleeease-filters](https://github.com/iamvdo/pleeease-filters).

It converts this file:

```css
.blur {
  filter: blur(4px);
}
```

To this one:

```css
.blur {
  filter: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"><filter id="filter"><feGaussianBlur stdDeviation="4" /></filter></svg>#filter');
  -webkit-filter: blur(4px);
          filter: blur(4px);
}
```

Great combo with Autoprefixer!

You can also force IE filters with an option:

```javascript
{
  "filters": { "oldIE": true }
}
```

Using the first example, you'll get:

```css
.blur {
  filter: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"><filter id="filter"><feGaussianBlur stdDeviation="4" /></filter></svg>#filter');
  -webkit-filter: blur(4px);
          filter: blur(4px);
  filter: progid:DXImageTransform.Microsoft.Blur(pixelradius=4);
}
```

Then, needed prefixes are added by Autoprefixer. You don't have to care about this.

**Be careful**, not all browsers support CSS or SVG filters. For your information, latest WebKit browsers support CSS shorthand, Firefox support SVG filters and IE9- support IE filters (limited and slightly degraded). **It means that IE10+, Opera Mini and Android browsers have no support at all**. Moreover, IE filters shouldn't be used.

###rem

<div class="note">
Type: `Array` | Default: `["16px", {replace: false, atrules: false}]`
</div>

**Generates pixel fallbacks for `rem` units**, using [pixrem](https://github.com/robwierzbowski/node-pixrem). Add options as an array:

* first parameter is the root font-size (default `16px`)
* second parameter is an object with:
  * `replace` if you want to replace value (default `false`)
  * `atrules` if you want to replace rem even in at-rules (default `false`)

```javascript
{
  "rem": ["16px"]
}
```

Pixrem converts this file:

```css
.element {
  font-size: 2rem;
}
```

To this one:

```css
.element {
  font-size: 32px;
  font-size: 2rem;
}
```

**Pixrem don't generates `rem` fallbacks when browsers without `rem` support don't understand the property/value** (eg in media-queries (all at-rules actually), in properties like `transform`, `border-radius`, etc. and in values like `calc()` or `linear-gradient()`)

**Pixrem also tries to read root font-size value from CSS**, if defined. This means that:

```css
html { font-size: 20px; }
.a { font-size: 2rem; }
```

gives

```css
html { font-size: 20px; }
.a { font-size: 40px; font-size: 2rem; }
```

See [pixrem on GitHub](https://github.com/robwierzbowski/node-pixrem).

###pseudoElements

**Converts pseudo-elements using CSS3 syntax** (two-colons notation like `::after`, `::before`, `::first-line` and `::first-letter`) with the old one, using only one colon (useful for IE8 support). There are no options.

Converts this file:

```css
.element::after {
  content: '';
}
```

To this one:
```css
.element:after {
  content: '';
}
```

###opacity

**Adds opacity filter for IE8** when using `opacity` property.

Converts this file:

```css
.element {
  opacity: .5;
}
```

To this one:
```css
.element {
  opacity: .5;
  filter: alpha(opacity=50);
}
```

See [postcss-opacity on GitHub](https://github.com/iamvdo/postcss-opacity).

###import

<div class="note">
Type: `Object` | Default: `{path: process.cwd(), encoding: "utf8", transform: null}`
</div>

**Inlines `@import` styles**, using [postcss-import](https://github.com/postcss/postcss-import) and rebases URLs if needed.

You can use the CSS syntax you want:

```css
@import "file.css";
@import url(file.css);
@import url("http://foo.com/bar.css"); /* not imported */
@import url("file.css") screen and (max-width: 35em); /* imported in media-queries */
```

Note that you can set the "root" folder for imported files with `path` option, even if this is not the root of your project (default is `process.cwd()`). For example, if you compile `css/foo.css` that containing an `@import`, set options like this:

```javascript
{
    "import": {"path": "css"}
}
```

URLs are rebased according to destination file. Configure this by setting `out` option:

```javascript
{
    "out": "path/to/destination/file.css"
}
```

**Important note:** In edge cases, this processor may cause unloaded files by browsers. Always check generated CSS and open issue if you encounter problems.

See [postcss-import on GitHub](https://github.com/postcss/postcss-import#postcss-import-).

###minifier

<div class="note">
Type: `Object` | Default: `{preserveHacks: true, removeAllComments: false}`
</div>

**Minifies**, using [CSS Wring](https://github.com/hail2u/node-csswring).

###mqpacker

**Packs same CSS media-queries into one media-query rule**, using [MQ Packer](https://github.com/hail2u/node-css-mqpacker). There are no options.

Mqpacker can convert multiple files like this:

```css
@media (max-width: 36em) {
  .element {
    color: red;
  }
}
```
```css
@media (max-width: 36em) {
  .test {
    color: blue;
  }
}
```

To this one:

```css
@media (max-width: 36em) {
  .element {
    color: red;
  }
  .test {
    color: blue;
  }
}
```

**Important note:** In edge cases, this processor can [produce unsafe grouping](https://github.com/hail2u/node-css-mqpacker/issues/16). Always check generated CSS and open issue if you encounter problems.