const html = require('choo/html')
const header = require('../components/header')

module.exports = addFriendView

function addFriendView (state, emit) {
  emit('DOMTitleChange', 'Beeper - Adding Friend')

  state.viewing = 'add'

  return html`
    <body>
      ${header(state)}
    </body>
  `
}
