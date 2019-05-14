const html = require('choo/html')
const header = require('../components/header')

module.exports = writeLocalView

function writeLocalView (state, emit) {
  emit('DOMTitleChange', 'Beeper - Adding Friend')

  state.viewing = 'writeLocal'

  return html`
    <body>
      ${header(state)}
    </body>
  `
}
