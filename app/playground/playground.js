// options
var options = {
  "minifier": false,
  "next": {}
};
var samples = {
  'autoprefixer': ".a {\n  display: flex;\n  background: linear-gradient(red, green);\n}",
  'rem': ".rem {\n  width: 2rem;\n}",
  'pseudoElements': ".a::after {\n  content: 'foo!';\n}",
  'opacity': "a {\n  opacity: .5\n}",
  'filters': "a {\n  filter: blur(2px);\n}",
  'next': "/* CSS variables */\n:root {\n  --color-primary: red;\n  --height: 2em;\n}\n.a {\n  background: var(--color-primary);\n}\n\n/* CSS resolve calc */\n.b {\n  width: calc(100% - 2em);\n  height: calc(4em * var(--height));\n}\n\n/* custom media */\n@custom-media --small-viewport (max-width: 25em);\n@media (--small-viewport) {\n  /*stuff here*/\n}\n\n/* colors */\n.c {\n  color: color(orangered a(.5));\n  color: #F00A;\n}"
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
  var scrollTop = output.doc.scrollTop;
  output.setValue(compiled);
  //doScroll(output, 'output');
  output.scrollTo(0, scrollTop);
}
function updateOptionAdvanced (checked, name) {
  var opts = {
    'autoprefixer': [function (value) {
      var values = value.split(',');
      values = values.map(function (val) {
        return val.trim();
      });
      return {browsers: values};
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

  if (checked) {
    if (checkbox.getAttribute('value')) {

      checked = JSON.parse(checkbox.getAttribute('value'));
            console.log(checked);
    }
    checked = updateOptionAdvanced(checked, checkbox.name);
    if (checkbox.name === 'wrap') {
      editor.setOption('lineWrapping', true);
      output.setOption('lineWrapping', true);
    }
  } else {
    if (checkbox.name === 'wrap') {
      editor.setOption('lineWrapping', false);
      output.setOption('lineWrapping', false);
    }
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
function updateSample (sample) {
  var sample = sample.getAttribute('data-sample');
  editor.setValue(samples[sample]);
}
function doOptions () {

  var checkboxes = document.querySelectorAll('.play-block--options input[type=checkbox]');

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
function doSamples () {

  var samples = document.querySelectorAll('.samples-item');


  for (var i = 0; i < samples.length; i++) {
    var sample = samples[i];

    sample.addEventListener('click', function (e) { updateSample(this); e.preventDefault(); });
  }

}
function doScroll (e, type) {
/*
  if (type === 'editor') {
    output.removeEventListener('scroll');
  } else {
    editor.removeEventListener('scroll');
  }
*/
  var height = e.doc.height;
  var scrollTop = e.doc.scrollTop;

  var heightOther = (type === 'editor') ? output.doc.height : editor.doc.height;
  var scrollTopOther = (scrollTop * heightOther) / height;
  if (type === 'editor') {
    output.scrollTo(0, scrollTopOther);
  } else {
    //console.log(editor);
    editor.scrollTo(0, scrollTopOther);
  }

}

var editor = CodeMirror.fromTextArea(document.getElementById("input"), {
  mode: "text/css",
  profile: 'html'
});
if(location.search !== '') {
  var q = location.search.substring(1);
  editor.setValue(decodeURIComponent(q));
} else {
  editor.setValue(samples['autoprefixer']);
}

var output = CodeMirror.fromTextArea(document.getElementById("output"), {
  mode: "text/css",
  theme: 'default output',
  readOnly: true
});

editor.on('change', doPleeease);

/*start*/
doOptions();
doSamples();

function handleScrollInput (e) {
  doScroll(e,'editor');
}
function handleScrollOutput (e) {
  doScroll(e,'output');
}

var cms = document.querySelectorAll('.CodeMirror');

for (var i = 0; i < cms.length; i++) {
  cms[i].addEventListener('mouseenter', function (e) {
    var input = e.target.parentNode.className.indexOf('play-block--input') !== -1;
    if (input) {
      output.off('scroll', handleScrollOutput);
      editor.off('scroll', handleScrollInput);
      editor.on('scroll', handleScrollInput);
    } else {
      editor.off('scroll', handleScrollInput);
      output.off('scroll', handleScrollOutput);
      output.on('scroll', handleScrollOutput);
    }
  });
};
