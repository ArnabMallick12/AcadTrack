/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: 'http://localhost:5000/:path*',
            },
        ];
    },
    webpack: (config, { dev }) => {
        // Prevent stale chunk/CSS 404s during long dev sessions.
        if (dev) {
            config.cache = false;
        }
        return config;
    },
};

export default nextConfig;
