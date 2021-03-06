##Pleeease.NEXT

Pleeease**.NEXT** goes even further and allows you to use some of the future CSS's features today.

**Be careful!** All these features are at-risk. You can read [these great advices from Rodney Rehm](http://blog.rodneyrehm.de/archives/30-CSS-Polyfill-Preprocessor-Its-A-Myth.html) about Myth. Same conclusion goes here with Pleeease.NEXT. **Make responsible use of it**.

Each property can be enable in `next` option:

```javascript
{
    "next": {
      "customProperties": true,
      "colors": true
    }
}
```

Or enable all properties:

```javascript
{
    "next": true
}
```

###customProperties

<div class="note">
Type: `Object` | Default: `{preserve: false}`
</div>

**Transforms CSS custom properties** into more compatible CSS. Custom properties are basically CSS variables.

CSS variables begins with `--` and have to be declared in a `:root` rule (this is a limitation from real CSS spec). Then, they can be used with the `var(--variable)` notation.

It converts this file:

```css
:root {
  --color-primary: blue;
}
.element {
  color: var(--color-primary);
}
```

To this one:

```css
.element {
  color: blue;
}
```

You can also keep var-declarations with `{preserve: true}`.

See [postcss-custom-properties in GitHub](https://github.com/postcss/postcss-custom-properties)

###customMedia

<div class="note">
There are no options.
</div>

**Transforms custom media-queries** into more compatible CSS.

CSS custom media-queries have to be declared in an `@custom-media` rule and can be used in `@media` statements, with the `--` syntax.

It converts this file:

```css
@custom-media --small-viewport (max-width: 30em);
@media (--small-viewport) {
  /* styles for small viewport */
}
```

To this one:

```css
@media (max-width: 30em) {
  /* styles for small viewport */
}
```

###calc

<div class="note">
There are no options.
</div>

**Resolves `calc()` references** whenever possible.

It converts this file:

```css
.e {
  width: calc(100% - 50px);
  height: calc(2em * 2);
}
```

To this one:

```css
.e {
  width: calc(100% - 50px);
  height: 4em;
}
```

This could be particularly useful with the `customProperties` option.

**Note:** Necessary prefixes are added by Autoprefixer afterward.


###colors

<div class="note">
Type: `Object` | Default: `{color: true, hexAlpha: true, hwb: true, rebbecapurple: true}`
</div>

**Transforms CSS4 color functions** to more compatible CSS.

* transforms `color()`
* transforms `#RRGGBBAA`
* transforms `hwb()`
* allows to use `rebeccapurple` color

It converts this file:

```css
.e {
  color: #F000;
  background: color(black a(.5));
}
```

To this one:

```css
.e {
  color: rgba(255, 0, 0, 0);
  background: rgba(0, 0, 0, .5);
}
```

