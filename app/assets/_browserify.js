var pleeease = require('pleeease');

var input = document.querySelector('#input');
var output = document.querySelector('#output');

var options = {
	"optimizers": {
		"minifier": false
	}
};
var doPleeease = function () {
  var source = input.value;
  var compiled = source;
  try {
    compiled = pleeease.process(source, options);
  } catch (err) {}
  output.value = compiled;
};
doPleeease();
input.addEventListener('keyup', doPleeease);

if(location.search !== '') {
  var q = location.search.substring(1);
  input.value = decodeURI(q);
}