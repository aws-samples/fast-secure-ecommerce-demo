import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/router';

import { getUsername } from '../lib/auth';
import { login } from '../lib/client-side-helper';
import Layout from './components/Layout';

export default function Login({ username }) {
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();

    function setError(err) {
      document.getElementById("error").innerHTML = err;
    }

    // Basic form validation
    if (!formUsername || !formPassword) {
      setError('Please enter both username and password');
      return;
    }

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formUsername, password: formPassword }),
      });

      if (response.ok) {
        // Login successful
        const data = await response.json();
        login(data.token)
        router.push('/'); // Redirect to home page
      } else {
        // Login failed
        if ((response.status === 405) || (response.status === 202)) {
          // reload the page to display the captcha or challenge
          router.reload()
        } else if (response.status === 403) {
          setError('Login was not authorized and blocked');
        } else {
          const data = await response.json();
          setError(data.message || 'Login failed');
        }

      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.log('Login error:', err);
    }
  };

  return (
    <Layout username={username}>
      <div className="max-w-md mx-auto">
        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
          <h1 className="text-2xl font-bold mb-6 text-center">Login</h1>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="username">
              Username
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="username"
              type="text"
              value={formUsername}
              onChange={(e) => setFormUsername(e.target.value)}
              placeholder="Username"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
              Password
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
              id="password"
              type="password"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              placeholder="******************"
              required
            />
          </div>
          <div className="flex items-center justify-between">
            <button
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              type="submit"
            >
              Sign In
            </button>
          </div>
          <div className="flex items-center justify-between">
            <Link href={`/register`} className="py-2 px-2 font-small text-blue-500">Sign up here, if you do not have an account</Link>
          </div>

        </form>
        <div id='error' className="flex items-center justify-between text-red-500" />
      </div>
    </Layout>
  );
}

export async function getServerSideProps({ req }) {
  const username = getUsername(req);
  return {
    props: {
      username
    },
  };
}