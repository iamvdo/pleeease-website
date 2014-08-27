var input = document.querySelector('#input');
var output = document.querySelector('#output');
var elts = document.querySelectorAll('.play-options input');

if(location.search !== '') {
  var q = location.search.substring(1);
  input.value = decodeURI(q);
}

var editor = CodeMirror.fromTextArea(document.getElementById("input"), {
  mode: "text/css",
  lineWrapping: true
});

function htmlEntities (str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
var doPleeease = function () {
  var source = editor.getValue();
  var compiled = source;
  try {
    compiled = pleeease.process(source, options);
  } catch (err) {}
  output.innerHTML = Prism.highlight(compiled, Prism.languages.css);
};
//input.addEventListener('keyup', doPleeease);

// options
var options = {
  "autoprefixer": false,
  "minifier": false,
  "next": {}
};

function doOptions () {
  for (var i = 0; i < elts.length; i++) {
    var e = elts[i];
    var checked = !!e.checked;

    if (e.name.indexOf('next') !== -1) {
      var name = e.name.replace('next.', '');
      options['next'][name] = checked;
    } else {
      options[e.name] = checked;
    }
  }
  doPleeease();
}
doOptions();
for (var i = 0; i < elts.length; i++) {
  elts[i].addEventListener('change', doOptions);
}


editor.on('change', doPleeease);