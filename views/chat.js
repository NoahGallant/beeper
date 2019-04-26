const html = require('choo/html')
const button = require('../components/button')
const loadingView = require('./loading')
const badRequestView = require('./badRequest')

module.exports = chatListView

function chatListView (state, emit) {
  console.log('renderCalled')
  if (!state.loggedIn || !state.chat) {
    return badRequestView()
  }

  let key = state.chat.key
  let title = state.chat.settings.title

  const addKeyInput = html`<input type="text" id="friendKey" placeholder="key">`
  const messageInput = html`<input type="text" id="message" placeholder="Message">`

  let messageDivs = []

  if (!state.chat.data) {
    emit('readChat', state)
  } else {
    for (var i in state.chat.data.messages) {
      let message = state.chat.data.messages[i]
      let value = message.message
      let id = message.timeId
      let senderName = ''
      if (!message.senderKey) {
        senderName = 'Bot'
      } else if (message.senderKey === state.key) {
        senderName = 'Me'
      } else {
        let senderKey = message.senderKey
        if (!state.friends) { state.friends = [] }
        let inList = false
        let friend = {}
        for (var j in state.friends) {
          friend = state.friends[j]
          if (friend.key === senderKey) {
            inList = true
            break
          }
        }
        if (!inList) {
          senderName = senderKey
          emit('loadFriend', { keyHex: senderKey, toChat: false })
        } else {
          let sender = state.friends[senderKey]
          senderName = sender.info.name
        }
      }
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
      <form onsubmit=${sendMessage}>
        ${messageInput}
      </form>
      
    </div>
  `
  function sendMessage (event) {
    const message = event.target.querySelector('#message').value
    if (message) {
      state.loading = true
      emit('sendMessage', message)
    }
    event.preventDefault()
  }

  function addKey (event) {
    const key = event.target.querySelector('#friendKey').value
    if (key) {
      const submitButton = event.target.querySelector('input[type="submit"]')
      submitButton.setAttribute('disabled', 'disabled')
      state.loading = true
      emit('loadFriend', { keyHex: key, toChat: true })
    }
    event.preventDefault()
  }
}
