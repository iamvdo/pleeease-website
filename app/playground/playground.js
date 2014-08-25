var input = document.querySelector('#input');
var output = document.querySelector('#output');

if(location.search !== '') {
  var q = location.search.substring(1);
  input.value = decodeURI(q);
}

var options = {
  "minifier": false,
  "next": true
};
function htmlEntities (str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
var doPleeease = function () {
  var source = input.value;
  var compiled = source;
  try {
    compiled = pleeease.process(source, options);
  } catch (err) {}
  output.innerHTML = Prism.highlight(compiled, Prism.languages.css);
};
doPleeease();
input.addEventListener('keyup', doPleeease);