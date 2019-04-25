const html = require('choo/html')
const button = require('../components/button')
const loadingView = require('./loading')
const badRequestView = require('./badRequest')

module.exports = chatListView

function chatListView (state, emit) {
  if (!state.loggedIn || !state.chat) {
    return badRequestView()
  }

  let key = state.chat.key
  let title = state.chat.settings.title

  const addKeyInput = html`<input type="text" id="friendKey" placeholder="key">`

  let messageDivs = []

  if (!state.chat.data) {
    emit('readChat', state)
  } else {
    for (var i in state.chat.data.messages) {
      let message = state.chat.data.messages[i]
      let value = message.message
      let id = message.timeId
      let senderKey = message.senderKey
      let sender = state.friends[senderKey]
      let senderName = sender.name
      let messageDiv = html`<div id="message-${id}">${senderName}: ${value}</div>`
      messageDivs.push(messageDiv)
    }
  }

  return html`
    <div class="chat">
      <h2>
        ${title}
      </h2>
      Key: ${key}
      <br/>
      <form onsubmit=${addKey}>
        ${addKeyInput}
        <br/>
        <p>
            ${button.submit('Add key to chat')}
        </p>
      </form>
      <br/>
      <div>
        ${messageDivs}
      </div>
      
    </div>
  `

  function addKey (event) {
    const key = event.target.querySelector('#friendKey').value
    if (key) {
      const submitButton = event.target.querySelector('input[type="submit"]')
      submitButton.setAttribute('disabled', 'disabled')
      state.loading = true
      console.log('loading friend...')
      emit('loadFriendToChat', key)
    }
    event.preventDefault()
  }
}
