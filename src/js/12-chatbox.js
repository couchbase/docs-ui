;(function () {
  var iframeLoader = new window.ChatBotUiLoader.IframeLoader()

  const qs = (q) => document.head.querySelector(q)?.content

  const iframeOrigin = qs('meta[name="page-chatbot-origin"]') ||
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

  const clientContext = {
    product: {
      value: qs('meta[name="docsearch:component"]'),
      description: qs('meta[name="docsearch:component_title"]'),
    },
    surface: { value: 'docs', description: 'Couchbase Docs' },
    service: {
      value: qs('meta[name="docsearch:component"]'),
      description: qs('meta[name="docsearch:component_title"]'),
    },
    page: {
      route: {
        value: qs('meta[name="page-url"]'),
        description: qs('meta[name="docsearch:breadcrumbs"]'),
      },
      description: qs('meta[name="docsearch:breadcrumbs"]'),
    },
    component: {
      id: {
        value: qs('meta[name="docsearch:component"]'),
        description: qs('meta[name="docsearch:component_title"]'),
      },
      edition: { value: qs('meta[name="docsearch:edition"]') },
      version: { value: qs('meta[name="docsearch:cversion"]') },
      description: qs('meta[name="docsearch:component_title"]'),
    },
  }

  // load the iframe
  iframeLoader
    .load(chatbotUiconfig)
    .then(function () {
      iframeLoader.api.ping()

      // perform actions on the parent dependent on the chatbot loading.
      iframeLoader.api.setClientContext(clientContext)

      // document.getElementById('send-intent').setAttribute('disabled', false)
    })
    .catch(function (error) {
      console.error('chatbot UI failed to load', error, iframeOrigin)
    })
})()
