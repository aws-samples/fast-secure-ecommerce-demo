import Layout from './components/Layout';
import { getUsername } from '../lib/auth';

export default function Sales({ username }) {
    return (
        <Layout username={username}>
            <div className="container mx-auto p-4 bg-gray-100 min-h-screen">
                <main className="flex flex-col items-center space-y-6">
                    <h1 className="text-3xl font-bold text-green-600">50% discount this week</h1>
                    <h3 className="text-l text-green-600">Use GOGREEN discount code!</h3>
                    <div className="rounded-lg overflow-hidden shadow-lg">
                        <video
                            autoPlay
                            loop
                            playsInline
                            muted
                            controls
                            className="max-w-full"
                        >
                            <source src="sales.mp4" type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                    </div>
                </main>
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