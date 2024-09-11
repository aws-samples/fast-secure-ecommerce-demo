import Image from 'next/image'
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

import { getUsername } from '../lib/auth';
import { getCartItems, deleteCartItems } from '../lib/client-side-helper';
import Layout from './components/Layout';

export default function Cart({ username }) {

  const [cartItems, setCartItems] = useState(null);
  const [totalPrice, setTotalPrice] = useState(null);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const items = getCartItems();
    setCartItems(items);
    var price = 0;
    items.map((item) => (price += item.price));
    setTotalPrice(price);

  }, [router, orderPlaced]);

  async function purchase() {
    if (!username) {
      router.push('/login');
      return;
    }
    // Real world API call
    setOrderPlaced(true);
    deleteCartItems();
    setCartItems(null);
    setTimeout(() => router.push('/'), 4000);
  }

  if (!cartItems || (cartItems.length === 0)) {
    if (orderPlaced) {
      return <Layout username={username}>
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition duration-300">
          <div class="flex items-center p-6 rounded-lg ">
            <Image src="images/full-cart.jpeg" className="w-36 h-36 mr-6" width={200} height={200} />
            <div>
              <h2 class="font-sans text-2xl font-bold text-gray-800 mb-2">{username}, thanks for your order :)</h2>
              <p class="font-sans text-lg text-gray-600">Your shipment is on the way!</p>
            </div>
          </div>
        </div>
      </Layout>;
    } else {
      return <Layout username={username}>
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition duration-300">
          <div className="flex items-center p-6 rounded-lg ">
            <Image src="images/empty-cart.jpeg" className="w-36 h-36 mr-6" width={200} height={200} />
            <div>
              <h2 className="font-sans text-2xl font-bold text-gray-800 mb-2">{(username) ? username + ', your' : 'Your'} cart is empty :(</h2>
              <p className="font-sans text-lg text-gray-600">Please add some stuff to it!</p>
            </div>
          </div>
        </div>
      </Layout>;
    }
  }

  return (
    <Layout username={username}>
      { /*<h1 className="text-3xl font-bold mb-6">Products</h1>*/}
      <div className="grid grid-cols-1 gap-2">
        {cartItems.map((product) => (
          <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition duration-300">
            <div className="p-4 flex flex-row justify-between">
              <Image src={product.image} alt={product.name} className="object-cover" width={64} height={64} />
              <h2 className="text-xl font-semibold mb-2">{product.name}</h2>
              <span className="text-green-600 font-bold">${product.price}</span>
            </div>
          </div>
        ))}
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition duration-300">
          <div className="p-4 flex flex-row justify-between">
            <h2 className="text-xl font-semibold mb-2">Total</h2>
            <span className="text-green-600 font-bold">${totalPrice}</span>
          </div>
          <button className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition duration-300" onClick={() => { purchase() }}>
            Order now
          </button>
        </div>
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