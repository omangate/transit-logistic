const res = await fetch('http://127.0.0.1:3001/api/v1/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'alharithlap@gmail.com',
    password: 'Test1234',
    role: 'customer',
    fullName: 'Alharith',
    locale: 'ar',
  }),
});
console.log('status', res.status);
console.log(await res.text());
