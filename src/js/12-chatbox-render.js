;(function () {
  'use strict'

  if (!window.marked) return // page has page.attributes.disable-chatbot set

  // Ported from lex-bot-ui's MessageText.vue (markdown chunking) and
  // CodeBlock.vue (highlighting), un-templated into plain functions now that
  // there's no Vue component tree to render into.
  var CODE_BLOCK_RE = /```(?:\s*(\w+))?\s*([\s\S]*?)\s*```/g
  var DEFAULT_LANGUAGE = 'bash'

  var renderer = new window.marked.Renderer()
  // marked@4's Renderer.link takes three positional args (href, title, text)
  // -- newer majors (v9+) switch to a single {href, title, tokens} token
  // object and need this.parser.parseInline(tokens) instead. We're pinned to
  // ~4.3 (see package.json) because later majors' CJS build uses syntax this
  // repo's browserify/browser-pack-flat toolchain can't parse -- if that
  // version ever changes, this signature needs re-checking.
  renderer.link = function (href, title, text) {
    var html = '<a href="' + href + '"'
    if (title) html += ' title="' + title + '"'
    html += ' target="_blank">' + text + '</a>'
    return html
  }
  window.marked.setOptions({ renderer: renderer, breaks: true, gfm: true })

  function highlightCode (code, lang) {
    var hljs = window.hljs
    if (!hljs) return { html: escapeHtml(code), language: lang || DEFAULT_LANGUAGE }
    // NOTE: docs-ui vendors highlight.js v9, whose highlight() takes
    // (languageName, code) -- not (code, {language}) like newer majors.
    var language = (lang && hljs.getLanguage(lang)) ? lang : DEFAULT_LANGUAGE
    return { html: hljs.highlight(language, code).value, language: language }
  }

  function escapeHtml (value) {
    var div = document.createElement('div')
    div.textContent = value
    return div.innerHTML
  }

  function renderMarkdownChunk (text) {
    if (!text || !text.trim()) return ''
    var html = window.marked.parse(text)
    html = window.DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })
    return html.replace(/<a(?![^>]*\btarget=)/gi, '<a target="_blank"')
  }

  function appendMarkdown (container, text) {
    if (!text) return
    var div = document.createElement('div')
    div.className = 'markdown-content'
    div.innerHTML = renderMarkdownChunk(text)
    container.appendChild(div)
  }

  function appendCodeBlock (container, code, lang) {
    var result = highlightCode(code, lang)
    var pre = document.createElement('pre')
    pre.className = 'chatbot-code-block'

    var header = document.createElement('div')
    header.className = 'chatbot-code-block__header'
    var langEl = document.createElement('span')
    langEl.className = 'chatbot-code-block__lang'
    langEl.textContent = result.language
    var copyButton = document.createElement('button')
    copyButton.type = 'button'
    copyButton.className = 'chatbot-code-block__copy'
    copyButton.textContent = 'Copy'
    header.appendChild(langEl)
    header.appendChild(copyButton)

    var codeEl = document.createElement('code')
    codeEl.className = 'hljs'
    codeEl.innerHTML = result.html

    pre.appendChild(header)
    pre.appendChild(codeEl)
    container.appendChild(pre)

    copyButton.addEventListener('click', function () {
      navigator.clipboard.writeText(codeEl.textContent)
    })
  }

  // renderMessage(container, fullText) -- splits the completed message into
  // code/prose chunks (same regex-based approach as MessageText.vue's
  // `messageChunks` computed property) and renders each into `container`,
  // replacing whatever plain-text content was there during streaming.
  function renderMessage (container, fullText) {
    container.innerHTML = ''
    var lastIndex = 0
    var match
    CODE_BLOCK_RE.lastIndex = 0
    while ((match = CODE_BLOCK_RE.exec(fullText))) {
      if (match.index > lastIndex) appendMarkdown(container, fullText.slice(lastIndex, match.index))
      appendCodeBlock(container, match[2], match[1])
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < fullText.length) appendMarkdown(container, fullText.slice(lastIndex))
  }

  window.CouchbaseChatRender = { renderMessage: renderMessage }
})()
