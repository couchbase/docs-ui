;(function () {
  'use strict'
  document.querySelectorAll('pre > code').forEach(function (codeBlock) {
    console.log(codeBlock,4)
    var viewSourceLink
    var sourceUrl = codeBlock.dataset.sourceUrl
    if (sourceUrl) {
      viewSourceLink = document.createElement('a')
      viewSourceLink.href = codeBlock.dataset.sourceUrl
      viewSourceLink.className = 'view-source-button'
      viewSourceLink.target = '_blank'
      viewSourceLink.dataset.title = 'View On GitHub'
      viewSourceLink.appendChild(document.createElement('i')).className = 'fab fa-github'
    }
    var sourceTypeBox = document.createElement('div')
    sourceTypeBox.className = 'source-type-box'

    var headingBox = document.createElement('div')
    headingBox.className = 'col-2 left-block'

    var sourceTypeBoxCol2 = document.createElement('div')
    sourceTypeBoxCol2.className = 'col-2 right-block'

    var copyButton = document.createElement('a')
    copyButton.className = 'copy-code-button'
    copyButton.dataset.title = 'Copy'
    copyButton.appendChild(document.createElement('i')).className = 'far fa-copy'
    var copyText = document.createTextNode('Copy')
    copyButton.appendChild(copyText)

    var dataSource = document.createElement('span')
    dataSource.className = 'data-source'
    dataSource.innerHTML += codeBlock.dataset.lang

    var fadeShadow = document.createElement('span')
    fadeShadow.className = 'fade-shadow'

    var runCode = document.createElement('a')
    runCode.className= 'run-code'
    runCode.dataset.title = 'Run Code'
    runCode.href= '#'
    runCode.target = '_blank'
    runCode.appendChild(document.createElement('i')).className = 'fas fa-terminal'
    var runCodeText = document.createTextNode('Run Code')
    runCode.appendChild(runCodeText)

    copyButton.addEventListener('click', function (e) {
      // NOTE: ignore event on pseudo-element
      if (e.currentTarget === e.target) return
      var bashText = codeBlock.innerText
      // remove '$' from copy to code functionality in code block console
      // var spliceData = bashText.split('$').join('')
      var check = bashText.charAt(0)
      if (check === '$') {
        var spliceData = bashText.substring(2)
        navigator.clipboard.writeText(spliceData).then(
          function () {
            /* Chrome doesn't seem to blur automatically,
                leaving the button in a focused state. */
            copyButton.blur()
            copyButton.dataset.title = 'Copied ✓'
            setTimeout(function () {
              copyButton.dataset.title = 'Copy'
            }, 2000)
          },
          function () {
            copyButton.dataset.title = 'Error'
          }
        )
      } else {
        navigator.clipboard.writeText(codeBlock.innerText).then(
          function () {
            /* Chrome doesn't seem to blur automatically,
                leaving the button in a focused state. */
            copyButton.blur()
            copyButton.dataset.title = 'Copied ✓'
            setTimeout(function () {
              copyButton.dataset.title = 'Copy'
            }, 2000)
          },
          function () {
            copyButton.dataset.title = 'Error'
          }
        )
      }
    })
    var pre = codeBlock.parentNode
    pre.prepend(sourceTypeBox)
    sourceTypeBox.appendChild(headingBox)
    sourceTypeBox.appendChild(sourceTypeBoxCol2)
    sourceTypeBoxCol2.appendChild(dataSource)
    if (viewSourceLink) sourceTypeBoxCol2.appendChild(viewSourceLink)
    sourceTypeBoxCol2.appendChild(copyButton)
    sourceTypeBoxCol2.appendChild(runCode)
    pre.appendChild(fadeShadow)
  })
})()
