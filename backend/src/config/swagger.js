const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TeamSketch API',
      version: '1.0.0',
      description: 'TeamSketch API Documentation',
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js'], // Path to API docs
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
