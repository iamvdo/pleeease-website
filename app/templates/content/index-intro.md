**Pleeease is a Node.js application that easily process your CSS**. It simplifies the use of preprocessors and combines them with best postprocessors. It helps create clean stylesheets, support older browsers and offers better maintenability. This means no more Compass for prefixes, no more `rem` mixins, and so on. Everything is getting simpler now and almost magic*.

**Write plain CSS** or **choose your favorite CSS preprocessor** (**Sass**, **LESS** or **Stylus**) and let Pleeease do its job:

* **[preprocess CSS](/docs/#preprocessors)** (experimental)
* adds **prefixes**, based on [Autoprefixer](https://github.com/ai/autoprefixer)
* provides fallbacks for **`rem`** unit, CSS3 **pseudo-elements** notation
* adds **opacity filter** for IE8
* converts **CSS shorthand filters** to SVG equivalent
* **packs same media-query** in one `@media` rule
* **inlines `@import`** styles
* **minifies** the result
* **[generates sourcemaps](/docs/#sourcemaps)** from pre- to postprocessors

**Pleeease is the easy way to combine preprocessors and postprocessors**.

<div class="note">* not real magic though</div>