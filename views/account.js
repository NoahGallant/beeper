const html = require('choo/html')
const button = require('../components/button')

let accountInputs = []

module.exports = accountView

function accountView (state, emit) {
  const createChatInput = html`<input type="text" id="chatName" placeholder="Chat Name">`
  const loadChatInput = html`<input type="text" id="chatKey" placeholder="Chat Key">`
  
  state.viewing = 'account'

  let localDetails = state.localDetails

  console.log(localDetails)

  accountInputs = []

  for (var key in localDetails) {
    if (key !== 'key32') {
      let value = String(localDetails[key])
      let input = html`<input type="text" id="${key}" placeholder="${key}" value="${value}" autofocus>`
      accountInputs.push(input)
    }
  }

  let inputs = accountInputs

  if (state.account) {
    let keyHex = state.params.key

    return html`
      <body>
        <h2>
          Beeper
        </h2>
        <div class="key">
          Your account key: ${keyHex}
        </div>
        <form onsubmit=${updateDetails}>
          ${inputs}
          ${button.submit('Update your details!')}
        </form>
        ${chatFormView()}
      </body>
    `
  } else {
    return html`
    <body>
      Loading account...
    </body>`
  }
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
                  </div>
                `
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

  function loadChat (event) {
    const chatKey = event.target.querySelector('#chatKey').value
    if (chatKey) {
      const submitButton = event.target.querySelector('input[type="submit"]')
      submitButton.setAttribute('disabled', 'disabled')
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
