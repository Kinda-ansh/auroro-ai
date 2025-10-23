require('dotenv').config();

const Joi = require('joi');

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string()
      .valid('production', 'development', 'test')
      .required(),
    PORT: Joi.number().default(3000),
    MONGODB_URL: Joi.string().required().description('Mongo DB url'),
    JWT_KEY: Joi.string().required().description('JWT secret key'),
    BCRYPT_SALT_ROUNDS: Joi.string()
      .required()
      .description('BCRYPT Salt rounds is required'),
    BASE_URL: Joi.string()
      .required()
      .description('Base URL to connect to server'),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema
  .prefs({ errors: { label: 'key' } })
  .validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  mongoose: {
    url: envVars.MONGODB_URL + (envVars.NODE_ENV === 'stage' ? '-stage' : ''),
  },
  jwt: {
    secret: envVars.JWT_KEY,
  },
  bcrypt: {
    salt: envVars.BCRYPT_SALT_ROUNDS,
  },
  baseUrl: envVars.BASE_URL,
  googleClientId: envVars.googleClientId,
  googleProjectId: envVars.googleProjectId,
  googleClientSecret: envVars.googleClientSecret,
};

export default config;
