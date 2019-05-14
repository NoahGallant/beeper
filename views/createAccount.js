const html = require('choo/html')

module.exports = createAccountForm

function createAccountForm (state, emit) {
  const input = html`<input type="password" placeholder="password" id='password' autofocus>`
  input.isSameNode = function (target) {
    return (target && target.nodeName && target.nodeName === 'INPUT')
  }

  return html`
    <div class='createAccount'>
      <form class='flex' onsubmit=${submit}>
          ${input}
          <input type='submit' value='Create Account' class='button'>
      </form>
    </div>
  `

  function submit (event) {
    const password = event.target.querySelector('#password').value
    if (password) {
      emit('createAccount', password)
    }
    event.preventDefault()
  }
}
