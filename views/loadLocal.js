const html = require('choo/html')
const header = require('../components/header')

module.exports = addFriendView

function addFriendView (state, emit) {
  emit('DOMTitleChange', 'Beeper - Loading local key...')

  state.viewing = 'loadLocal'

  return html`
    <body>
      ${header(state)}
    </body>
  `
}
