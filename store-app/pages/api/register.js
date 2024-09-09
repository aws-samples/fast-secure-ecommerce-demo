import { registerUser } from '../../lib/ddb';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end(); // Method Not Allowed
  }

  const { username, password, phone, address, premium } = req.body;

  // Basic validation
  if (!username || !password || !phone || !address || !premium) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  if (registerUser(username, password, phone, address, premium)) {
    res.status(200).json({ message: 'User registered successfully' });
  } else {
    res.status(500).json({ message: 'User registeration failed' });
  }
}
  
