const html = require('choo/html')
const button = require('../components/button')

module.exports = chatListView

function chatListView (state, emit) {
  emit('DOMTitleChange', 'Beeper - Chat')
  state.viewing = 'chat'

  let key = state.params.key

  const addKeyInput = html`<input type="text" id="friendKey" placeholder="key">`
  addKeyInput.isSameNode = function (target) {
    return (target && target.nodeName && target.nodeName === 'INPUT')
  }

  const messageInput = html`<input type="text" id="message" placeholder="Message">`
  messageInput.isSameNode = function (target) {
    return (target && target.nodeName && target.nodeName === 'INPUT')
  }

  let messageDivs = []

  let accountKey = window.localStorage.getItem('account-key')
  if (!accountKey) {
    emit('pushState', '/')
    emit('render')
    return html`
    <div>
      Unauthorized
    </div>
    `
  }

  let accountButton = html`<button id='${accountKey}' onclick='${loadAccount}'>Account</button>`

  if (!state.chat || !state.chat.data) {
    console.log('no data yet...')
    if (state.chat && !state.chat.data) {
      emit('update')
    }
  } else {
    state.chat.data.messages = state.chat.data.messages.sort((a, b) => {
      if (a.timeId > b.timeId) { return 1 }
      return -1
    })
    console.log('reading messages')
    for (var i in state.chat.data.messages) {
      let message = state.chat.data.messages[i]
      let value = message.message
      let id = message.timeId
      console.log(message + ': ' + id)
      let myKey = window.localStorage.getItem('account-key')
      let senderName = ''
      if (!message.senderKey) {
        senderName = 'Bot'
      } else if (message.senderKey === myKey) {
        senderName = 'Me'
      } else {
        let senderKey = message.senderKey
        if (!state.friends) {
          state.friends = []
          emit('loadFriends')
        }
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
          senderName = senderKey.slice(0, 5) + '...'
          // emit('loadFriend', { keyHex: senderKey, toChat: false })
        } else {
          senderName = friend.accountInfo.name
        }
      }
      let messageDiv = html`<div id="message-${id}">${senderName}: ${value}</div>`
      messageDivs.push(messageDiv)
    }
  }
  if (!state.authorized) {
    return html`
    <body>
      Not authorized yet...
    </body>
    `
  } else {
    return html`
    <body>
      ${accountButton}
      <br/>
      Chat Key: ${key}
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
      
    </body>
  `
  }

  function loadAccount (event) {
    const accountKey = event.target.id
    if (accountKey) {
      state.loading = true

      emit('setDetailsLocalStorage')
      emit('pushState', `/account/${accountKey}`)
    }
    event.preventDefault()
  }

  function sendMessage (event) {
    const message = event.target.querySelector('#message').value
    if (message) {
      event.target.querySelector('#message').value = ''
      state.loading = true
      emit('sendMessage', message)
    }
    event.preventDefault()
  }

  function addKey (event) {
    const key = event.target.querySelector('#friendKey').value
    let keyHex = state.params.key
    if (key) {
      const submitButton = event.target.querySelector('input[type="submit"]')
      submitButton.setAttribute('disabled', 'disabled')
      state.loading = true
      emit('pushState', `/addFriendToChat/${key}/${keyHex}`)
    }
    event.preventDefault()
  }
}
