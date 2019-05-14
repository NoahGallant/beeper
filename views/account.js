const html = require('choo/html')
const button = require('../components/button')
const header = require('../components/header')

let accountInputs = []

module.exports = accountView

function accountView (state, emit) {
  emit('DOMTitleChange', 'Beeper - Account')

  const createChatInput = html`<input type="text" id="chatName" placeholder="Chat Name">`
  const loadChatInput = html`<input type="text" id="chatKey" placeholder="Chat Key">`
  createChatInput.isSameNode = function (target) {
    return (target && target.nodeName && target.nodeName === 'INPUT')
  }
  loadChatInput.isSameNode = function (target) {
    return (target && target.nodeName && target.nodeName === 'INPUT')
  }

  state.viewing = 'account'

  let localDetails = state.localDetails

  console.log(localDetails)

  accountInputs = []
  let inputs = []

  for (var key in localDetails) {
    if (key !== 'key32') {
      let value = String(localDetails[key])
      let input = html`<input type="text" id="${key}" placeholder="${key}" value="${value}">`
      input.isSameNode = function (target) {
        return (target && target.nodeName && target.nodeName === 'INPUT')
      }
      let inputDiv = html`
      <div class="measure pa1 pt2">
        <label for="${key}" class="f6 db mb2">${key}</label>
        ${input}
      </div>  
      `
      inputs.push(input)
      accountInputs.push(inputDiv)
    }
  }

  let inputDivs = accountInputs

  let chatLinks = []
  if (!state.chats) {
    emit('loadChats')
  } else {
    for (var j in state.chats) {
      let chatKey = state.chats[j]
      let abbr = chatKey.slice(0, 8) + '...'
      chatLinks.push(html`<button id='${chatKey}' class='chat-link pa3 ma2' onclick='${loadExistingChat}'>${abbr}</button><br/>`)
    }
  }

  if (state.account) {
    let keyHex = state.params.key
    emit('setDetailsLocalStorage')

    return html`
      <body>
        ${header(state)}
        <div class='content'>
          <div class="account pb2 mb5">
            <div class="key flex items-stretch">
              <div class="tag flex items-center justify-left">
                <span>Account key</span>: ${keyHex}
              </div>
              <button onclick=${logout} class='logout'>Logout</button>
            </div>
            <form class="form pa3" onsubmit=${updateDetails}>
              <div class="inputs flex justify-between flex-wrap">
                ${inputDivs}
              </div>
              <input type='submit' class='button' value='Update your details'/>
            </form>
          </div>
          ${chatFormView()}
          <br/>
          <div class='chatLinks flex flex-wrap'>
            ${chatLinks}
          </div>
        </div>
      </body>
    `
  } else {
    return html`
    <body>
      
    </body>`
  }

  function chatFormView () {
    return html`<div class='createChat'>
                  <form onsubmit=${createChat} class='flex w-100'>
                    ${createChatInput}
                    <input type='submit' class='button' value='Create New Chat'/>
                  </form>
                  </div>
                `
  }

  function logout () {
    emit('logout')
  }

  function createChat (event) {
    const chatName = event.target.querySelector('#chatName').value
    if (chatName) {
      const submitButton = event.target.querySelector('input[type="submit"]')
      submitButton.setAttribute('disabled', 'disabled')
      state.loading = true
      emit('createChat', { chatName })
    }
    event.preventDefault()
  }

  function loadExistingChat (event) {
    const chatKey = event.target.id
    if (chatKey) {
      state.loading = true

      emit('setDetailsLocalStorage')
      emit('pushState', `/chat/${chatKey}`)
    }
    event.preventDefault()
  }

  function loadChat (event) {
    const chatKey = event.target.querySelector('#chatKey').value
    if (chatKey) {
      state.loading = true

      emit('pushState', `/loadLocal/${chatKey}`)
    }
    event.preventDefault()
  }

  function updateDetails (event) {
    for (var key in inputs) {
      let input = inputs[key]
      let selector = '#' + input.id
      let value = String(event.target.querySelector(selector).value)
      state.localDetails[input.id] = value // event.target.querySelector('#' + key).value
    }
    emit('updateDetails', state)
    event.preventDefault()
  }
}
