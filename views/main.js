const html = require('choo/html')
const css = require('sheetify')
const header = require('../components/header')
const button = require('../components/button')
const createAccountForm = require('./createAccount')

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
  emit('DOMTitleChange', 'Beeper - Home')

  const password = html`<input type="text" id="password" placeholder="password">`
  password.isSameNode = function (target) {
    return (target && target.nodeName && target.nodeName === 'INPUT')
  }

  let divStack = []

  let setKey = window.localStorage.getItem('account-key')
  if (setKey) {
    divStack.push(loginView(setKey))
  }

  console.log(state)

  /*
  if (window.localStorage.login.key && !state.loggedIn) {
    emit('login', { keyHex: window.localStorage.login.key, password: window.localStorage.login.password })
  } */
  divStack.push(createAccountForm(state, emit))

  return html`
    <body class=${prefix}>
      ${header(state)}
      <div class="content">
        ${divStack}
      </div>
    </body>
    `

  function loginView (setKey) {
    return html`
      <div class="login">
        <h2>
          Enter credentials to log in to: ${setKey}
        </h2>
        <form onsubmit=${login}>
          ${password}
          <p>
            ${button.submit('Login')}
          </p>
        </form>
      </div>
    `
  }

  function login (event) {
    const password = event.target.querySelector('#password').value
    const accountKey = window.localStorage.getItem('account-key')
    if (password && accountKey) {
      window.localStorage.setItem('password', password) // this needs to be changed lol
      emit('pushState', '/account/' + accountKey)
      emit('render')
    }
    event.preventDefault()
  }
}
