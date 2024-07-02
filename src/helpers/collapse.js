function toggleCollapse (index) {
  const collapsibles = document.querySelectorAll('.collapsible')
  const images = ['image1.jpg', 'image2.jpg', 'image3.jpg', 'image4.jpg']
  const imageElement = document.getElementById('image')

  collapsibles.forEach((collapsible, i) => {
    const content = collapsible.querySelector('.content')
    if (i === index) {
      content.style.display = content.style.display === 'block' ? 'none' : 'block'
      imageElement.src = images[index]
    } else {
      content.style.display = 'none'
    }
  })
}

document.addEventListener('DOMContentLoaded', () => {
  const collapsibles = document.querySelectorAll('.collapsible')
  collapsibles.forEach((collapsible, index) => {
    collapsible.addEventListener('click', () => {
      toggleCollapse(index)
    })
  })
})
