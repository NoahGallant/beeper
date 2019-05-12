const html = require('choo/html')
const statusDisplay = require('./statusDisplay')

module.exports = header

function header (state) {
  return html`
    <nav class='top-bar'>
      <a href="/">
        <img src="/img/dat-hexagon.svg" alt="Dat Project Logo">
        <span class="title">
          <span class="first-word">Dat</span> Shopping List
        </span>
      </a>
      ${statusDisplay(state)}
    </nav>
  `
}
