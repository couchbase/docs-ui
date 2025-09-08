;(function () {
  var iframeLoader = new window.ChatBotUiLoader.IframeLoader()

  const iframeOrigin = document.head.querySelector(
    'meta[name="page-chatbot-origin"]')?.content ||
      'https://d2sozpdiqok6m4.cloudfront.net'

  const origin = window.parent.origin
  var chatbotUiconfig = {
    ui: {
      parentOrigin: origin,
      toolbarTitle: 'Couchbase',
      toolbarLogo: 'https://www.couchbase.com/wp-content/uploads/sites/3/2023/10/SDKs_Ottoman.svg',
      positiveFeedbackIntent: 'Thumbs up',
      negativeFeedbackIntent: 'Thumbs down',
      helpIntent: 'Help',
      enableLogin: false,
      forceLogin: false,
      AllowSuperDangerousHTMLInMessage: true,
      shouldDisplayResponseCardTitle: false,
      saveHistory: false,
      minButtonContent: '',
      hideInputFieldsForButtonResponse: false,
      pushInitialTextOnRestart: false,
      directFocusToBotInput: false,
      showDialogStateIcon: false,
      backButton: false,
      messageMenu: true,
      hideButtonMessageBubble: false,
      enableLiveChat: false,
    },
    iframe: {
      iframeOrigin,
      shouldLoadIframeMinimized: true,
      iframeSrcPath: '/#/?lexWebUiEmbed=true&parentOrigin=' + origin,
    },
  }

  // load the iframe
  iframeLoader
    .load(chatbotUiconfig)
    .then(function () {
      iframeLoader.api.ping()
      // perform actions on the parent dependent on the chatbot loading.
      // document.getElementById('send-intent').setAttribute('disabled', false)
    })
    .catch(function (error) {
      console.error('chatbot UI failed to load', error, iframeOrigin)
    })
})()
