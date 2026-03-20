const axios = require('axios');

const analyzeWithMlService = async (payload) => {
  const baseUrl = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
  const response = await axios.post(`${baseUrl}/analyze`, payload, { timeout: 5000 });
  return response.data;
};

module.exports = { analyzeWithMlService };
