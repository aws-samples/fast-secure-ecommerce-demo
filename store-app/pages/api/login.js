import { sign } from 'jsonwebtoken';
import { getProfile } from '../../lib/ddb';
import config from '../../aws-backend-config.json';

const SECRET_KEY = config.login_secret_key;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end(); 
  }

  const { username, password } = req.body;

  const profile = await getProfile(username);

  console.log(profile);

  if ((profile) && (profile.username) && (profile.password) && (profile.premium)) {

    if (profile.password === password) {
      const token = sign({ username: username, premium: profile.premium }, SECRET_KEY, { expiresIn: '5h' });
      res.status(200).json({ token });

    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } else {
    res.status(500).json({ message: 'Invalid credentials'});
  }

}
