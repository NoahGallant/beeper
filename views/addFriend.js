const html = require('choo/html')
const css = require('sheetify')
const header = require('../components/header')
const button = require('../components/button')
const customAlert = require('../components/customAlert')


module.exports = addFriendView

function addFriendView (state, emit) {
  emit('DOMTitleChange', 'Beeper - Adding Friend')

  state.viewing = 'adding'

  let key = state.params.chatKey

  return html`
    <body>
      ${header(state)}
      <div class="content flex justify-center">
        <div class='prompt pa3'>
          Ask your friend to go to the following link (once they are logged in):
          <br/><br/>
          <span>https://beeper-chat.herokuapp.com/loadLocal/${key}</span>
          <br/><br/>
          Once your friend joins you will be redirected to the chat!
        </div>
      </div>
      ${customAlert.alertBox(state, emit)}
    </body>
  `
}
