/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: false,
  images: {
    loader: 'custom',
    loaderFile: './ImageCustomLoader.js',
    deviceSizes: [320, 640, 1080],
  },
  async headers() {
    return [
      {
        source: '/sales.mp4',
        headers: [
          {
            key: 'cache-control',
            value: 'max-age=172800,stale-while-revalidate=60', // two days
          },
        ],
      },
      {
        source: '/login',
        headers: [
          {
            key: 'cache-control',
            value: 'max-age=3600,stale-while-revalidate=60', // 1 hour
          },
        ],
      },
      {
        source: '/register',
        headers: [
          {
            key: 'cache-control',
            value: 'max-age=3600,stale-while-revalidate=60', // 1 hour
          },
        ],
      },
      {
        source: '/product/:slug',
        headers: [
          {
            key: 'cache-control',
            value: 'max-age=3600,stale-while-revalidate=60', // 1 hour
          },
        ],
      },
      {
        source: '/waitroom',
        headers: [
          {
            key: 'cache-control',
            value: 'max-age=3600,stale-while-revalidate=60', // 1 hour
          },
        ],
      },
      {
        source: '/',
        missing: [
          {
            type: 'cookie',
            key: 'token',
            value: undefined,
          },
        ],
        headers: [
          {
            key: 'cache-control',
            value: 'max-age=3600,stale-while-revalidate=60', // 1 hour
          },
        ],
      },
    ]
  },
};

export default nextConfig;
