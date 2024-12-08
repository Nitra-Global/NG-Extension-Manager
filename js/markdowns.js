function markdownToHTML(markdown) {
    return markdown
        // Escape HTML entities
        .replace(/&(?!#?\w+;)/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

        // Custom Placeholder: > _ ._
        .replace(/^\>\s*_\s*\._$/gm, '<div class="placeholder">...</div>')

        // Headings with IDs for TOC
        .replace(/^###### (.+)$/gm, '<h6 id="$1">$1</h6>')
        .replace(/^##### (.+)$/gm, '<h5 id="$1">$1</h5>')
        .replace(/^#### (.+)$/gm, '<h4 id="$1">$1</h4>')
        .replace(/^### (.+)$/gm, '<h3 id="$1">$1</h3>')
        .replace(/^## (.+)$/gm, '<h2 id="$1">$1</h2>')
        .replace(/^# (.+)$/gm, '<h1 id="$1">$1</h1>')

        // Blockquotes (multi-line)
        .replace(/^\>[\s\S]+?(?=\n\n|$)/gm, match =>
            `<blockquote>${match.replace(/^\> ?/gm, '').replace(/\n/g, '<br>')}</blockquote>`)

        // Bold, Italic, and Combined (Bold+Italic)
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')

        // Underline
        .replace(/__(.+?)__/g, '<u>$1</u>')

        // Inline Code
        .replace(/`(.+?)`/g, '<code>$1</code>')

        // Strikethrough
        .replace(/~~(.+?)~~/g, '<del>$1</del>')

        // Highlighted Text
        .replace(/==(.+?)==/g, '<mark>$1</mark>')

        // Superscript and Subscript
        .replace(/\^(.+?)\^/g, '<sup>$1</sup>')
        .replace(/~(.+?)~/g, '<sub>$1</sub>')

        // Links and Images
        .replace(/!\[(.*?)\]\((.+?)\)/g, '<img src="$2" alt="$1" />')
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')

        // Mentions
        .replace(/@(\w+)/g, '<span class="mention">@$1</span>')

        // Emojis
        .replace(/:([a-z_]+):/g, (match, emoji) => {
            const emojiMap = {
                smile: '😊',
                wink: '😉',
                heart: '❤️',
                star: '⭐',
                thumbsup: '👍'
            };
            return emojiMap[emoji] || match; // Default to text if not in map
        })

        // Keyboard Keys
        .replace(/⌨\s*\[(.+?)\]/g, '<kbd>$1</kbd>')

        // Task Lists
        .replace(/^\s*-\s+\[ \]\s+(.+)$/gm, '<ul class="task-list"><li class="task-item"><input type="checkbox" disabled> $1</li></ul>')
        .replace(/^\s*-\s+\[x\]\s+(.+)$/gm, '<ul class="task-list"><li class="task-item"><input type="checkbox" disabled checked> $1</li></ul>')
        .replace(/<\/ul>\s*<ul>/g, '')

        // Unordered and Nested Lists
        .replace(/^(\s*)-\s+(.+)$/gm, (_, spaces, content) => {
            const depth = spaces.length / 2;
            return `${'  '.repeat(depth)}<ul><li>${content}</li></ul>`;
        })
        .replace(/<\/ul>\s*<ul>/g, '')

        // Ordered Lists
        .replace(/^(\s*)\d+\.\s+(.+)$/gm, (_, spaces, content) => {
            const depth = spaces.length / 2;
            return `${'  '.repeat(depth)}<ol><li>${content}</li></ol>`;
        })
        .replace(/<\/ol>\s*<ol>/g, '')

        // Horizontal Rules
        .replace(/^(?:---|___|\*\*\*)$/gm, '<hr />')

        // Definition Lists
        .replace(/^(.+):\s+(.+)$/gm, '<dl><dt>$1</dt><dd>$2</dd></dl>')

        // Abbreviations
        .replace(/\*\[(.+?)\]:\s+(.+)$/gm, '<abbr title="$2">$1</abbr>')

        // Multi-line Code Blocks
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')

        // Collapsed Details
        .replace(/^\?\?\? (.+?)\n([\s\S]*?)\n(?=\n|$)/gm, (match, summary, details) => 
            `<details><summary>${summary}</summary><p>${details.replace(/\n/g, '<br>')}</p></details>`)

        // Tables
        .replace(/^\|(.+)\|\n\|(:?-+:?)+\|\n((?:\|.*\|\n)+)/gm, (match, header, align, rows) => {
            const headers = header.split('|').map(h => `<th>${h.trim()}</th>`).join('');
            const bodyRows = rows.trim().split('\n').map(row => {
                const cols = row.split('|').map(col => `<td>${col.trim()}</td>`).join('');
                return `<tr>${cols}</tr>`;
            }).join('');
            return `<table><thead><tr>${headers}</tr></thead><tbody>${bodyRows}</tbody></table>`;
        })

        // ISO Date/Time
        .replace(/\b(\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}:\d{2}Z?)?)\b/g, '<time datetime="$1">$1</time>')

        // Footnotes
        .replace(/\[\^(\d+)\]:\s+(.+)$/gm, '<aside class="footnote" id="fn$1">$1: $2</aside>')

        // HTML Comments
        .replace(/<!--[\s\S]*?-->/g, '')

        // Line Breaks
        .replace(/ {2}\n/g, '<br>')
        .replace(/\n/g, '<br>');
}






function setReleaseDetails(release) {
    const releaseDetails = document.getElementById("release-details");
    releaseDetails.innerHTML = `
        <h3>${release.name}</h3>
        <p><strong>Published:</strong> ${new Date(release.published_at).toLocaleDateString()}</p>
        <div>${markdownToHTML(release.body)}</div>
    `;
}