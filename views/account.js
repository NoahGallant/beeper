const html = require('choo/html')
const button = require('../components/button')

let accountInputs = []

module.exports = accountView

function accountView (state, emit) {
  if (!state.loggedIn) {
    console.log('no archive!')
    return html`<body><div>Bad request</div></body>`
  }

  if (!state.localDetails) {
    console.log('no local details, yet')
    emit('getDetails', state)
    return html`<body><div>Loading</div></body>`
  }

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

  let keyHex = state.key

  let inputs = accountInputs

  return html`
    <div class="account">
      <h2>
        Hello!
      </h2>
      <div class="key">
        ${keyHex}
      </div>
      <form onsubmit=${updateDetails}>
        ${inputs}
        ${button.submit('Update online version')}
      </form>
    </div>
  `

  function updateDetails (event) {
    console.log('local Details')
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
