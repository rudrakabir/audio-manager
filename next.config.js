/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    experimental: {
      serverActions: true,
    },
    webpack: (config) => {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Fix for Whisper.js transformer library
        sharp$: false,
        "onnxruntime-node$": false,
      };
      return config;
    },
  };
  
  module.exports = nextConfig;