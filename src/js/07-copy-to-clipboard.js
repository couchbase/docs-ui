;(function () {
  'use strict'
  var runCodeLangs = { cpp: 'cc', csharp: 'dotnet', js: 'nodejs', python: 'py', ruby: 'rb' }
  var displayLangs = { sqlpp: 'sql++' }
  var main = document.querySelector('main.article')
  document.querySelectorAll('pre > code').forEach(function (codeBlock) {
    var pre = codeBlock.parentNode
    var viewSourceLink
    var sourceUrl = codeBlock.dataset.sourceUrl
    if (sourceUrl) {
      viewSourceLink = document.createElement('a')
      viewSourceLink.href = sourceUrl
      viewSourceLink.className = 'view-source-button remove-ext-icon'
      viewSourceLink.target = '_blank'
      viewSourceLink.dataset.title = 'View On GitHub'
      viewSourceLink.appendChild(document.createElement('i')).className = 'fab fa-github'
      var viewText = document.createTextNode('View')
      viewSourceLink.appendChild(viewText)
    }
    var sourceTypeBox = document.createElement('div')
    sourceTypeBox.className = 'source-type-box'

    var headingBox = document.createElement('div')
    headingBox.className = 'col-2 left-block'

    var sourceTypeBoxCol2 = document.createElement('div')
    sourceTypeBoxCol2.className = 'col-2 right-block'

    var copyButton = document.createElement('button')
    copyButton.type = 'button'
    copyButton.className = 'copy-code-button'
    copyButton.setAttribute('aria-label', 'Copy code to clipboard')
    var copyStatus = document.createElement('span')
    copyStatus.className = 'visually-hidden'
    copyStatus.setAttribute('role', 'status')
    copyButton.dataset.title = 'Copy'
    copyButton.appendChild(document.createElement('i')).className = 'far fa-copy'
    var copyText = document.createTextNode('Copy')
    copyButton.appendChild(copyText)

    var dataSource = document.createElement('span')
    dataSource.className = 'data-source'
    dataSource.innerHTML += displayLangs[codeBlock.dataset.lang] || codeBlock.dataset.lang || ''

    var fadeShadow = document.createElement('span')
    fadeShadow.className = 'fade-shadow'

    function announce (message) {
      copyStatus.textContent = message
      setTimeout(function () {
        copyStatus.textContent = ''
      }, 2000)
    }

    copyButton.addEventListener('click', function (e) {
      var bashText = codeBlock.innerText
      // remove '$' from copy to code functionality in code block console
      // var spliceData = bashText.split('$').join('')
      var check = bashText.charAt(0)
      if (check === '$') {
        var spliceData = bashText.substring(2)
        navigator.clipboard.writeText(spliceData).then(
          function () {
            /* Chrome doesn't seem to blur automatically after a click, leaving the button in a focused state;
                keyboard users must keep their focus (e.detail is 0 for keyboard activation). */
            if (e.detail > 0) copyButton.blur()
            announce('Copied to clipboard')
            copyButton.dataset.title = 'Copied ✓'
            setTimeout(function () {
              copyButton.dataset.title = 'Copy'
            }, 2000)
          },
          function () {
            announce('Copy failed')
            copyButton.dataset.title = 'Error'
          }
        )
      } else {
        navigator.clipboard.writeText(codeBlock.innerText).then(
          function () {
            /* Chrome doesn't seem to blur automatically after a click, leaving the button in a focused state;
                keyboard users must keep their focus (e.detail is 0 for keyboard activation). */
            if (e.detail > 0) copyButton.blur()
            announce('Copied to clipboard')
            copyButton.dataset.title = 'Copied ✓'
            setTimeout(function () {
              copyButton.dataset.title = 'Copy'
            }, 2000)
          },
          function () {
            announce('Copy failed')
            copyButton.dataset.title = 'Error'
          }
        )
      }
    })

    var runCodeButton
    if (codeBlock.matches('.listingblock.try-it code')) {
      codeBlock.contentEditable = true
      codeBlock.spellcheck = false
      runCodeButton = document.createElement('button')
      runCodeButton.type = 'button'
      runCodeButton.className = 'run-code'
      runCodeButton.dataset.title = 'Run Code'
      runCodeButton.appendChild(document.createElement('i')).className = 'fas fa-terminal'
      var runCodeButtonText = document.createTextNode('Run Code')
      runCodeButton.appendChild(runCodeButtonText)
      var runCodePanel = createRunCodePanel(main.parentNode)
      runCodeButton.addEventListener('click', function (e) {
        var currentY = this.getBoundingClientRect().top
        document.documentElement.classList.add('terminal-launched')
        var newY = this.getBoundingClientRect().top
        main.scrollBy(0, newY - currentY)
        rebuildRunCodeFrame(runCodePanel)
        var runCodeForm = runCodePanel.querySelector('form')
        runCodeForm.lang.value = runCodeLangs[codeBlock.dataset.lang] || codeBlock.dataset.lang
        var code = codeBlock.innerText
        if (runCodeForm.lang.value === 'java') code = code.replace(/^(?:public )?class \S+/m, 'class Program')
        runCodeForm.code.value = code
        runCodeForm.submit()
      })
    }

    pre.prepend(sourceTypeBox)
    sourceTypeBox.appendChild(headingBox)
    sourceTypeBox.appendChild(sourceTypeBoxCol2)
    headingBox.appendChild(dataSource)
    if (viewSourceLink) sourceTypeBoxCol2.appendChild(viewSourceLink)
    sourceTypeBoxCol2.appendChild(copyButton)
    sourceTypeBoxCol2.appendChild(copyStatus)
    if (runCodeButton) sourceTypeBoxCol2.appendChild(runCodeButton)
    pre.appendChild(fadeShadow)
  })

  // Code that scrolls sideways must be reachable by keyboard (WCAG 2.1.1): make it focusable only while it overflows.
  function markScrollableCode () {
    document.querySelectorAll('pre, pre > code').forEach(function (el) {
      var scrolls = el.scrollWidth > el.clientWidth + 1 && /auto|scroll/.test(window.getComputedStyle(el).overflowX)
      if (scrolls) el.setAttribute('tabindex', '0')
      else if (el.getAttribute('tabindex') === '0') el.removeAttribute('tabindex')
    })
  }
  markScrollableCode()
  window.addEventListener('load', markScrollableCode)
  var scrollableCodeTimer
  window.addEventListener('resize', function () {
    clearTimeout(scrollableCodeTimer)
    scrollableCodeTimer = setTimeout(markScrollableCode, 150)
  })

  function createRunCodePanel (scope) {
    var runCodePanel = document.getElementById('run-code-panel')
    if (runCodePanel.tagName !== 'TEMPLATE') return runCodePanel
    var template = runCodePanel
    runCodePanel = scope.appendChild(template.content.firstElementChild.cloneNode(true))
    runCodePanel.querySelector('.rerun').addEventListener('click', function () {
      rebuildRunCodeFrame(runCodePanel)
    })
    runCodePanel.querySelector('.close').addEventListener('click', function () {
      var main = scope.querySelector('main')
      var viewportTop = main.getBoundingClientRect().top
      var ref = Array.prototype.slice.call(main.querySelectorAll('*')).find(function (it) {
        return it.getBoundingClientRect().top >= viewportTop
      })
      var currentY = ref.getBoundingClientRect().top
      document.documentElement.classList.remove('terminal-launched')
      var newY = ref.getBoundingClientRect().top
      document.documentElement.style.scrollBehavior = 'auto'
      document.documentElement.scrollBy(0, newY - currentY)
      document.documentElement.style.scrollBehavior = ''
    })
    template.parentNode.removeChild(template)
    runCodePanel.id = 'run-code-panel'
    return runCodePanel
  }

  function rebuildRunCodeFrame (scope) {
    var runCodeFrameTemplate = scope.querySelector('iframe')
    var runCodeFrame = runCodeFrameTemplate.cloneNode()
    scope.replaceChild(runCodeFrame, runCodeFrameTemplate)
    runCodeFrame.contentWindow.document.write('<!DOCTYPE html><html><body><pre>Running code...</pre></body></html>')
  }
})()
