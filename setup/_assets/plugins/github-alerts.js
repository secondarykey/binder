/* @plugin-name: GitHub Alerts */
//
// GitHub style alert blockquotes (Note, Tip, Important, Warning, Caution)
//
// Usage:
//   > [!NOTE]
//   > Useful information that users should know.
//
//   > [!TIP]
//   > Helpful advice for doing things better or more easily.
//
//   > [!IMPORTANT]
//   > Key information users need to know.
//
//   > [!WARNING]
//   > Urgent info that needs immediate user attention to avoid problems.
//
//   > [!CAUTION]
//   > Advises about risks or negative outcomes of certain actions.
//
(function() {

  var alertTypes = {
    NOTE:      { icon: 'ℹ️',  label: 'Note',      className: 'alert-note' },
    TIP:       { icon: '💡', label: 'Tip',       className: 'alert-tip' },
    IMPORTANT: { icon: '❗',  label: 'Important', className: 'alert-important' },
    WARNING:   { icon: '⚠️',  label: 'Warning',   className: 'alert-warning' },
    CAUTION:   { icon: '🛑', label: 'Caution',   className: 'alert-caution' },
  };

  var alertPattern = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/;

  return {
    renderer: {
      blockquote: function(token) {
        var body = this.parser.parse(token.tokens);

        var match = body.match(/^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?/);
        if (!match) {
          match = body.match(/^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]<br>/);
        }
        if (!match) {
          match = body.match(/^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*<\/p>/);
        }

        if (!match) {
          return '<blockquote>\n' + body + '</blockquote>\n';
        }

        var type = alertTypes[match[1]];
        var content = body.replace(match[0], '<p>');

        if (content.replace(/<p>\s*<\/p>/g, '').trim() === '') {
          content = '';
        }

        return '<div class="binder-alert ' + type.className + '">'
          + '<p class="binder-alert-title">'
          + '<span class="binder-alert-icon">' + type.icon + '</span> '
          + type.label
          + '</p>'
          + content
          + '</div>\n';
      }
    }
  };
})();
