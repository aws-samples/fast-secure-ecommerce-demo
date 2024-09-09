import '../styles/globals.css'
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { AwsRum } from 'aws-rum-web';
import config from '../aws-backend-config.json';

try {
  const rumConfig = {
    sessionSampleRate: 1,
    identityPoolId: config.rumMonitorIdentityPoolId,
    endpoint: `https://dataplane.rum.${config.aws_region}.amazonaws.com`,
    telemetries: ["errors","performance","http"],
    allowCookies: true,
    enableXRay: false
  };

  const APPLICATION_ID = config.rumMonitorId;
  const APPLICATION_VERSION = '1.0.0';
  const APPLICATION_REGION = config.aws_region;

  const awsRum = new AwsRum(
    APPLICATION_ID,
    APPLICATION_VERSION,
    APPLICATION_REGION,
    rumConfig
  );
} catch (error) {
  // Ignore errors thrown during CloudWatch RUM web client initialization
}

function MyApp({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    // Check authentication status on route change
    const handleRouteChange = () => {
      // You can add logic here to redirect unauthenticated users
      // from protected routes if needed
      // TODO
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router]);

  return <Component {...pageProps} />;
}

export default MyApp;
