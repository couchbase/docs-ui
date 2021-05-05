;(function () {
  'use strict'

  var queryStringData = window.location.search
  if (queryStringData) {
    var urlParams = new URLSearchParams(queryStringData)
    var getCategory = urlParams.get('data-category')
    var classList = getCategory.split(' ')
    var urlFilters = {
      roles: classList,
      languages: '',
      levels: '',
    }
    filterResults(urlFilters)
  }

  var navLink = document.querySelectorAll('.nav-menu.filter li a')

  // looping through the all chekbox link
  navLink.forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault()
      this.classList.toggle('active')
      this.nextElementSibling.classList.toggle('open')
    })
  })
  var filterMenuCheckboxes = document.querySelectorAll('input[type="checkbox"]')
  filterMenuCheckboxes.forEach(function (checkbox) {
    checkbox.addEventListener('change', function (event) {
      var roleCbs = document.querySelectorAll(".roles input[type='checkbox']")
      var languageCbs = document.querySelectorAll(".languages input[type='checkbox']")
      var levelCbs = document.querySelectorAll(".levels input[type='checkbox']")
      var filters = {
        roles: getClassOfCheckedCheckboxes(roleCbs),
        languages: getClassOfCheckedCheckboxes(languageCbs),
        levels: getClassOfCheckedCheckboxes(levelCbs),
      }
      filterResults(filters)
    })
  })

  function getClassOfCheckedCheckboxes (checkboxes) {
    var classes = []
    if (checkboxes && checkboxes.length > 0) {
      for (var i = 0; i < checkboxes.length; i++) {
        var cb = checkboxes[i]
        if (cb.checked) {
          classes.push(cb.getAttribute('value'))
        }
      }
    }
    return classes
  }

  function filterResults (filters) {
    console.log(filters)
    var outputElems = document.querySelectorAll('.card')
    var hiddenElems = []

    if (!outputElems || outputElems.length <= 0) {
      return
    }

    for (var i = 0; i < outputElems.length; i++) {
      var el = outputElems[i]

      if (filters.roles.length > 0) {
        var isHidden = true

        for (var j = 0; j < filters.roles.length; j++) {
          var filter = filters.roles[j]

          if (el.classList.contains(filter)) {
            isHidden = false
            break
          }
        }

        if (isHidden) {
          hiddenElems.push(el)
        }
      }

      if (filters.languages.length > 0) {
        isHidden = true

        for (var k = 0; k < filters.languages.length; k++) {
          var languagesfilter = filters.languages[k]

          if (el.classList.contains(languagesfilter)) {
            isHidden = false
            break
          }
        }

        if (isHidden) {
          hiddenElems.push(el)
        }
      }

      if (filters.levels.length > 0) {
        isHidden = true

        for (var l = 0; l < filters.levels.length; l++) {
          var levelsFilter = filters.levels[l]

          if (el.classList.contains(levelsFilter)) {
            isHidden = false
            break
          }
        }

        if (isHidden) {
          hiddenElems.push(el)
        }
      }
    }

    for (var m = 0; m < outputElems.length; m++) {
      outputElems[m].style.display = 'block'
    }

    if (hiddenElems.length <= 0) {
      return
    }

    for (var n = 0; n < hiddenElems.length; n++) {
      hiddenElems[n].style.display = 'none'
    }
  }
})()
