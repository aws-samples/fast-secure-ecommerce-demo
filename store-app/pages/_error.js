
import Layout from './components/Layout';
import { getUsername } from '../lib/auth';

function Error({ statusCode, username }) {
    if (statusCode === 404) {
        return (
            <Layout username={username}>
                <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition duration-300">
                    <div className="flex items-center p-6 rounded-lg ">
     
                        <div>
                            <h2 className="font-sans text-2xl font-bold text-gray-800 mb-2"> This page does not exist, sorry !</h2>
                            <p className="font-sans text-lg text-gray-600">Are you sure this is the right link?</p>
                        </div>
                    </div>
                </div>
            </Layout>
        );
    } else return (
        <p>
            {statusCode
                ? `An error ${statusCode} occurred on server`
                : 'An error occurred on client'}
        </p>
    )
}

Error.getInitialProps = ({ res, req, err }) => {
    const username = getUsername(req);
    const statusCode = res ? res.statusCode : err ? err.statusCode : 404
    return { statusCode, username }
}

export default Error