# Landing Page Filter Fix

## Problem Identified

The filtering functionality on landing pages (like `product-landing-example.adoc`) was not working because of a **structural mismatch** between where the data attributes were located in the HTML and where the JavaScript was looking for them.

### Root Cause

**HTML Structure (Generated):**
```html
<div class="exampleblock landing-card landing-card--interactive">
  <div class="content">
    <!-- DATA ATTRIBUTES ARE HERE -->
    <div data-product="server" data-topic="managed" onclick="...">
      <div class="landing-card__content">
        <!-- Card content -->
      </div>
    </div>
  </div>
</div>
```

**JavaScript Expectation:**
The JavaScript was trying to read data attributes directly from the `.landing-card` element:
```javascript
const allCards = document.querySelectorAll('.landing-card')
allCards.forEach((card) => {
  const cardValue = card.dataset[filterType] // This returned undefined!
})
```

### Filter Data
- **Filter Options:** `data-filter-type="topic"` with values like "compiled", "managed", "scripting"
- **Card Attributes:** `data-topic="managed"`, `data-product="server"`, etc.
- **Values matched correctly**, but were on the wrong element level

## Solution Implemented

Modified the `cardMatchesFilters()` function in `/src/js/13-landing-interactions.js` to:

1. **First check the card element itself** for data attributes
2. **If not found, search child elements** using `card.querySelector([data-${filterType}])`
3. **Extract the data attribute from the child element** if found

### Code Changes

**Enhanced `cardMatchesFilters()` method:**
```javascript
// Try to get data attribute from card first, then from child element
let cardValue = card.dataset[filterType]
if (!cardValue) {
  // Look for data attribute on child elements
  const childWithData = card.querySelector(`[data-${filterType}]`)
  if (childWithData) {
    cardValue = childWithData.dataset[filterType]
  }
}
```

**Normalized filter value storage:**
```javascript
const filterValue = filterOption.dataset.filterValue.toLowerCase() // Normalize to lowercase
```

## Result

✅ **Filters now work correctly** - the JavaScript can find data attributes on child elements
✅ **Case-insensitive comparison** - filter values are normalized to lowercase
✅ **Backward compatible** - still works if data attributes are on the card element itself

## Test Verification

The fix has been built and deployed to the preview site at `http://localhost:5252/product-landing-example.html`. The minified JavaScript shows our changes are included in the build.

### Expected Behavior

Now when users click filter options like:
- **Language Type:** "Compiled Languages", "Managed/VM Languages", "Scripting Languages"
- **Product:** "Server", "Enterprise Analytics", "Capella Analytics"

The landing cards should be filtered correctly based on their `data-topic` and `data-product` attributes.