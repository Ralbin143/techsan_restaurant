import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./env.js";

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "TechSan Restaurant ERP API",
      version: "1.0.0",
      description: "Production REST API for restaurant management ecosystem",
    },
    servers: [{ url: env.apiBaseUrl }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/routes/v1/*.js", "./src/docs/swagger/*.yaml"],
};

export const swaggerSpec = swaggerJsdoc(options);
