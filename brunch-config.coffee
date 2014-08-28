exports.config =
  paths:
    watched: ['app']
    public: ''
  files:
    javascripts:
      joinTo:
        'play/playground.js': /^app(\/|\\)playground/
        'play/pleeease.js'  : /^app(\/|\\)pleeease/
      order:
        before: [
          'app/playground/codemirror.js',
          'app/playground/codemirror-css.js',
          'app/playground/emmet.js',
          'app/playground/prism.js'
        ]
    stylesheets:
      joinTo: 'app.min.css'
      order:
        before: [
          'app/playground/codemirror.css',
          'app/app.css'
        ]
  optimize: true
  modules:
    wrapper: false
    definition: false
  plugins:
    pleeease:
      fallbacks:
        autoprefixer: true
        variables: true
        rem: false
      optimizers:
        import: false
        minifier: false
        mqpacker: false
    jaded:
      staticPatterns: /^app(\/|\\)templates(\/|\\)(.+)\.jade$/

  overrides:
    minifier:
      sourceMaps: false
      plugins:
        pleeease:
          optimizers:
            minifier: true
            mqpacker: true