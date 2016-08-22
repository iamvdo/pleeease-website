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
  npm:
    enabled: false
  sourceMaps: true
  plugins:
    pleeease:
      import: false
      minifier: false
      mqpacker: false
      next: true
    jaded:
      staticPatterns: /^app(\/|\\)templates(\/|\\)(.+)\.jade$/

  overrides:
    minifier:
      sourceMaps: false
      plugins:
        pleeease:
          minifier: true
          mqpacker: false