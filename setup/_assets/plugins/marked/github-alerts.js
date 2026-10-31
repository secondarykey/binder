/* @plugin-name: GitHub Alerts */
/* @plugin-version: 1.1.0 */
/* @marked: >=14 <19 */
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
// Titles:
//   The title of each alert comes from the "titles" table below.
//   Edit it to match the language of your site (for example NOTE: '補足').
//
//   Text written after the marker is used as the title of that alert only:
//   > [!TIP] Shortcut
//   > Press Ctrl+S to save.
//   (GitHub itself shows such a blockquote as a plain quote.)
//
(function() {

  // Titles shown above the alerts. Edit these to translate them.
  var titles = {
    NOTE:      'Note',
    TIP:       'Tip',
    IMPORTANT: 'Important',
    WARNING:   'Warning',
    CAUTION:   'Caution',
  };

  var alertTypes = {
    NOTE:      { icon: 'ℹ️',  className: 'alert-note' },
    TIP:       { icon: '💡', className: 'alert-tip' },
    IMPORTANT: { icon: '❗',  className: 'alert-important' },
    WARNING:   { icon: '⚠️',  className: 'alert-warning' },
    CAUTION:   { icon: '🛑', className: 'alert-caution' },
  };

  // "<p>[!TYPE] optional title" followed by a line break, <br> or the end of the paragraph
  var markerPattern = /^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(.*?)(?:\n|<br\s*\/?>\n?|(?=<\/p>))/;

  return {
    renderer: {
      blockquote: function(token) {
        var body = this.parser.parse(token.tokens);

        var match = body.match(markerPattern);
        if (!match) {
          return '<blockquote>\n' + body + '</blockquote>\n';
        }

        var type = alertTypes[match[1]];
        var title = match[2].trim() || titles[match[1]];

        // Keep the rest of the first paragraph, and drop it if only the marker was in it
        var content = ('<p>' + body.substring(match[0].length)).replace(/^<p>\s*<\/p>\s*/, '');
        if (content.replace(/<p>\s*<\/p>/g, '').trim() === '') {
          content = '';
        }

        return '<div class="binder-alert ' + type.className + '">'
          + '<p class="binder-alert-title">'
          + '<span class="binder-alert-icon">' + type.icon + '</span> '
          + title
          + '</p>'
          + content
          + '</div>\n';
      }
    }
  };
})();
