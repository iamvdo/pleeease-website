// options
var options = {
  "minifier": false,
  "next": {}
};
function htmlEntities (str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function doPleeease () {
  var source = editor.getValue();
  var compiled = source;
  try {
    //console.log(options);
    compiled = pleeease.process(source, options);
  } catch (err) {
    console.log(err);
  }
  output.setValue(compiled);
}
function updateOptionAdvanced (checked, name) {
  var opts = {
    'autoprefixer': [function (value) {
      return {browsers:[value]};
    }, 'text'],
    'rem': [function (value) {
      return [value];
    }, 'text'],
    'filters': [function (value) {
      return {oldIE: true};
    }, 'check'],
    'next.customProperties': [function (value) {
      return {preserve: true};
    }, 'check']
  };

  if (opts[name]) {
    var type = opts[name][1];
    var value = document.getElementsByName(name + 'Opts').item(0);
    if (type === 'check') {
      value = value.checked;
    } else {
      value = value.value;
    }
    if ((type === 'text' && value !== '') || (type === 'check' && value)) {
      checked = opts[name][0](value);
    }
  }

  return checked;

}
function updateOption (checkbox, refresh) {

  var checked = !!checkbox.checked;

  if (checked && checkbox.getAttribute('value')) {
    checked = JSON.parse(checkbox.getAttribute('value'));
  }

  if (checked) {
    checked = updateOptionAdvanced(checked, checkbox.name);
  }

  if (checkbox.name.indexOf('next') !== -1) {
    var name = checkbox.name.replace('next.', '');
    options['next'][name] = checked;
  } else {
    options[checkbox.name] = checked;
  }

  refresh = typeof refresh !== 'undefined' ? refresh : true;
  if (refresh) {
    doPleeease();
  }
}
function doOptions () {

  for (var i = 0; i < checkboxes.length; i++) {
    var checkbox = checkboxes[i];

    updateOption(checkbox, false);

    checkbox.addEventListener('change', updateOption.bind(this, checkbox));

    var checkboxOpt = document.getElementsByName(checkbox.name + 'Opts');
    if (checkboxOpt.length !== 0) {
      checkboxOpt.item(0).addEventListener('keyup', updateOption.bind(this, checkbox));
      checkboxOpt.item(0).addEventListener('change', updateOption.bind(this, checkbox));
    }
  };

  doPleeease();

}

var input = document.querySelector('#input');
if(location.search !== '') {
  var q = location.search.substring(1);
  input.value = decodeURI(q);
}
var editor = CodeMirror.fromTextArea(document.getElementById("input"), {
  mode: "text/css",
  lineWrapping: true,
  profile: 'html'
});
var output = CodeMirror.fromTextArea(document.getElementById("output"), {
  mode: "text/css",
  lineWrapping: true,
  readOnly: true
});
editor.on('change', doPleeease);


var checkboxes = document.querySelectorAll('.play-block--options input[type=checkbox]');

/*start*/
doOptions();