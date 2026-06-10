const fetch = require('node-fetch');

async function login() {
  const apiKey = 'AIzaSyD8MV2qtzIP_QLcFoGmSZDNY3L6NjLHf1s';
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'sarah.marklowski@web.de',
        password: 'pia1979.',
        returnSecureToken: true,
      }),
    });

    const data = await res.json();
    console.log(data);
  } catch (err) {
    console.error('Error:', err);
  }
}

login();
