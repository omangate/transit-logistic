const res = await fetch('http://127.0.0.1:3001/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'alharithlap@gmail.com',
    password: 'Test1234',
  }),
});
console.log('login status', res.status);
console.log((await res.text()).slice(0, 400));
