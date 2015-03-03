##Configuration file

When using CLI, Pleeease's options have to be set in a file called `.pleeeaserc` (JSON-like). For example:

```javascript
{
  "in": ["foo.css", "bar.css"],
  "out": "baz.css",
  "browsers": ["last 3 versions", "Android 2.3"]
}
```

###in

<div class="note">
Type: `String`, `Array` | Default: `"*.css"`
</div>

**Defines input file(s)**.

###out

<div class="note">
Type: `String` | Default: `"app.min.css"`
</div>

**Defines output file**.

###browsers

<div class="note">
Type: `Array`
</div>

**Allows you to override many options in one go**. Accept same value as `autoprefixer.browsers` and override it, based on CanIUse database (exactly as Autoprefixer)

For example, if you set:

```javascript
{
  "browsers": ["ie 9"]
}
```

You will automatically have:

```javascript
{
  "autoprefixer": { "browsers": ["ie 9"] },
  "rem": false,
  "opacity": false,
  "pseudoElements": false
}
```

Then, you can override [all postprocess options](#features) the same way.