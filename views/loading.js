const html = require('choo/html')

module.exports = loadingView

function loadingView (state, emit) {
  return html`<div>Loading...</div>`
}
