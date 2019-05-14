const html = require('choo/html')
const header = require('../components/header')
const createAccountForm = require('./createAccount')

module.exports = mainView

function mainView (state, emit) {
  emit('DOMTitleChange', 'Beeper - Home')

  const password = html`<input type="password" id="password" placeholder="password">`
  password.isSameNode = function (target) {
    return (target && target.nodeName && target.nodeName === 'INPUT')
  }

  let divStack = []

  let setKey = window.localStorage.getItem('account-key')
  if (setKey) {
    divStack.push(loginView(setKey))
  }
  if (setKey && window.localStorage.getItem('account-dKey')) {
    emit('pushState', '/account/' + setKey)
    emit('render')
  }

  divStack.push(createAccountForm(state, emit))

  return html`
    <body>
      ${header(state)}
      <div class="content">
        ${divStack}
      </div>
    </body>
    `

  function loginView (setKey) {
    return html`
      <div class="login">
        <div class='tag'>
          <span>Account:</span> ${setKey}
        </div>
        <form onsubmit=${login} class='flex'>
          ${password}
          <button class='button'>Login</button>
        </form>
      </div>
    `
  }

  function login (event) {
    const password = event.target.querySelector('#password').value
    const accountKey = window.localStorage.getItem('account-key')
    if (password && accountKey) {
      window.localStorage.setItem('password', password) // this needs to be changed
      emit('pushState', '/account/' + accountKey)
      emit('render')
    }
    event.preventDefault()
  }
}
