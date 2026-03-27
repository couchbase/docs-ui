/**
 * Landing Page Interactive Features
 * Handles filtering, animations, and modern UX interactions
 */

;(function () {
  'use strict'

  // Landing page functionality namespace
  window.landingPage = {
    filters: {},
    animationObserver: null,
    
    // Initialize all landing page features
    init() {
      this.initAnimations()
      this.initFiltering()
      this.initInteractiveCards()
      this.initSmoothScrolling()
      this.initProgressIndicators()
      this.initLazyLoading()
    },
    
    // Initialize scroll-triggered animations
    initAnimations() {
      if (!window.IntersectionObserver) return
      
      // Create observer for fade-in animations
      this.animationObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in')
            // Stagger animation for card grids
            if (entry.target.classList.contains('landing-grid')) {
              this.staggerCardAnimations(entry.target)
            }
          }
        })
      }, {
        threshold: 0.1,
        rootMargin: '50px'
      })
      
      // Observe all animatable elements
      const animatableElements = document.querySelectorAll([
        '.landing-hero',
        '.landing-grid', 
        '.landing-media',
        '.landing-filter'
      ].join(','))
      
      animatableElements.forEach(el => {
        this.animationObserver.observe(el)
      })
    },
    
    // Stagger card animations within a grid
    staggerCardAnimations(grid) {
      const cards = grid.querySelectorAll('.landing-card')
      cards.forEach((card, index) => {
        setTimeout(() => {
          card.style.opacity = '1'
          card.style.transform = 'translateY(0)'
        }, index * 100) // 100ms delay between each card
      })
    },
    
    // Initialize content-aware filtering system
    initFiltering() {
      const filterContainer = document.getElementById('landing-filter')
      if (!filterContainer) return
      
      // Initialize filter state
      this.filters = {
        difficulty: [],
        product: [], 
        topic: [],
        tags: []
      }
      
      // Initialize collapse functionality
      this.initFilterCollapse(filterContainer)
      
      // Add event listeners to filter options
      const filterOptions = filterContainer.querySelectorAll('.landing-filter__option')
      filterOptions.forEach(option => {
        option.addEventListener('click', (e) => {
          e.preventDefault()
          this.toggleFilter(option)
        })
      })
      
      // Clear all filters button
      const clearButton = filterContainer.querySelector('.landing-filter__clear')
      if (clearButton) {
        clearButton.addEventListener('click', () => {
          this.clearAllFilters()
        })
      }
      
      // Add keyboard navigation
      filterOptions.forEach(option => {
        option.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            this.toggleFilter(option)
          }
        })
        option.setAttribute('tabindex', '0')
      })
    },
    
    // Toggle individual filter
    toggleFilter(filterOption) {
      const filterType = filterOption.dataset.filterType
      const filterValue = filterOption.dataset.filterValue.toLowerCase() // Normalize to lowercase
      const checkbox = filterOption.querySelector('input[type="checkbox"]')
      
      // Toggle visual state
      filterOption.classList.toggle('landing-filter__option--active')
      checkbox.checked = !checkbox.checked
      
      // Update filter state
      if (checkbox.checked) {
        if (!this.filters[filterType].includes(filterValue)) {
          this.filters[filterType].push(filterValue)
        }
      } else {
        this.filters[filterType] = this.filters[filterType].filter(v => v !== filterValue)
      }
      
      // Apply filters with animation
      this.applyFilters()
      
      // Add ripple effect
      this.addRippleEffect(filterOption)
    },
    
    // Clear all active filters
    clearAllFilters() {
      // Reset filter state
      Object.keys(this.filters).forEach(key => {
        this.filters[key] = []
      })
      
      // Reset visual states
      document.querySelectorAll('.landing-filter__option--active').forEach(option => {
        option.classList.remove('landing-filter__option--active')
        const checkbox = option.querySelector('input[type="checkbox"]')
        if (checkbox) checkbox.checked = false
      })
      
      // Show all items and headings
      this.applyFilters()
    },
    
    // Apply current filters to content
    applyFilters() {
      const allCards = document.querySelectorAll('.landing-card')
      let visibleCount = 0
      
      allCards.forEach((card, index) => {
        const shouldShow = this.cardMatchesFilters(card)
        
        if (shouldShow) {
          // Animate card in
          setTimeout(() => {
            card.classList.remove('landing-hidden', 'landing-fade-out')
            card.style.opacity = '1'
            card.style.transform = 'translateY(0)'
          }, visibleCount * 50) // Stagger the animation
          
          visibleCount++
        } else {
          // Animate card out
          card.classList.add('landing-fade-out')
          setTimeout(() => {
            card.classList.add('landing-hidden')
          }, 300)
        }
      })
      
      // Hide/show section headings based on visible cards in their sections
      setTimeout(() => {
        this.updateSectionHeadings()
      }, 350) // Wait for card animations to complete
      
      // Update results count
      this.updateResultsCount(visibleCount, allCards.length)
      
      // Update grid layout
      this.updateGridLayout()
    },
    
    // Hide/show h2 headings when their section has no visible cards
    updateSectionHeadings() {
      const grids = document.querySelectorAll('.landing-grid')
      
      grids.forEach(grid => {
        const visibleCards = grid.querySelectorAll('.landing-card:not(.landing-hidden)')
        
        // Find the immediately preceding h2 element
        let currentElement = grid.previousElementSibling
        let h2Element = null
        
        // Walk backwards through siblings to find the h2
        while (currentElement) {
          if (currentElement.tagName === 'H2') {
            h2Element = currentElement
            break
          }
          currentElement = currentElement.previousElementSibling
        }
        
        if (h2Element) {
          if (visibleCards.length === 0) {
            // Hide the section heading when no cards are visible
            h2Element.style.display = 'none'
            h2Element.classList.add('section-hidden')
          } else {
            // Show the section heading when cards are visible  
            h2Element.style.display = ''
            h2Element.classList.remove('section-hidden')
          }
        }
      })
    },
    
    // Initialize filter collapse functionality
    initFilterCollapse(filterContainer) {
      const toggleButton = filterContainer.querySelector('.landing-filter__toggle')
      if (!toggleButton) return
      
      toggleButton.addEventListener('click', () => {
        this.toggleFilterCollapse(filterContainer)
      })
      
      // Add keyboard support
      toggleButton.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          this.toggleFilterCollapse(filterContainer)
        }
      })
    },
    
    // Toggle filter collapse state
    toggleFilterCollapse(filterContainer) {
      const isCollapsed = filterContainer.classList.contains('landing-filter--collapsed')
      const toggleButton = filterContainer.querySelector('.landing-filter__toggle')
      const toggleText = toggleButton.querySelector('.landing-filter__toggle-text')
      
      if (isCollapsed) {
        filterContainer.classList.remove('landing-filter--collapsed')
        toggleText.textContent = 'Collapse'
        toggleButton.setAttribute('aria-expanded', 'true')
      } else {
        filterContainer.classList.add('landing-filter--collapsed')
        toggleText.textContent = 'Expand'
        toggleButton.setAttribute('aria-expanded', 'false')
      }
    },
    
    // Check if card matches current filters
    cardMatchesFilters(card) {
      // If no filters are active, show all cards
      const hasActiveFilters = Object.values(this.filters).some(arr => arr.length > 0)
      if (!hasActiveFilters) return true
      
      // Check each filter type
      for (const [filterType, activeValues] of Object.entries(this.filters)) {
        if (activeValues.length === 0) continue // Skip empty filters
        
        // Try to get data attribute from card first, then from child element
        let cardValue = card.dataset[filterType]
        if (!cardValue) {
          // Look for data attribute on child elements
          const childWithData = card.querySelector(`[data-${filterType}]`)
          if (childWithData) {
            cardValue = childWithData.dataset[filterType]
          }
        }
        
        if (!cardValue) continue // Skip cards without this attribute
        
        // For tags, check if any active tag matches card tags
        if (filterType === 'tags') {
          const cardTags = cardValue.toLowerCase().split(' ')
          const hasMatchingTag = activeValues.some(tag => 
            cardTags.includes(tag.toLowerCase())
          )
          if (!hasMatchingTag) return false
        } else {
          // For other attributes, check exact match
          if (!activeValues.includes(cardValue.toLowerCase())) {
            return false
          }
        }
      }
      
      return true
    },
    
    // Update results count display
    updateResultsCount(visible, total) {
      let countElement = document.querySelector('.landing-results-count')
      if (!countElement) {
        countElement = document.createElement('div')
        countElement.className = 'landing-results-count'
        const filterContainer = document.getElementById('landing-filter')
        if (filterContainer) {
          filterContainer.appendChild(countElement)
        }
      }
      
      const hasActiveFilters = Object.values(this.filters).some(arr => arr.length > 0)
      if (hasActiveFilters) {
        countElement.textContent = `Showing ${visible} of ${total} results`
        countElement.style.display = 'block'
      } else {
        countElement.style.display = 'none'
      }
    },
    
    // Adjust grid layout after filtering
    updateGridLayout() {
      const grids = document.querySelectorAll('.landing-grid')
      grids.forEach(grid => {
        const visibleCards = grid.querySelectorAll('.landing-card:not(.landing-hidden)')
        // Add class for styling based on visible count
        grid.classList.remove('has-few-items', 'has-many-items')
        if (visibleCards.length <= 2) {
          grid.classList.add('has-few-items')
        } else if (visibleCards.length >= 6) {
          grid.classList.add('has-many-items')  
        }
      })
    },
    
    // Initialize interactive card behaviors
    initInteractiveCards() {
      const interactiveCards = document.querySelectorAll('.landing-card--interactive')
      
      interactiveCards.forEach(card => {
        // Add hover sound effect (if audio is enabled)
        card.addEventListener('mouseenter', () => {
          this.playHoverSound()
        })
        
        // Add click ripple effect
        card.addEventListener('click', (e) => {
          if (!card.onclick) return // Skip if card has custom click handler
          this.addRippleEffect(card, e)
        })
        
        // Add keyboard navigation
        card.setAttribute('tabindex', '0')
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (card.onclick) {
              card.onclick()
            } else {
              const link = card.querySelector('a[href]')
              if (link) link.click()
            }
          }
        })
      })
    },
    
    // Add ripple effect to interactive elements
    addRippleEffect(element, event) {
      const ripple = document.createElement('span')
      ripple.className = 'ripple-effect'
      
      const rect = element.getBoundingClientRect()
      const x = (event ? event.clientX : rect.left + rect.width / 2) - rect.left
      const y = (event ? event.clientY : rect.top + rect.height / 2) - rect.top
      
      ripple.style.left = x + 'px'
      ripple.style.top = y + 'px'
      
      element.appendChild(ripple)
      
      // Remove ripple after animation
      setTimeout(() => {
        if (ripple.parentNode) {
          ripple.parentNode.removeChild(ripple)
        }
      }, 600)
    },
    
    // Play subtle hover sound (optional)
    playHoverSound() {
      if (this.audioEnabled && this.hoverSound) {
        this.hoverSound.currentTime = 0
        this.hoverSound.volume = 0.1
        this.hoverSound.play().catch(() => {}) // Ignore errors
      }
    },
    
    // Initialize smooth scrolling for anchor links
    initSmoothScrolling() {
      const anchorLinks = document.querySelectorAll('a[href^="#"]')
      
      anchorLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          const targetId = link.getAttribute('href').slice(1)
          const targetElement = document.getElementById(targetId)
          
          if (targetElement) {
            e.preventDefault()
            targetElement.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            })
          }
        })
      })
    },
    
    // Initialize progress indicators
    initProgressIndicators() {
      if (!window.IntersectionObserver) return
      
      // Create progress bar
      const progressBar = document.createElement('div')
      progressBar.className = 'landing-progress-bar'
      progressBar.innerHTML = '<div class="landing-progress-fill"></div>'
      document.body.appendChild(progressBar)
      
      // Update progress based on scroll
      let ticking = false
      const updateProgress = () => {
        const scrollTop = window.pageYOffset
        const docHeight = document.documentElement.scrollHeight - window.innerHeight
        const scrollPercent = (scrollTop / docHeight) * 100
        
        const progressFill = progressBar.querySelector('.landing-progress-fill')
        progressFill.style.width = Math.min(100, Math.max(0, scrollPercent)) + '%'
        
        // Show/hide progress bar
        if (scrollTop > 200) {
          progressBar.classList.add('visible')
        } else {
          progressBar.classList.remove('visible')
        }
        
        ticking = false
      }
      
      window.addEventListener('scroll', () => {
        if (!ticking) {
          requestAnimationFrame(updateProgress)
          ticking = true
        }
      })
    },
    
    // Initialize lazy loading for images
    initLazyLoading() {
      if (!window.IntersectionObserver) return
      
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target
            if (img.dataset.src) {
              img.src = img.dataset.src
              img.removeAttribute('data-src')
            }
            img.classList.add('loaded')
            imageObserver.unobserve(img)
          }
        })
      })
      
      // Observe all lazy images
      const lazyImages = document.querySelectorAll('img[data-src]')
      lazyImages.forEach(img => imageObserver.observe(img))
    },
    
    // Utility: Debounce function
    debounce(func, wait) {
      let timeout
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout)
          func(...args)
        }
        clearTimeout(timeout)
        timeout = setTimeout(later, wait)
      }
    },
    
    // Utility: Check if user prefers reduced motion
    prefersReducedMotion() {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
  }
  
  // Global filter functions for backward compatibility
  window.landingFilter = {
    clearAll: () => window.landingPage.clearAllFilters()
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.landingPage.init()
    })
  } else {
    window.landingPage.init()
  }
  
  // Add CSS for ripple effects and progress bar
  const style = document.createElement('style')
  style.textContent = `
    .ripple-effect {
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.6);
      transform: scale(0);
      animation: ripple 0.6s linear;
      pointer-events: none;
    }
    
    @keyframes ripple {
      to {
        transform: scale(4);
        opacity: 0;
      }
    }
    
    .landing-progress-bar {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 3px;
      background: rgba(0, 0, 0, 0.1);
      z-index: 9999;
      opacity: 0;
      transform: translateY(-3px);
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
    
    .landing-progress-bar.visible {
      opacity: 1;
      transform: translateY(0);
    }
    
    .landing-progress-fill {
      height: 100%;
      background: var(--color-brand-blue);
      width: 0%;
      transition: width 0.3s ease;
    }
    
    .landing-results-count {
      margin-top: var(--landing-spacing-md);
      font-size: 0.875rem;
      color: var(--color-text);
      text-align: center;
    }
    
    .landing-grid.has-few-items {
      justify-content: center;
    }
    
    .landing-grid.has-few-items .landing-card {
      max-width: 400px;
    }
  `
  document.head.appendChild(style)
  
})()