/**
 * markdown.js - Secure Markdown to HTML Converter v2.1
 *
 * Converts a common subset of Markdown syntax to HTML with enhanced security and features.
 * Uses a simple lexer/parser approach for block-level elements.
 * Does NOT rely on external libraries. Optimized for use in browser extensions.
 *
 * Supported syntax:
 * - Headings: # H1, ## H2, ### H3, #### H4, ##### H5, ###### H6
 * - Paragraphs: Standard text blocks separated by blank lines.
 * - Bold: **bold text** or __bold text__
 * - Italic: *italic text* or _italic text_
 * - Bold+Italic: ***bold italic*** or ___bold italic___
 * - Strikethrough: ~~strikethrough~~
 * - Inline Code: `code`
 * - Code Blocks: ```language\ncode\n``` (language is optional, content is escaped, includes basic lang class)
 * - Unordered Lists: *, -, + (supports nesting)
 * - Ordered Lists: 1., 2. (supports nesting, respects start number)
 * - Task Lists: - [ ] Item, - [x] Checked Item (within UL/OL)
 * - Links: [link text](url "title") (title is optional, URL is sanitized)
 * - Images: ![alt text](url "title") (title is optional, URL sanitized, alt text escaped)
 * - Blockquotes: > quote text (supports nesting, multi-line)
 * - Horizontal Rules: ---, ***, ___ (on their own line)
 * - Tables: Basic pipe tables (| Header | ... |), including alignment (:---:, :---, ---:)
 *
 * Security Considerations:
 * - All HTML output is generated programmatically, avoiding innerHTML where possible for security-sensitive parts.
 * - Content within code blocks and inline code is HTML-escaped.
 * - Link and Image URLs are sanitized to allow only http, https, or mailto protocols.
 * - Table cell content is processed for inline markdown.
 * - Inline HTML is NOT supported and will be escaped or ignored.
 * - Uses Text nodes where possible to prevent DOM injection.
 *
 * Potential Future Enhancements:
 * - Configuration object for enabling/disabling features (e.g., tables, task lists).
 * - Support for Definition Lists (<dl>, <dt>, <dd>).
 * - Support for Footnotes.
 * - Optional basic syntax highlighting for code blocks via class names.
 * - Allowlist for specific "safe" HTML tags if needed (use with extreme caution).
 * - Callbacks/hooks for custom element processing.
 */

(function(global) {
  'use strict';

  /**
   * Escapes essential HTML characters to prevent XSS.
   * Handles null/undefined input.
   * @param {string|null|undefined} str The string to escape.
   * @returns {string} The escaped string, or an empty string if input is null/undefined.
   */
  function escapeHTML(str) {
      if (str == null) return ''; // Check for null or undefined
      // Basic check for already escaped sequences to prevent double escaping common entities
      // This is a simple check and might not cover all edge cases.
      if (/&(#\d+|[a-z]+);/.test(str)) {
         // It seems like it might already contain HTML entities.
         // A more robust check might involve decoding known entities first,
         // but for simplicity, we'll assume it's partially escaped and proceed carefully.
         // Let's only escape the core characters that weren't already entities.
         return String(str)
             .replace(/&(?!(#\d+|[a-z]+);)/g, '&amp;') // Escape '&' only if not part of an entity
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;')
             .replace(/'/g, '&#39;');
       } else {
           // Standard escape for strings presumed not to contain entities
           return String(str).replace(/[&<>"']/g, match => ({
               '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
           }[match]));
       }
  }

  /**
   * Sanitizes a URL, allowing only specific protocols (http, https, mailto).
   * Returns an empty string for invalid or disallowed URLs.
   * Uses a robust try-catch block for URL parsing.
   * @param {string} url The URL string to sanitize.
   * @param {boolean} [allowRelative=false] If true, allows relative URLs (use with caution).
   * @returns {string} The sanitized and escaped URL, or an empty string if invalid/unsafe.
   */
  function sanitizeUrl(url, allowRelative = false) {
      if (typeof url !== 'string' || url.trim() === '') return '';

      // Trim whitespace, especially leading/trailing spaces or control characters
      url = url.trim();

      // Simple check for potential javascript pseudo-protocol (case-insensitive)
      if (/^javascript:/i.test(url)) {
          console.warn("Markdown Sanitizer: Disallowed 'javascript:' URL detected.");
          return '';
      }
       // Check for other potentially harmful protocols like 'data:'
       if (/^data:/i.test(url)) {
          console.warn("Markdown Sanitizer: Disallowed 'data:' URL detected.");
          return '';
       }

      try {
          // Check if it looks like a protocol-relative URL (e.g., //example.com)
          if (url.startsWith('//')) {
              // Prepend https: for validation. Return it as https.
              url = 'https:' + url;
          }

          const parsed = new URL(url, 'about:blank'); // Use 'about:blank' as base for robustness

          if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
              // Protocol is allowed. Return the validated and escaped URL.
              // We escape here to prevent attribute injection if the URL somehow contained quotes.
              return escapeHTML(parsed.toString());
          } else if (allowRelative && !parsed.protocol && url.startsWith('/')) {
               // Allow root-relative URLs if requested and it doesn't contain ':' (avoiding protocol confusion)
               if (!url.includes(':')) return escapeHTML(url);
          } else if (allowRelative && !parsed.protocol && !url.includes(':') && !url.startsWith('/')) {
               // Allow simple relative URLs (e.g., "image.png", "page.html") if requested
               return escapeHTML(url);
           }

      } catch (e) {
          // Invalid URL format caught by URL constructor
          // Try a simpler check for relative URLs that might fail the constructor (e.g. "image.jpg")
           if (allowRelative && !url.includes(':') && !url.startsWith('/') && !url.startsWith('#')) {
               // Looks like a simple relative path, escape and allow
               return escapeHTML(url);
           }
          console.warn("Markdown Sanitizer: Invalid URL format - ", url, e);
      }

      // If protocol not allowed or URL is invalid
      console.warn("Markdown Sanitizer: Disallowed protocol or invalid format for URL - ", url);
      return '';
  }

  /**
   * Processes inline Markdown elements within a line of text.
   * Applied *after* the line has been generally escaped.
   * Uses more refined regexes to avoid issues with spaces around markers.
   * @param {string} escapedText The already HTML-escaped line of text.
   * @returns {string} HTML string with inline elements converted to tags.
   */
  function processInlineMarkdown(escapedText) {
      let inlineHtml = escapedText;

      // --- Inline Transformations (Order is important!) ---

      // 1. Images: ![alt](url "title") or ![alt](url)
      // Regex tries to capture alt text reliably, handles optional title.
      inlineHtml = inlineHtml.replace(/!\[(.*?)]\(\s*(<?)([^ >)]+)(?: +&quot;(.*?)&quot;)?\s*(>?)\)/g, (match, alt, openAngle, url, title, closeAngle) => {
          // URL needs to be *un*-escaped slightly for sanitizeUrl, then re-escaped by the function.
          const rawUrl = url.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
          const sanitizedUrl = sanitizeUrl(rawUrl);
          if (!sanitizedUrl) {
              return match; // Return original escaped text if URL is invalid
          }
          // Alt text is already escaped. Title needs unescaping then re-escaping if present.
           const cleanTitle = title ? escapeHTML(title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")) : '';
          const titleAttr = cleanTitle ? ` title="${cleanTitle}"` : '';
          return `<img src="${sanitizedUrl}" alt="${alt}"${titleAttr}>`;
      });

      // 2. Links: [text](url "title") or [text](url)
      // Similar regex refinement as images.
      inlineHtml = inlineHtml.replace(/\[(.*?)\]\(\s*(<?)([^ >)]+)(?: +&quot;(.*?)&quot;)?\s*(>?)\)/g, (match, linkText, openAngle, url, title, closeAngle) => {
           const rawUrl = url.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
           const sanitizedUrl = sanitizeUrl(rawUrl);
           if (!sanitizedUrl) {
               return match; // Return original escaped text if URL is invalid
           }
           // Link text is already escaped. Title needs unescaping then re-escaping if present.
           const cleanTitle = title ? escapeHTML(title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")) : '';
           const titleAttr = cleanTitle ? ` title="${cleanTitle}"` : '';
           // If linkText itself contains inline markdown (e.g., bold), process it recursively.
           // Simple recursion, limit potential depth issues by design (not implemented here).
           const processedLinkText = processInlineMarkdown(linkText); // Process inner content
           return `<a href="${sanitizedUrl}"${titleAttr} target="_blank" rel="noopener noreferrer">${processedLinkText}</a>`; // Add safety attributes
      });

      // 3. Inline Code: `code` (handles escaped backticks inside)
      // Match content lazily and ensure surrounding backticks are not escaped.
      inlineHtml = inlineHtml.replace(/`((?:\\`|[^`])+?)`/g, (match, codeContent) => {
         // The content is already escaped from the initial pass.
         // We just need to wrap it. Unescape escaped backticks `\` inside.
         const finalCode = codeContent.replace(/\\`/g, '`');
         return `<code>${finalCode}</code>`;
      });


      // 4. Bold + Italic (*** or ___) - Improved regex
      // Avoids matching across paragraphs or unintended sequences.
      // Requires non-whitespace character immediately inside markers.
      inlineHtml = inlineHtml.replace(/(\*\*\*|___)(?=\S)(.*?\S)\1/g, '<strong><em>$2</em></strong>');

      // 5. Bold (** or __) - Improved regex
      inlineHtml = inlineHtml.replace(/(\*\*|__)(?=\S)(.*?\S)\1/g, '<strong>$2</strong>');

      // 6. Italic (* or _) - Improved regex
      // More careful with word boundaries, avoids accidental matches mid-word if underscores are used.
      // Example: `a_b_c` should not become `a<em>b</em>c`
      // This regex is still simplified; true GFM handling is complex.
      inlineHtml = inlineHtml.replace(/(?<!\w)(\*|_)(?=\S)(.*?\S)\1(?!\w)/g, '<em>$2</em>');


      // 7. Strikethrough (~~text~~) - Improved regex
      inlineHtml = inlineHtml.replace(/~~(?=\S)(.*?)\S~~/g, '<del>$1</del>');


      return inlineHtml;
  }


  /**
   * Converts a Markdown string into HTML.
   * @param {string} markdownText The Markdown text to convert.
   * @param {object} [options={}] Optional configuration object.
   * @returns {string} The generated HTML string.
   */
  function markdownToHTML(markdownText, options = {}) {
      if (typeof markdownText !== 'string') {
          return '';
      }

      // --- Configuration (Example for future expansion) ---
      const config = {
         allowRelativeLinks: options.allowRelativeLinks ?? true, // Default allow relative
         gfmTables: options.gfmTables ?? true,
         taskLists: options.taskLists ?? true,
         // ... other options
      };


      // --- Pre-processing: Normalize line endings and extract code blocks ---
      const normalizedText = markdownText.replace(/\r\n/g, '\n');
      const codeBlocks = [];
      const codeBlockPlaceholder = '___CODE_BLOCK_PLACEHOLDER___';

      // Extract fenced code blocks first to prevent their contents from being parsed.
      // Allows optional indentation for the fences.
      const textWithoutCodeBlocks = normalizedText.replace(/^ {0,3}``` *([\w+#-]+)? *\n([\s\S]*?)\n^ {0,3}``` *$/gm, (match, lang, code) => {
          const escapedCode = escapeHTML(code); // Escape the raw code content
          const langClass = lang ? ` class="language-${escapeHTML(lang.trim().toLowerCase())}"` : '';
          // Consider adding a copy button here later if desired via CSS/JS post-processing
          codeBlocks.push(`<pre><code${langClass}>${escapedCode}</code></pre>`);
          return codeBlockPlaceholder;
      });

      const lines = textWithoutCodeBlocks.split('\n');
      let html = '';
      let currentBlock = null; // Tracks current block type: null, 'p', 'ul', 'ol', 'blockquote', 'table_header', 'table_body'
      let listStack = []; // Tracks nesting: { type: 'ul'/'ol', level: indentLevel, start: number (for ol) }
      let tableHeader = null; // Stores array of header cell content
      let tableAlign = []; // Stores array of 'left', 'right', 'center', or ''


      // --- Helper: Close Current Block ---
      const closeCurrentBlock = () => {
          if (currentBlock === 'p') {
              html += '</p>\n';
          } else if (currentBlock === 'blockquote') {
              html += '</blockquote>\n';
          } else if (currentBlock === 'ul' || currentBlock === 'ol') {
              while (listStack.length > 0) {
                  const closingList = listStack.pop();
                  html += `${'  '.repeat(listStack.length)}</${closingList.type}>\n`;
              }
          } else if (currentBlock === 'table_body') {
              html += '  </tbody>\n</table>\n';
              tableHeader = null;
              tableAlign = [];
          } else if (currentBlock === 'table_header') {
              // Table header without body? Close table.
               html += '</table>\n';
               tableHeader = null;
               tableAlign = [];
          }
          currentBlock = null;
      };

      // --- Line-by-Line Processing ---
      for (let i = 0; i < lines.length; i++) {
          let line = lines[i];

          // 1. Code Block Placeholder
          if (line.trim() === codeBlockPlaceholder) {
              closeCurrentBlock();
              html += codeBlocks.shift() + '\n';
              continue;
          }

          // 2. Blank Line: Ends most blocks
          if (line.trim() === '') {
              closeCurrentBlock();
              continue;
          }

          // --- Check for Block Starts ---

          // 3. Headings (# H1, ## H2, ...)
          // Allows optional closing hashes
          const headingMatch = line.match(/^(#{1,6}) +(.+?) *#* *$/);
          if (headingMatch) {
              closeCurrentBlock();
              const level = headingMatch[1].length;
              // Escape first, then process inline
              const content = processInlineMarkdown(escapeHTML(headingMatch[2].trim()));
              html += `<h${level}>${content}</h${level}>\n`;
              continue;
          }

          // 4. Horizontal Rules (---, ***, ___)
          // Must be 3+ markers, optionally separated by spaces, on their own line.
          if (line.match(/^ {0,3}([-*_])( *?\1){2,} *$/)) {
              closeCurrentBlock();
              html += '<hr>\n';
              continue;
          }

          // 5. Blockquotes (> quote)
          // Handle multi-line blockquotes more cohesively.
          if (line.match(/^ {0,3}>/)) {
              if (currentBlock !== 'blockquote') {
                  closeCurrentBlock();
                  html += '<blockquote>\n';
                  currentBlock = 'blockquote';
              }
              // Remove the leading '>' and optional space, then process the rest.
              const content = line.replace(/^ {0,3}> ?/, '');
              // Recursively process nested blockquotes? (For simplicity, treat nested as part of the same block)
              // Process content as paragraph-like within the quote
              html += processInlineMarkdown(escapeHTML(content)) + '\n'; // Add newline, maybe wrap in <p> later if needed
              continue;
          }
           // If we were in a blockquote and this line isn't one, close it.
           if (currentBlock === 'blockquote' && !line.match(/^ {0,3}>/)) {
              // Before closing, trim trailing newline from the content
              html = html.trimEnd() + '\n';
              closeCurrentBlock();
           }


          // 6. List Items (*, -, +, 1.) - including Task Lists if enabled
          const listMatch = config.taskLists
                ? line.match(/^(\s*)([-*+]|\d+\.) +(\[([ xX])\] +)?(.*)$/) // With task list check
                : line.match(/^(\s*)([-*+]|\d+\.) +(.*)$/); // Without task list check

          if (listMatch) {
              const indent = listMatch[1].length;
              const marker = listMatch[2];
              let content = '';
              let isTask = false;
              let isChecked = false;

              if (config.taskLists && listMatch[3] !== undefined) {
                 isTask = true;
                 isChecked = listMatch[4]?.toLowerCase() === 'x';
                 content = listMatch[5];
              } else {
                 // Index depends on whether task list regex was used
                 content = config.taskLists ? listMatch[5] : listMatch[3];
              }

              const itemType = (marker === '*' || marker === '-' || marker === '+') ? 'ul' : 'ol';
              const startNumber = itemType === 'ol' ? parseInt(marker, 10) : null;

               // Calculate nesting level based on indentation (simple 2-space indent assumed)
               const level = Math.floor(indent / 2);

               // --- List Nesting Logic ---
               // Close nested lists if indent decreases
               while (listStack.length > 0 && level < listStack[listStack.length - 1].level) {
                   const closingList = listStack.pop();
                   html += `${'  '.repeat(listStack.length)}</${closingList.type}>\n`;
               }

               // Start new list or change type if needed
               if (listStack.length === 0 || level > listStack[listStack.length - 1].level) {
                    // Starting a new list or deeper level
                    closeCurrentBlock(); // Close paragraph if needed
                    const listAttrs = (itemType === 'ol' && startNumber > 1) ? ` start="${startNumber}"` : '';
                    html += `${'  '.repeat(listStack.length)}<${itemType}${listAttrs}>\n`;
                    listStack.push({ type: itemType, level: level });
                    currentBlock = itemType;
               } else if (level === listStack[listStack.length - 1].level && itemType !== listStack[listStack.length - 1].type) {
                   // Same level, but type changed (e.g., ul to ol) - Close old, open new
                   const closingList = listStack.pop();
                   html += `${'  '.repeat(listStack.length)}</${closingList.type}>\n`;
                    const listAttrs = (itemType === 'ol' && startNumber > 1) ? ` start="${startNumber}"` : '';
                   html += `${'  '.repeat(listStack.length)}<${itemType}${listAttrs}>\n`;
                   listStack.push({ type: itemType, level: level });
                   currentBlock = itemType;
               }
               // --- End List Nesting ---

              // Add the list item content
              const inlineContent = processInlineMarkdown(escapeHTML(content.trim())); // Trim content before processing
              let liContent = inlineContent;
              let liClass = '';
              if (isTask && config.taskLists) {
                  liClass = ' class="task-list-item"';
                  // Ensure checkbox is not focusable/interactive if rendered directly
                  const checkbox = `<input type="checkbox" disabled${isChecked ? ' checked' : ''} aria-hidden="true"> `;
                  liContent = checkbox + inlineContent;
              }
              html += `${'  '.repeat(listStack.length)}<li${liClass}>${liContent}</li>\n`;
              currentBlock = listStack[listStack.length - 1].type; // Ensure block type reflects current list
              continue;
          }
          // If not a list item, ensure any open lists are closed
          if ((currentBlock === 'ul' || currentBlock === 'ol') && !listMatch) {
              closeCurrentBlock();
          }


          // 7. Tables (GFM Pipe Tables) - if enabled
          if (config.gfmTables) {
              const isTableLine = line.includes('|');
              // More strict separator check: requires at least one pipe, hyphens, optional colons
              const isTableSeparator = line.match(/^ *\|? *([-: ]+\|)+[-: ]+ *\|? *$/) && line.includes('-');

              if (isTableSeparator && currentBlock === 'table_header') {
                  // Process alignment from separator line
                  // Remove leading/trailing pipes if they exist, then split
                  const separatorParts = line.trim().replace(/^\||\|$/g, '').split('|');
                  tableAlign = separatorParts.map(part => {
                      const trimmed = part.trim();
                      const alignLeft = trimmed.startsWith(':');
                      const alignRight = trimmed.endsWith(':');
                      if (alignLeft && alignRight) return 'center';
                      if (alignRight) return 'right';
                      if (alignLeft) return 'left';
                      return ''; // Default align (usually left)
                  });

                  // Ensure alignment array matches header count
                  if (tableHeader) {
                     tableAlign = tableAlign.slice(0, tableHeader.length);
                     while (tableAlign.length < tableHeader.length) tableAlign.push('');
                  } else {
                     tableAlign = []; // Reset if header was somehow lost
                  }

                  html += '  <tbody>\n';
                  currentBlock = 'table_body';
                  continue;
              }

              if (isTableLine && !isTableSeparator) {
                  // Split cells by pipe, trim whitespace
                  const cells = line.split('|').map(cell => cell.trim());
                  // Handle leading/trailing pipes: if they exist, the first/last split parts will be empty.
                  if (cells.length > 0 && cells[0] === '') cells.shift();
                  if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();

                  // Ignore lines with no actual cells between pipes
                  if (cells.length === 0) continue;

                  if (currentBlock !== 'table_header' && currentBlock !== 'table_body') {
                      // Potential start of a table - check next line for separator
                      if (i + 1 < lines.length && lines[i + 1].match(/^ *\|? *([-: ]+\|)+[-: ]+ *\|? *$/) && lines[i+1].includes('-')) {
                          closeCurrentBlock(); // Close previous block
                          tableHeader = cells; // Store header cells
                          html += '<table>\n';
                          html += '  <thead>\n';
                          html += '    <tr>\n';
                          tableHeader.forEach(cell => {
                              // Process inline markdown within header cells
                              html += `      <th>${processInlineMarkdown(escapeHTML(cell))}</th>\n`;
                          });
                          html += '    </tr>\n';
                          html += '  </thead>\n';
                          currentBlock = 'table_header'; // Expecting separator next
                          continue;
                      }
                      // If next line isn't separator, fall through to paragraph
                  } else if (currentBlock === 'table_body') {
                      // Add a row to the table body
                      html += '    <tr>\n';
                      cells.forEach((cell, index) => {
                          // Apply alignment if available for this column index
                          const align = tableAlign[index] ? ` style="text-align: ${tableAlign[index]}"` : '';
                          // Process inline markdown within body cells
                          html += `      <td${align}>${processInlineMarkdown(escapeHTML(cell))}</td>\n`;
                      });
                      // Handle rows with fewer cells than header? Pad with empty cells?
                      // For simplicity, just add the cells found.
                      html += '    </tr>\n';
                      currentBlock = 'table_body'; // Stay in table body
                      continue;
                  }
              }
              // Close table if we were in one and this line doesn't fit
              if ((currentBlock === 'table_header' || currentBlock === 'table_body') && (!isTableLine || isTableSeparator)) {
                   closeCurrentBlock();
              }
          } // End if(config.gfmTables)


          // 8. Paragraph (Default fallback)
          // Only start a paragraph if we are not in another block type
          if (!currentBlock) {
              closeCurrentBlock(); // Ensure everything else is closed
              html += '<p>';
              currentBlock = 'p';
              // Escape the line, *then* process inline markdown
              html += processInlineMarkdown(escapeHTML(line.trim())); // Trim line before processing
          } else if (currentBlock === 'p') {
              // Continue paragraph: add space and content. Browsers usually handle reflow.
              // Using '\n' can sometimes be interpreted as <br> depending on CSS `white-space`.
              // A space is generally safer for standard paragraph continuation.
              html += ' ' + processInlineMarkdown(escapeHTML(line.trim()));
          } else {
               // We're inside a block (like list, quote was handled) that wasn't handled above
               // and this line isn't blank or starting a new known block.
               // This usually indicates multi-line content within a list item or similar.
               // The current implementation mostly handles this by processing line-by-line within lists/quotes.
               // If it falls through here, treat as a new paragraph (safest default).
               closeCurrentBlock();
               html += '<p>' + processInlineMarkdown(escapeHTML(line.trim()));
               currentBlock = 'p';
          }
      }

      // --- Post-processing ---
      closeCurrentBlock(); // Close any remaining open block

      return html.trim();
  }

  // --- Export functions ---
  // Expose functions to the global scope (window or module exports)
  global.escapeHTML = escapeHTML;
  global.sanitizeUrl = sanitizeUrl;
  global.markdownToHTML = markdownToHTML;

})(typeof window !== 'undefined' ? window : (typeof exports !== 'undefined' ? exports : this)); // Handle browser, Node.js, and other environments
