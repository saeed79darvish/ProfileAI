const { User } = require('../models');
const bcrypt = require('bcryptjs');

(async () => {
  const u = await User.findOne({ where: { email: 's79darvish@gmail.com' } });
  console.log('User found:', !!u);
  console.log('Role:', u.role);
  console.log('Password hash exists:', !!u.password);
  if (u.password) {
    const match = await bcrypt.compare('Saeed@1234', u.password);
    console.log('Password match:', match);
  } else {
    console.log('No password set (likely OAuth login)');
  }
  process.exit(0);
})().catch(err => { console.error(err.message); process.exit(1); });
