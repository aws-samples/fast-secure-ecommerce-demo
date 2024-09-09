import Link from 'next/link';
import Image from 'next/image';
import Script from 'next/script';

import Layout from './components/Layout';
import { getProducts } from '../lib/ddb';
import { getUsername } from '../lib/auth';

export default function Home({ products, username }) {
  return (
    <Layout username={username}>
      <Script type="speculationrules" id="speculationAPI" dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "prerender": [
            {
              "source": "document",
              "where": { "href_matches": "/product/*" },
              "eagerness": "moderate"
            }
          ]
        })
      }}>
      </Script>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products ?
          products.length != 0 ?
            products.map((product) => (
              <Link href={`/product/${product.id}`} key={product.id}>
                <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition duration-300">
                  <Image src={product.image} alt={product.name} className="w-full h-60 object-cover" width={200} height={200} loading="lazy" />
                  <div className="p-4">
                    <h2 className="text-xl font-semibold mb-2">{product.name}</h2>
                    <p className="text-gray-600 mb-4">{product.description.substring(0, 60)}...</p>
                    <span className="text-green-600 font-bold">${product.price}</span>
                  </div>
                </div>
              </Link>
            ))
            :
            <div className="text-red-500">Sorry I could not find any products!</div>
          :
          <div className="text-red-500">Sorry I could not load the products, try again!</div>
        }
      </div>
    </Layout>
  );
}

export async function getServerSideProps({ req }) {
  const products = await getProducts();
  const username = getUsername(req);

  return {
    props: {
      products, username
    },
  };

}
