const html = require('choo/html')
const button = require('../components/button')

module.exports = createAccountForm

function createAccountForm (state, emit) {
  const input = html`<input type="text" placeholder="password" autofocus>`
  input.isSameNode = function (target) {
    return (target && target.nodeName && target.nodeName === 'INPUT')
  }

  return html`
    <form onsubmit=${submit}>
        ${input}
        <p>
        ${button.submit('Submit')}
        </p>
    </form>
  `

  function submit (event) {
    const password = event.target.querySelector('input').value
    if (password) {
      const textInput = event.target.querySelector('input[type="text"]')
      textInput.setAttribute('disabled', 'disabled')
      const submitButton = event.target.querySelector('input[type="submit"]')
      submitButton.setAttribute('disabled', 'disabled')
      emit('createAccount', password)
    }
    event.preventDefault()
  }
}
