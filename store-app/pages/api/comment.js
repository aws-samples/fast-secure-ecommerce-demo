import { addComment } from '../../lib/ddb';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { username, text, productid } = req.body;
    if (!username || !text || !productid) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (addComment(username, text, productid, Date.now())) {
      res.status(200).json({ message: 'comment added successfully' });
    } else {
      res.status(500).json({ message: 'comment couldn\'t be added' });
    }

  } return res.status(400).json({ message: 'Bad request' });

}
