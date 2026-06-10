async function checkEmailExists() {
  const apiKey = 'AIzaSyD8MV2qtzIP_QLcFoGmSZDNY3L6NjLHf1s';
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'klauszellner1987@gmail.com',
        password: 'dummy_password123',
        returnSecureToken: true,
      }),
    });

    const data = await res.json();
    console.log(data);
  } catch (err) {
    console.error('Error:', err);
  }
}

checkEmailExists();
