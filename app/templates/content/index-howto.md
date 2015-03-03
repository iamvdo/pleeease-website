##How it (simply) works

Pleeease **does not** modifiy your code. It simply creates another file that **increases browser support**. What you have to do is to configure the input and output files.

For example, let's say you have `"styles.css"` that you want to compile to `"styles.fixed.css"`, create a new [configuration file](/docs/#configuration-file) with:

```javascript
{
  "in": "style.css",
  "out": "styles.fixed.css"
}
```

And run Pleeease

```javascript
$ pleeease compile
```

If `"styles.css"` is:

```css
@import url("bar.css");

*, *::after, *::before {
  box-sizing: border-box;
}

.a {
  font-size: 2rem;
  width: calc(100% - 50px);
}

@media (min-width: 36em) {
  .a {
    color: red;
  }
}

@media (min-width: 36em) {
  .b {
    color: blue;
  }
}
```

`"styles.fixed.css"` will be:

```css
.bar {
  /* imported styles */
}

*, *:after, *:before {
  -webkit-box-sizing: border-box;
     -moz-box-sizing: border-box;
          box-sizing: border-box;
}

.a {
  font-size: 32px;
  font-size: 2rem;
  width: -webkit-calc(100% - 50px);
  width: calc(100% - 50px);
}

@media (min-width: 36em) {
  .a {
    color: red;
  }
  .b {
    color: blue;
  }
}
```

Pretty cool, isn't it?

If you're ready to use it, you now need to learn how to [create a configuration file](docs/#configuration-file), and then [see full features support](docs/#features)!