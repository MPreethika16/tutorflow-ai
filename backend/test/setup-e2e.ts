import { config } from 'dotenv';

const result = config({
  path: '.env.test'
});

if (result.error) {
  throw new Error(
    `Unable to load .env.test: ${result.error.message}`,
  );
}