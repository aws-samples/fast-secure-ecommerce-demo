
import Layout from './components/Layout';
import { getUsername } from '../lib/auth';

export default function Waitroom({ username }) {
    return (
        <Layout username={username}>
            <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition duration-300">
                <div className="flex items-center p-6 rounded-lg ">
                    <div>
                        <h2 className="font-sans text-2xl font-bold text-gray-800 mb-2"> Welcome to the waiting room!</h2>
                        <p className="font-sans text-lg text-gray-600">Please try again in 5 mins</p>
                    </div>
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