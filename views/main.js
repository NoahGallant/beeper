const html = require('choo/html')
const css = require('sheetify')
const header = require('../components/header')
const button = require('../components/button')
const accountView = require('./account')
const createAccountForm = require('./createAccount')
const chatView = require('./chat')
const loadingView = require('./loading')

const prefix = css`
  :host {
    .content {
      margin: 1em;
    }
    input[type="text"] {
      width: 100%;
      font-size: 1.5rem;
    }
  }
`

module.exports = mainView

function mainView (state, emit) {
  const key = html`<input type="text" id="discoveryKey" placeholder="key">`
  const password = html`<input type="text" id="password" placeholder="password">`
  const createChatInput = html`<input type="text" id="chatName" placeholder="Chat Name">`
  const loadChatInput = html`<input type="text" id="chatKey" placeholder="Chat Key">`
  let divStack = []

  /*
  if (window.localStorage.login.key && !state.loggedIn) {
    emit('login', { keyHex: window.localStorage.login.key, password: window.localStorage.login.password })
  } */

  if (state.loggedIn) { // load application
    divStack.push(accountView(state, emit))
    if (state.chat) {
      divStack.push(chatView(state, emit))
    } else {
      divStack.push(chatFormView())
    }
  } else {
    divStack.push(loginView())
  }

  return html`
    <body class=${prefix}>
      ${header(state)}
      <div class="content">
      ${divStack}
      </div>
      `

  function chatFormView () {
    return html`<div>
                  <form onsubmit=${createChat}>
                    ${createChatInput}
                    <br/>
                    <p>
                      ${button.submit('Create new p2p chat')}
                    </p>
                  </form>
                  <form onsubmit=${loadChat}>
                    ${loadChatInput}
                    <br/>
                    <p>
                      ${button.submit('Load p2p chat from key')}
                    </p>
                  </form>
                `
  }

  function createChat (event) {
    console.log('chat button hit')
    const chatName = event.target.querySelector('#chatName').value
    if (chatName) {
      const submitButton = event.target.querySelector('input[type="submit"]')
      submitButton.setAttribute('disabled', 'disabled')
      state.loading = true
      emit('createChat', { chatName })
    }
    event.preventDefault()
  }

  function loadChat (event) {
    const chatKey = event.target.querySelector('#chatKey').value
    if (chatKey) {
      const submitButton = event.target.querySelector('input[type="submit"]')
      submitButton.setAttribute('disabled', 'disabled')
      state.loading = true
      emit('loadChat', { chatKey })
    }
    event.preventDefault()
  }

  function loginView () {
    return html`
      <div class="login">
        <h2>
          Enter credentials to login!
        </h2>
        <form onsubmit=${login}>
          ${key}
          <br/>
          ${password}
          <p>
            ${button.submit('Login')}
          </p>
        </form>
        <br/>
        <hr/>
        <br/>
        <h2>
          Or create an account by entering a password:
        </h2>
        ${createAccountForm(state, emit)}
      </div>
    `
  }

  function login (event) {
    const password = event.target.querySelector('#password').value
    const discoveryKey = event.target.querySelector('#discoveryKey').value
    if (password && discoveryKey) {
      const textInput = event.target.querySelector('input[type="text"]')
      textInput.setAttribute('disabled', 'disabled')
      const submitButton = event.target.querySelector('input[type="submit"]')
      submitButton.setAttribute('disabled', 'disabled')
      emit('login', { keyHex: discoveryKey, password })
    }
    event.preventDefault()
  }
}
