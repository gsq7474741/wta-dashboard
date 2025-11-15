/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.externals.push({
      'zeromq': 'zeromq'
    });
    return config;
  },
}

module.exports = nextConfig
