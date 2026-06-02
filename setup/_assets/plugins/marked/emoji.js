/* @plugin-name: Emoji (:name:) */
//
// :絵文字名: を絵文字文字に変換する。
//
// 使い方:
//   :smile: → 😄
//   :warning: → ⚠️
//   :rocket: → 🚀
//
(function() {
  var emojiMap = {
    // 顔・感情
    'smile':            '😄',
    'laughing':         '😆',
    'blush':            '😊',
    'wink':             '😉',
    'heart_eyes':       '😍',
    'joy':              '😂',
    'sweat_smile':      '😅',
    'thinking':         '🤔',
    'sunglasses':       '😎',
    'cry':              '😢',
    'sob':              '😭',
    'angry':            '😠',
    'confused':         '😕',
    'flushed':          '😳',
    'expressionless':   '😑',
    'neutral_face':     '😐',
    'sweat':            '😓',
    'unamused':         '😒',

    // 手・ジェスチャー
    'thumbsup':         '👍',
    'thumbsdown':       '👎',
    'ok_hand':          '👌',
    'raised_hands':     '🙌',
    'clap':             '👏',
    'wave':             '👋',
    'point_right':      '👉',
    'point_left':       '👈',
    'point_up':         '☝️',
    'point_down':       '👇',
    'pray':             '🙏',

    // ステータス・記号
    'warning':          '⚠️',
    'x':                '❌',
    'heavy_check_mark': '✔️',
    'white_check_mark': '✅',
    'question':         '❓',
    'exclamation':      '❗',
    'bangbang':         '‼️',
    'no_entry':         '⛔',
    'stop_sign':        '🛑',
    'information_source': 'ℹ️',
    'new':              '🆕',
    'up':               '🆙',
    'sos':              '🆘',

    // ハート
    'heart':            '❤️',
    'orange_heart':     '🧡',
    'yellow_heart':     '💛',
    'green_heart':      '💚',
    'blue_heart':       '💙',
    'purple_heart':     '💜',
    'broken_heart':     '💔',
    'sparkling_heart':  '💖',

    // オブジェクト・ツール
    'pencil':           '✏️',
    'pen':              '🖊️',
    'memo':             '📝',
    'book':             '📖',
    'books':            '📚',
    'notebook':         '📓',
    'clipboard':        '📋',
    'file_folder':      '📁',
    'open_file_folder': '📂',
    'link':             '🔗',
    'paperclip':        '📎',
    'bulb':             '💡',
    'wrench':           '🔧',
    'hammer':           '🔨',
    'gear':             '⚙️',
    'key':              '🔑',
    'lock':             '🔒',
    'unlock':           '🔓',
    'mag':              '🔍',
    'mag_right':        '🔎',
    'package':          '📦',
    'computer':         '💻',
    'keyboard':         '⌨️',
    'desktop_computer': '🖥️',
    'printer':          '🖨️',
    'battery':          '🔋',
    'electric_plug':    '🔌',
    'telephone':        '📞',
    'email':            '📧',
    'inbox_tray':       '📥',
    'outbox_tray':      '📤',
    'calendar':         '📅',
    'date':             '📅',
    'chart_with_upwards_trend': '📈',
    'chart_with_downwards_trend': '📉',
    'bar_chart':        '📊',

    // 自然・天気
    'sun':              '☀️',
    'cloud':            '☁️',
    'snowflake':        '❄️',
    'zap':              '⚡',
    'fire':             '🔥',
    'droplet':          '💧',
    'earth_asia':       '🌏',
    'earth_americas':   '🌎',
    'earth_africa':     '🌍',

    // アクティビティ・その他
    'star':             '⭐',
    'star2':            '🌟',
    'sparkles':         '✨',
    'tada':             '🎉',
    'confetti_ball':    '🎊',
    'rocket':           '🚀',
    'bug':              '🐛',
    'construction':     '🚧',
    'recycle':          '♻️',
    'zzz':              '💤',
    'shipit':           '🚢',

    // 矢印
    'arrow_right':      '→',
    'arrow_left':       '←',
    'arrow_up':         '↑',
    'arrow_down':       '↓',
    'arrows_clockwise': '🔄',
    'arrow_forward':    '▶️',
    'arrow_backward':   '◀️',
  };

  return {
    hooks: {
      preprocess: function(src) {
        return src.replace(/:([a-z0-9_\+\-]+):/g, function(match, name) {
          return emojiMap[name] !== undefined ? emojiMap[name] : match;
        });
      }
    }
  };
})();
