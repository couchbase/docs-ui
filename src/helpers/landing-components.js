/**
 * Landing Page Component Helpers for Handlebars
 * Provides reusable components for modern landing page layouts
 */

// Hero Section Helper
function landingHero(options) {
  const { title, description, actions = [], backgroundClass = '' } = options.hash || {}
  
  let actionsHtml = ''
  if (actions.length > 0) {
    actionsHtml = `
      <div class="landing-hero-actions">
        ${actions.map(action => `
          <a href="${action.href}" class="landing-btn landing-btn--${action.type || 'primary'}">
            ${action.icon ? `<i class="${action.icon}"></i>` : ''}
            ${action.text}
          </a>
        `).join('')}
      </div>
    `
  }
  
  return `
    <div class="landing-hero ${backgroundClass}">
      <div class="landing-hero-content">
        ${title ? `<h1>${title}</h1>` : ''}
        ${description ? `<p>${description}</p>` : ''}
        ${actionsHtml}
      </div>
    </div>
  `
}

// Card Grid Helper  
function landingCardGrid(options) {
  const { columns = 3, items = [], spacing = 'lg' } = options.hash || {}
  
  if (!Array.isArray(items) || items.length === 0) {
    return ''
  }
  
  const cardsHtml = items.map(item => {
    const {
      title,
      description, 
      icon,
      image,
      href,
      tags = [],
      difficulty,
      product,
      topic,
      featured = false,
      interactive = true
    } = item
    
    let cardClasses = ['landing-card']
    if (featured) cardClasses.push('landing-card--featured')
    if (interactive) cardClasses.push('landing-card--interactive')
    
    // Build data attributes for filtering
    let dataAttrs = ''
    if (difficulty) dataAttrs += `data-difficulty="${difficulty.toLowerCase()}" `
    if (product) dataAttrs += `data-product="${product.toLowerCase()}" `
    if (topic) dataAttrs += `data-topic="${topic.toLowerCase()}" `
    if (tags.length > 0) dataAttrs += `data-tags="${tags.join(' ').toLowerCase()}" `
    
    // Build tags HTML
    let tagsHtml = ''
    if (tags.length > 0 || difficulty || product) {
      const allTags = []
      if (difficulty) allTags.push({ text: difficulty, type: `difficulty-${difficulty.toLowerCase()}` })
      if (product) allTags.push({ text: product, type: `product-${product.toLowerCase()}` })
      tags.forEach(tag => allTags.push({ text: tag, type: 'default' }))
      
      tagsHtml = `
        <div class="landing-card__tags">
          ${allTags.map(tag => `
            <span class="landing-card__tag landing-card__tag--${tag.type}">${tag.text}</span>
          `).join('')}
        </div>
      `  
    }
    
    // Build media section (only for images, not icons)
    let mediaHtml = ''
    if (image && !icon) {
      mediaHtml = `
        <div class="landing-card__media">
          <img src="${image.src}" alt="${image.alt || title}" loading="lazy">
        </div>
      `
    }
    
    // Build card content with icon before title
    const cardContent = `
      ${mediaHtml}
      <div class="landing-card__content">
        ${title ? `<h3 class="landing-card__title">${icon ? `<i class="landing-card__title-icon ${icon}"></i>` : ''}${title}</h3>` : ''}
        ${description ? `<p class="landing-card__description">${description}</p>` : ''}
        ${tagsHtml}
        <div class="landing-card__actions">
          ${href ? `<a href="${href}" class="landing-card__link">Learn More</a>` : ''}
        </div>
      </div>
    `
    
    return `
      <div class="${cardClasses.join(' ')}" ${dataAttrs} ${href && interactive ? `onclick="window.location.href='${href}'"` : ''}>
        ${cardContent}
      </div>
    `
  }).join('')
  
  return `
    <div class="landing-grid landing-grid--cols-${columns}">
      ${cardsHtml}
    </div>
  `
}

// Filter Component Helper
function landingFilter(options) {
  const { 
    title = 'Filter Content',
    groups = [],
    showClear = true 
  } = options.hash || {}
  
  const groupsHtml = groups.map(group => {
    const optionsHtml = group.options.map(option => `
      <label class="landing-filter__option" data-filter-type="${group.type}" data-filter-value="${option.value}">
        <input type="checkbox" value="${option.value}" name="${group.type}" style="display: none;">
        ${option.label}
      </label>
    `).join('')
    
    return `
      <div class="landing-filter__group">
        <div class="landing-filter__group-title">${group.title}</div>
        <div class="landing-filter__options">
          ${optionsHtml}
        </div>
      </div>
    `
  }).join('')
  
  return `
    <div class="landing-filter" id="landing-filter">
      <div class="landing-filter__header">
        <div class="landing-filter__title">${title}</div>
        <button class="landing-filter__toggle" aria-expanded="true" aria-controls="landing-filter-groups">
          <span class="landing-filter__toggle-text">Collapse</span>
          <span class="landing-filter__toggle-icon">▼</span>
        </button>
      </div>
      <div class="landing-filter__groups" id="landing-filter-groups">
        ${groupsHtml}
        ${showClear ? `
          <div class="landing-filter__group">
            <button class="landing-filter__clear" onclick="landingFilter.clearAll()">
              Clear All Filters
            </button>
          </div>
        ` : ''}
      </div>
    </div>
  `
}

// Media Block Helper
function landingMedia(options) {
  const { 
    image,
    title, 
    description,
    reverse = false,
    center = false,
    stack = false,
    imageWidth = '300px'
  } = options.hash || {}
  
  let classes = ['landing-media']
  if (reverse) classes.push('landing-media--reverse')
  if (center) classes.push('landing-media--center') 
  if (stack) classes.push('landing-media--stack')
  
  return `
    <div class="${classes.join(' ')}">
      <div class="landing-media__visual" style="width: ${imageWidth}">
        <img src="${image.src}" alt="${image.alt || title}" loading="lazy">
      </div>
      <div class="landing-media__content">
        ${title ? `<h3>${title}</h3>` : ''}
        ${description ? `<div>${description}</div>` : ''}
        ${options.fn ? options.fn(this) : ''}
      </div>
    </div>
  `
}

// Button Helper
function landingButton(options) {
  const { 
    text, 
    href, 
    type = 'primary', 
    icon,
    size = 'md',
    onclick 
  } = options.hash || {}
  
  const Tag = href ? 'a' : 'button'
  const hrefAttr = href ? `href="${href}"` : ''
  const onclickAttr = onclick ? `onclick="${onclick}"` : ''
  
  return `
    <${Tag} class="landing-btn landing-btn--${type} landing-btn--${size}" ${hrefAttr} ${onclickAttr}>
      ${icon ? `<i class="${icon}"></i>` : ''}
      ${text}
    </${Tag}>
  `
}

// Section Container Helper
function landingSection(options) {
  const { 
    id,
    className = '', 
    background = '',
    spacing = 'lg',
    title,
    description,
    centered = false
  } = options.hash || {}
  
  let classes = ['landing-section']
  if (className) classes.push(className)
  if (background) classes.push(`landing-section--${background}`)
  if (spacing) classes.push(`landing-mb-${spacing}`)
  if (centered) classes.push('landing-text-center')
  
  const idAttr = id ? `id="${id}"` : ''
  
  return `
    <section class="${classes.join(' ')}" ${idAttr}>
      ${title ? `<h2 class="landing-section__title">${title}</h2>` : ''}
      ${description ? `<p class="landing-section__description">${description}</p>` : ''}
      ${options.fn ? options.fn(this) : ''}
    </section>
  `
}

// Feature List Helper  
function landingFeatureList(options) {
  const { 
    features = [],
    columns = 1,
    iconSize = 'md'
  } = options.hash || {}
  
  const featuresHtml = features.map(feature => `
    <div class="landing-feature">
      ${feature.icon ? `<div class="landing-feature__icon landing-feature__icon--${iconSize}"><i class="${feature.icon}"></i></div>` : ''}
      <div class="landing-feature__content">
        ${feature.title ? `<h4 class="landing-feature__title">${feature.title}</h4>` : ''}
        ${feature.description ? `<p class="landing-feature__description">${feature.description}</p>` : ''}
      </div>
    </div>
  `).join('')
  
  return `
    <div class="landing-grid landing-grid--cols-${columns}">
      ${featuresHtml}
    </div>
  `
}

// Loading Skeleton Helper
function landingSkeleton(options) {
  const { type = 'card', count = 3 } = options.hash || {}
  
  const skeletons = Array(count).fill(null).map((_, index) => {
    if (type === 'card') {
      return `
        <div class="landing-skeleton landing-skeleton--card">
          <div style="padding: 1.5rem;">
            <div class="landing-skeleton landing-skeleton--text"></div>
            <div class="landing-skeleton landing-skeleton--text"></div>
            <div class="landing-skeleton landing-skeleton--text"></div>
          </div>
        </div>
      `
    }
    return `<div class="landing-skeleton landing-skeleton--text"></div>`
  }).join('')
  
  if (type === 'card') {
    return `<div class="landing-grid landing-grid--cols-3">${skeletons}</div>`
  }
  
  return skeletons
}

// Responsive Image Helper
function landingImage(options) {
  const {
    src,
    alt = '',
    sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
    loading = 'lazy',
    className = ''
  } = options.hash || {}
  
  return `
    <img 
      src="${src}" 
      alt="${alt}"
      sizes="${sizes}" 
      loading="${loading}"
      class="landing-image ${className}"
    >
  `
}

// Export helpers for Handlebars registration
module.exports = {
  'landing-hero': landingHero,
  'landing-card-grid': landingCardGrid, 
  'landing-filter': landingFilter,
  'landing-media': landingMedia,
  'landing-button': landingButton,
  'landing-section': landingSection,
  'landing-feature-list': landingFeatureList,
  'landing-skeleton': landingSkeleton,
  'landing-image': landingImage
}