;(function () {
  'use strict'
  /* eslint-env browser */

  // Ported from lex-bot-ui's main/production branch (src/lib/lex/client.js +
  // the WebSocket streaming logic in src/store/actions.js -- InitWebSocketConnect
  // and lexPostText), which is Couchbase's own backend app -- originally built
  // as a proxy in front of AWS Lex/Kendra/Bedrock, now being gutted of those
  // and pointed at Capella internally. The frontend-facing contract stays the
  // same either way: plain REST for session bookkeeping and to kick off a
  // turn (no auth token, since credentials now live entirely server-side),
  // and a separate wss:// connection the backend streams answer tokens over,
  // ending each turn with a literal "/stop/" text message as an end-of-stream
  // sentinel. (An earlier branch, DOC-14221-move-to-ask-ai, called Capella
  // directly from the browser over REST+SSE with Basic-auth credentials --
  // that was rolled back and is NOT what this talks to.)
  //
  // Simplified relative to the Vue original: that store staggered incoming
  // chunks onto the screen with an artificial ~500ms-per-chunk "typing"
  // delay (see typingWsMessages/wsMessagesCurrentIndex in mutations.js) --
  // a UI polish detail, not part of the wire protocol -- so this just
  // displays each chunk as it arrives. Also drops the original's Cognito
  // credential handshake (`initCredentials`/`this.credentials.getPromise()`),
  // which referenced a `this.lexRuntimeClient` that's never actually
  // initialized anywhere in that file -- dead code left over from an earlier
  // direct-AWS-SDK integration, not exercised by the working REST+WS flow.
  function createChatClient (config) {
    var apiUri = config.apiUri
    var wsEndpoint = config.streamingWebSocketEndpoint
    var sessionId = config.sessionId || generateSessionId()

    var conversationHistory = []
    var wsClient = null
    var wsClientReady = null

    function generateSessionId () {
      return 'lex-web-ui-' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1)
    }

    function connectWebSocket () {
      // the WebSocket constructor throws synchronously on a malformed URL
      // (e.g. no real endpoint configured yet) -- turn that into a rejected
      // promise like every other failure mode here, rather than crashing
      wsClientReady = new Promise(function (resolve, reject) {
        try {
          wsClient = new WebSocket(wsEndpoint + '?sessionId=' + sessionId)
        } catch (e) {
          reject(e)
          return
        }
        wsClient.onopen = resolve
        wsClient.onerror = reject
      })
      return wsClientReady
    }

    function ensureWebSocket () {
      if (!wsClient || wsClient.readyState === WebSocket.CLOSED || wsClient.readyState === WebSocket.CLOSING) {
        return connectWebSocket()
      }
      return wsClientReady
    }

    // open the socket eagerly, matching lex-bot-ui's initLexClient, so it's
    // normally already connected by the time the first message is sent.
    // Nothing here awaits this particular call, so give it its own .catch
    // to avoid an unhandled-rejection warning when there's no real endpoint
    // configured yet -- postText's own ensureWebSocket() call handles and
    // reports the same failure properly when a message is actually sent.
    ensureWebSocket().catch(function () {})

    function postText (text, clientContext, onChunk) {
      conversationHistory.push({ role: 'user', content: text })

      var fullText = ''
      var stillStreaming = true

      function onWsMessage (event) {
        if (event.data === '/stop/') {
          stillStreaming = false
          return
        }
        fullText += event.data
        if (onChunk) onChunk(event.data)
      }

      function waitForStreamToStop () {
        return new Promise(function (resolve) {
          var poll = setInterval(function () {
            if (!stillStreaming) {
              clearInterval(poll)
              resolve()
            }
          }, 100)
        })
      }

      return ensureWebSocket()
        .then(function () {
          wsClient.onmessage = onWsMessage
          return fetch(apiUri + '/text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: sessionId, text: text, clientContext: clientContext }),
          })
        })
        .then(function (response) { return response.json() })
        .then(function (data) {
          // the REST response may already carry the final answer (fast
          // path), or the gateway may have timed out while the backend kept
          // working -- either way the WebSocket's "/stop/" sentinel is the
          // authoritative end-of-turn signal, so always wait for it
          return waitForStreamToStop().then(function () {
            var message = fullText || data.message || ''
            conversationHistory.push({ role: 'assistant', content: message })
            return { status: 200, message: message }
          })
        })
        .catch(function (error) {
          // drop the optimistically-added user turn so history stays consistent
          conversationHistory.pop()
          console.error('Error in postText:', error)
          // a WebSocket failure surfaces as a plain Event, not an Error --
          // it has no .message, so fall back to something readable
          var errorMsg = 'Error communicating with the chat service: ' + (error.message || error.type || String(error))
          if (onChunk) onChunk(errorMsg)
          return { status: 500, message: errorMsg }
        })
    }

    return {
      postText: postText,
      getSessionId: function () { return sessionId },
      startNewSession: function () {
        conversationHistory = []
        return fetch(apiUri + '/session', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionId }),
        })
      },
      getHistory: function () { return conversationHistory },
      restoreHistory: function (history) { conversationHistory = history || [] },
    }
  }

  window.CouchbaseChatClient = { create: createChatClient }
})()
