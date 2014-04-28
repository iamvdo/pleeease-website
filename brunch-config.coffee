exports.config =
  paths:
    watched: ['app']
    public: ''
  files:
    stylesheets:
      joinTo: 'app.min.css'
      order:
        before: ['app/app.css']
  optimize: true
  modules:
    wrapper: false
    definition: false
  plugins:
    pleeease:
      autoprefixer: true
      minifier: false
      mqpacker: false
      polyfills:
        variables: true
        rem: false
    jaded:
      staticPatterns: /^app(\/|\\)templates(\/|\\)(.+)\.jade$/

  overrides:
    minifier:
      sourceMaps: false
      plugins:
        pleeease:
          minifier: true
          mqpacker: true