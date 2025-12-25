module.exports = async function mockFetch(url, options) {
  // Basic dummy response used in tests to avoid real network calls.
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({}),
    text: async () => '',
    arrayBuffer: async () => Buffer.from('').buffer
  };
};
