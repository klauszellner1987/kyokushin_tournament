async function run() {
  const apiKey = 'AIzaSyD8MV2qtzIP_QLcFoGmSZDNY3L6NjLHf1s';
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
  
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
    if (!res.ok) {
      console.error('Failed to create account:', data.error);
    } else {
      console.log('Successfully created admin account in Firebase Auth:', data.email);
    }
  } catch (err) {
    console.error('Error occurred:', err);
  }
}

run();
