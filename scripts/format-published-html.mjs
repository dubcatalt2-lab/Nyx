import beautify from 'js-beautify';

export function formatPublishedJs(source) {
  return beautify.js(source, {indent_size:2,wrap_line_length:120,
    preserve_newlines:true,max_preserve_newlines:1,end_with_newline:true,eol:'\n'});
}

// Layout only: keep whitespace-sensitive content and already-built scripts
// intact. Variable mangling remains the responsibility of the build compiler.
export function formatPublishedHtml(source) {
  return beautify.html(source, {
    indent_size: 2,
    indent_inner_html: true,
    preserve_newlines: false,
    max_preserve_newlines: 1,
    wrap_line_length: 100,
    wrap_attributes: 'auto',
    content_unformatted: ['pre', 'textarea', 'script', 'style'],
    end_with_newline: true,
    eol: '\n',
    templating: ['none']
  });
}
