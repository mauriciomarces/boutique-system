const express = require('express');
const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ service: 'products-service', status: 'ok', port });
});

app.get('/', (req, res) => {
  res.json({ service: 'products-service', message: 'Microservice ready' });
});

app.listen(port, () => {
  console.log('products-service running on port ' + port);
});
