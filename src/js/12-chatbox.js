;(function () {
  'use strict'
  /* eslint-env browser */

  // The chat widget used to be a separate Vue app (lex-bot-ui) loaded
  // cross-origin in an iframe, talked to over postMessage. Both the UI and
  // its backend are Couchbase's now, so it's a plain part of this page:
  // no iframe, no message-passing protocol, just DOM + fetch.
  var panel = document.getElementById('chatbot-panel')
  if (!panel) return // page has page.attributes.disable-chatbot set

  var qs = (q) => document.head.querySelector(q)?.content

  // Every page load on this static site is a real navigation, not an SPA
  // route change, so open/closed state, the conversation transcript, and the
  // backend session id are all carried across page loads via sessionStorage
  // (cleared when the tab/browser closes -- deliberately not localStorage,
  // so a conversation can't silently reappear days later on an unrelated
  // visit). Reusing the same session id across navigations matters here:
  // the backend (unlike the old direct-to-Capella sketch) keeps session
  // state server-side, keyed by session id, rather than the client resending
  // the full transcript on every turn.
  var STORAGE_KEY = 'couchbase-chatbot-session'

  function loadSession () {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {}
    } catch (e) {
      return {}
    }
  }

  var session = loadSession()

  var configEl = document.getElementById('chatbot-config')
  var client = window.CouchbaseChatClient.create({
    apiUri: configEl.dataset.apiUri,
    streamingWebSocketEndpoint: configEl.dataset.streamingWsEndpoint,
    sessionId: session.sessionId,
  })

  // Re-built fresh on every page load (every navigation on this site is a
  // real page load, not an SPA route change), so it's always accurate for
  // whatever page a message is actually sent from -- unlike the old iframe
  // setup, where this was sent once via postMessage and silently dropped.
  function currentClientContext () {
    return {
      product: {
        value: qs('meta[name="docsearch:component_title"]'),
        description: 'The specific product the user is reading about',
      },
      surface: {
        value: 'docs',
        description: 'The user is reading the Couchbase Docs',
      },
      service: {
        value: qs('meta[name="docsearch:component_title"]'),
        description: 'The specific product the user is reading about.',
      },
      page: {
        route: {
          value: qs('meta[name="page-url"]'),
          description: 'The URL of the current page the user is reading',
        },
        breadcrumbs: {
          value: qs('meta[name="docsearch:breadcrumbs"]'),
          description: 'The navigation path to the current page',
        },
        title: {
          value: document.head.querySelector('title')?.innerHTML,
          description: 'The title of the current page the user is reading',
        },
        description: 'The specific page the user is on, which can give context for their query',
      },
      component: {
        id: {
          value: qs('meta[name="docsearch:component_title"]'),
          description: 'The component that the user is reading about',
        },
        edition: {
          value: qs('meta[name="docsearch:edition"]'),
          description: 'The edition (e.g. Enterprise or Community) of the product the user is reading about',
        },
        version: {
          value: qs('meta[name="docsearch:cversion"]'),
          description: 'The version of the product the user is reading about',
        },
        description: 'The component that the user is reading about',
      },
    }
  }

  var messagesEl = document.getElementById('chatbot-messages')
  var inputForm = document.getElementById('chatbot-input-form')
  var inputEl = document.getElementById('chatbot-input')
  var askAiButton = document.getElementById('ask-ai-button')
  var closeButton = document.getElementById('chatbot-close-button')

  function saveSession () {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        isOpen: isOpen(),
        sessionId: client.getSessionId(),
        history: client.getHistory(),
      }))
    } catch (e) {
      // storage full/unavailable (private browsing etc.) -- persistence is a
      // nice-to-have, not required for the widget to function
    }
  }

  function isOpen () {
    return !panel.hidden
  }

  function openPanel () {
    panel.hidden = false
  }

  function closePanel () {
    panel.hidden = true
  }

  function appendMessage (role, text, renderImmediately) {
    var messageEl = document.createElement('div')
    messageEl.className = 'chatbot-message chatbot-message--' + role
    if (renderImmediately && window.CouchbaseChatRender) {
      window.CouchbaseChatRender.renderMessage(messageEl, text)
    } else {
      messageEl.textContent = text
    }
    messagesEl.appendChild(messageEl)
    messageEl.scrollIntoView({ block: 'end' })
    return messageEl
  }

  // Attached only to a finished bot answer (never mid-stream, since
  // CouchbaseChatRender.renderMessage clears botMessageEl's children on
  // every call -- these buttons would just get wiped out if added sooner).
  function feedbackIconHtml (iconName, glyph) {
    // window.CouchbaseFontAwesome (see src/js/vendor/fontawesome.bundle.js)
    // renders straight from the icon library rather than needing the <i> in
    // the DOM before page load, so it works for buttons added long after a
    // chat response streams in -- unlike a plain <i class="fas ...">, which
    // this site only ever converts to a real icon once, at page load.
    if (window.CouchbaseFontAwesome) {
      var html = window.CouchbaseFontAwesome.iconHtml('fas', iconName)
      if (html) return html
    }
    return glyph
  }

  function addFeedbackControls (botMessageEl, prompt, response) {
    var feedbackEl = document.createElement('div')
    feedbackEl.className = 'chatbot-message__feedback'
    var buttons = []

    function makeButton (modifier, iconName, glyph, feedbackText) {
      var button = document.createElement('button')
      button.type = 'button'
      button.className = 'chatbot-feedback-button chatbot-feedback-button--' + modifier
      button.setAttribute('aria-label', feedbackText)
      button.innerHTML = feedbackIconHtml(iconName, glyph)
      button.addEventListener('click', function () {
        // re-clicking the already-selected choice is a no-op; switching
        // choice, or fixing a fat-fingered click, just re-POSTs -- the
        // backend overwrites any earlier feedback for this sessionId/
        // prompt/response rather than piling up duplicates, so there's no
        // need to disable these buttons once a choice is made
        if (button.classList.contains('chatbot-feedback-button--selected')) return
        buttons.forEach(function (b) { b.classList.toggle('chatbot-feedback-button--selected', b === button) })
        client.postFeedback(prompt, response, feedbackText)
      })
      buttons.push(button)
      return button
    }

    feedbackEl.appendChild(makeButton('up', 'thumbs-up', '\u{1F44D}', 'Thumbs up'))
    feedbackEl.appendChild(makeButton('down', 'thumbs-down', '\u{1F44E}', 'Thumbs down'))
    botMessageEl.appendChild(feedbackEl)
  }

  function sendMessage (text) {
    appendMessage('user', text)
    var botMessageEl = appendMessage('bot', '')
    var fullText = ''
    var renderScheduled = false
    var finished = false

    function renderNow (finalText) {
      if (window.CouchbaseChatRender) {
        window.CouchbaseChatRender.renderMessage(botMessageEl, finalText)
      } else {
        botMessageEl.textContent = finalText
      }
      botMessageEl.scrollIntoView({ block: 'end' })
    }

    // Re-parsing markdown + re-highlighting on every single WebSocket chunk
    // is wasteful, so coalesce a burst of chunks into one re-render per
    // animation frame. An in-progress (unclosed) code fence just renders
    // as a plain, unhighlighted block until its closing fence streams in --
    // self-correcting, not broken, same as ChatGPT/Claude's own streaming UIs.
    function scheduleRender () {
      if (renderScheduled || finished) return
      renderScheduled = true
      requestAnimationFrame(function () {
        renderScheduled = false
        if (!finished) renderNow(fullText)
      })
    }

    client.postText(text, currentClientContext(), function (chunk) {
      fullText += chunk
      scheduleRender()
    }).then(function (result) {
      // result.message is the authoritative final text -- some turns arrive
      // as a single fast REST response with no streamed chunks at all, so
      // this can't just be whatever the onChunk callback accumulated above
      finished = true
      renderNow(result.message)
      saveSession()
      // don't offer feedback on our own error text (status 500) -- there's
      // nothing useful to rate
      if (result.status === 200) addFeedbackControls(botMessageEl, text, result.message)
    })
  }

  if (askAiButton) {
    askAiButton.addEventListener('click', function () {
      if (isOpen()) {
        closePanel()
      } else {
        openPanel()
        inputEl.focus()
      }
      saveSession()
    })
  }

  closeButton.addEventListener('click', function () {
    closePanel()
    saveSession()
  })

  inputForm.addEventListener('submit', function (event) {
    event.preventDefault()
    var text = inputEl.value.trim()
    if (!text) return
    inputEl.value = ''
    sendMessage(text)
  })

  inputEl.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      inputForm.requestSubmit()
    }
  })

  // restore whatever was left from the previous page, if anything
  client.restoreHistory(session.history)
  ;(session.history || []).forEach(function (message, index) {
    var role = message.role === 'user' ? 'user' : 'bot'
    var messageEl = appendMessage(role, message.content, true)
    var previousMessage = (session.history || [])[index - 1]
    if (role === 'bot' && previousMessage && previousMessage.role === 'user') {
      addFeedbackControls(messageEl, previousMessage.content, message.content)
    }
  })
  if (session.isOpen) openPanel()
})()
