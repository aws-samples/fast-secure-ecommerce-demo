import { useState } from 'react';
import { useRouter } from 'next/router';

import Layout from './components/Layout';
import { getUsername } from '../lib/auth';

export default function Register({ username }) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    phone: '',
    address: '',
    premium: 'no'
  });

  const router = useRouter();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    function setError(err) {
      document.getElementById("error").innerHTML = err;
    }

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });


      if (response.ok) {
        router.push('/login'); // Redirect to profile page
      } else {
        // Registration failed
        if ((response.status === 405) || (response.status === 202)) {
          // reload the page to display the captcha or challenge
          router.reload()
        } else if (response.status === 403) {
          setError('Registration was not authorized and blocked');
        } else {
          const data = await response.json();
          setError(data.message || 'Login failed');
        }

      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.log('Registration error:', err);
    }
  };

  return (
    <Layout username={username}>
      <div className="max-w-md mx-auto">
        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
          <h1 className="text-2xl font-bold mb-6 text-center">Register</h1>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="username">
              Username
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="username"
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
              Password
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
              id="password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="phone">
              Phone
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="phone"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="address">
              Address
            </label>
            <textarea
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
            ></textarea>
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="phone">
              Premium subscription
            </label>
            <select
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="premium"
              name="premium"
              value={formData.premium}
              onChange={handleChange}
              required
            >
              <option value="yes">yes</option>
              <option value="no">no</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <button
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              type="submit"
            >
              Register
            </button>
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