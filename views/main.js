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
  emit('DOMTitleChange', 'Dat Shopping List')

  const key = html`<input type="text" id="discoveryKey" placeholder="key">`
  const password = html`<input type="text" id="password" placeholder="password">`
  let divStack = []

  console.log(state)

  /*
  if (window.localStorage.login.key && !state.loggedIn) {
    emit('login', { keyHex: window.localStorage.login.key, password: window.localStorage.login.password })
  } */
  divStack.push(loginView())

  return html`
    <body class=${prefix}>
      ${header(state)}
      <div class="content">
      ${divStack}
      </div>
      `

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
