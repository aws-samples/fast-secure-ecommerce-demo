
import Image from 'next/image'
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

import Layout from './../components/Layout';
import { getProduct, getComments } from '../../lib/ddb';
import { getUsername } from '../../lib/auth';
import { addCartItem } from '../../lib/client-side-helper';

export default function Product({ product, comments, username }) {
  const router = useRouter();

  if (!product) {
    return (<Layout username={username}><div className="text-red-500">Sorry I could not load the product, try again!</div></Layout>)
  }

  const [isLoggedin, setIsLoggedin] = useState(username ? true : false);
  const [cartAction, setCartAction] = useState(0);
  const [formComment, setFormComment] = useState({
    text: '',
    productid: product.id,
    username: username,
  });

  useEffect(() => {

  }, [router, cartAction]);


  function addItemToCart(product) {
    addCartItem(product);
    setCartAction(cartAction + 1); // render again
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    function setError(err) {
      document.getElementById("error").innerHTML = err;
    }

    try {
      const response = await fetch('/api/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formComment),
      });


      if (response.ok) {
        document.getElementById("submit").innerHTML = "Comment submmitted, thank you!";
        // router.reload(); TODO instead load comments on client side
      } else {
        // Registration failed
        if ((response.status === 405) || (response.status === 202)) {
          // reload the page to display the captcha or challenge
          router.reload()
        } else if (response.status === 403) {
          setError('comment was not authorized and blocked');
        } else {
          const data = await response.json();
          setError(data.message || 'posting comment failed');
        }

      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.log('error adding comment:', err);
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormComment(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  return (
    <Layout username={username}>
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
          <Image src={product.image} alt={product.name} className="w-full h-full object-cover" width={640} height={640} />
          <p className="text-gray-600 mb-4">{product.description}</p>
          <p className="text-2xl font-bold text-green-600 mb-4">${product.price}</p>
          <button className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition duration-300" onClick={() => { addItemToCart(product) }}>
            Add to Cart
          </button>
        </div>
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-4">Comments</h1>
          {comments.map((comment) => (
            <div className="bg-grey rounded-lg shadow-md overflow-hidden hover:shadow-lg transition duration-300 gap-6">
              <div className="p-4">
                <h2 className="text-xl font-semibold mb-2">{comment.username}</h2>
                <p className="text-gray-600 mb-4">{comment.text}</p>
              </div>
            </div>
          ))}
          {isLoggedin ?
            (
              <div id='submit' className="p-6">
                <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
                  <h1 className="text-2xl font-bold mb-6 text-center">Add comment</h1>
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="comment">
                      Comment
                    </label>
                    <textarea
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      id="text"
                      name="text"
                      value={formComment.text}
                      onChange={handleChange}
                      required
                    ></textarea>
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                      type="submit"
                    >
                      Submit
                    </button>
                  </div>

                </form>
                <div id='error' className="flex items-center justify-between text-red-500" />
              </div>
            ) : (
              <p className="text-gray-600 mb-4"><br></br>Login to add comments</p>
            )}
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps({ params, req }) {
  const username = getUsername(req);

  let product, comments;
  [product, comments] = await Promise.all([getProduct(params.id), getComments(params.id)])

  return {
    props: {
      product, comments, username
    },
  };
}
