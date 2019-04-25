const html = require('choo/html')
const css = require('sheetify')
const header = require('../components/header')
const button = require('../components/button')

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

module.exports = loginView

function loginView (state, emit) {
  emit('DOMTitleChange', 'PBA Account Demo - Create Account')
  const key = html`<input type="text" id="discoveryKey" placeholder="key" autofocus>`
  const password = html`<input type="text" id="password" placeholder="password" autofocus>`

  if (state.loggedIn) {
    console.log(state.contents)
  }

  return html`
    <body class=${prefix}>
      ${header(state)}
      <div class="content">
        <h2>
          Enter credentials to login!
        </h2>
        <form onsubmit=${submit}>
          ${key}
          <br/>
          ${password}
          <p>
            ${button.submit('Submit')}
          </p>
        </form>
      </div>
    </body>
  `

  function submit (event) {
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
