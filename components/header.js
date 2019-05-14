const html = require('choo/html')
const statusDisplay = require('./statusDisplay')

module.exports = header

function header (state) {
  return html`
    <nav>
      <div class='bg'> </div>
      <div class='top-bar flex justify-between'>
        <div class='flex items-center'>
          <div class='logo flex items-center justify-center'>
            :-)
          </div>
        </div>
        <div class='status flex items-center justify-center'>
          ${statusDisplay(state)}
        </div>
      </div>
    </nav>
  `
}
