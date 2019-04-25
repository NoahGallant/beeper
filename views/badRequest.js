const html = require('choo/html')

module.exports = badRequestView

function badRequestView (state, emit) {
  return html`<div>Loading...</div>`
}
