import Layout from './components/Layout';
import { getUsername } from '../lib/auth';
import { getProfile } from '../lib/ddb';

export default function Profile({ profile }) {

  return (
    <Layout username={profile.username}>
      <div className="max-w-md mx-auto bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <h1 className="text-2xl font-bold mb-6 text-center">User Profile</h1>
        <div>
          <p className="mb-4"><strong>Name:</strong> {profile.username}</p>
          <p className="mb-4"><strong>Phone:</strong> {profile.phone}</p>
          <p className="mb-4"><strong>Address:</strong> {profile.address}</p>
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps({ req }) {
  const username = getUsername(req);
  if (username) {
    const profile = await getProfile(username);
    return {
      props: {
        profile
      },
    };
  }
  return {
    redirect: {
      destination: '/login',
      permanent: false,
    }
  }
}
