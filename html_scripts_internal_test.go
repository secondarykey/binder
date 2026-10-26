package binder

import "testing"

func TestHasScripts(t *testing.T) {
	for _, c := range []struct {
		html string
		want bool
	}{
		{`<p>text</p>`, false},
		// 本文の文字としての <script> はエスケープされている
		{`<pre><code>&lt;script&gt;alert(1)&lt;/script&gt;</code></pre>`, false},
		{`<p>contact information</p>`, false},
		{`<a href="https://example.com/?on=1">x</a>`, false},
		{`<script>hljs.highlightAll();</script>`, true},
		{`<SCRIPT src="x.js"></SCRIPT>`, true},
		{`<script src="x.js"/>`, true},
		{`<img src="x.png" onerror="alert(1)">`, true},
		{`<button type="button" onClick = "go()">go</button>`, true},
	} {
		if got := hasScripts(c.html); got != c.want {
			t.Errorf("hasScripts(%q) = %v, want %v", c.html, got, c.want)
		}
	}
}
