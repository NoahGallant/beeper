const html = require('choo/html')
const button = require('../components/button')
const header = require('../components/header')

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

  let accountButton = html`<button id='${accountKey}' class='account-button pa2' onclick='${loadAccount}'>Back to Account</button>`

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
      let prefix = ''
      let message = state.chat.data.messages[i]
      let value = message.message
      let id = message.timeId
      console.log(message + ': ' + id)
      let myKey = window.localStorage.getItem('account-key')
      let senderName = ''
      if (!message.senderKey) {
        senderName = 'Bot'
        prefix = 'bot'
      } else if (message.senderKey === myKey) {
        senderName = 'Me'
        prefix = 'me'
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
      let messageDiv = html`
        <div class='message pa3 mb3 ${prefix}' id="message-${id}">
          <span>${senderName}</span><br/>
          ${value}
        </div>`
      messageDivs.push(messageDiv)
    }
  }
  if (!state.authorized) {
    return html`
    <body>

    </body>
    `
  } else {
    return html`
    <body>
      ${header(state)}
      <div class='content'>
        <div class='flex w-100 items-center justify-between mb3'>
          ${accountButton}
          <form class='flex addKeyForm items-center items-stretch' onsubmit=${addKey}>
            ${addKeyInput}
            <input type='submit' class='add-account-button' value='Add account to chat'/>
          </form>
        </div>
        <div class='chat'>
          <div class='tag flex items-center justify-left'>
              <span>Chat Key:</span> ${key}
          </div>
          <div class='messages pa3 pb0 flex flex-column'>
            ${messageDivs}
          </div>
          <form class='flex' onsubmit=${sendMessage}>
            ${messageInput}
          </form>
        </div>
      </div>
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
      state.loading = true
      emit('pushState', `/addFriendToChat/${key}/${keyHex}`)
    }
    event.preventDefault()
  }
}
